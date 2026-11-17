"""수동 메일 발송 (백오피스 '운영 관리 > 이메일/알림 관리 > 수동 발송 관리').

흐름
1. 관리자가 대상(조건 검색 전체 / 직접 입력 / CSV)과 제목·본문을 정해 초안을 저장한다.
2. 발송하면 발송 작업(core.manual_email_jobs)을 만든다. 즉시 발송은 응답 뒤 바로, 예약 발송은
   주기 작업(/internal/jobs/manual-emails)이 시각이 되면 보낸다.
3. 작업을 시작할 때 대상을 확정해 수신자 표(core.manual_email_recipients)에 넣고 한 명씩 보낸다.
   보낸 메일은 발송 이력(core.email_logs)에 template_id='manual_send', batch_id=작업 id로 남는다.

대상 규칙
- 조건 검색(전체 유저): 활성(ACTIVE) 일반 회원(role=USER)만.
- 마케팅 메일(긴급 공지가 아님): 수신 동의(subscribed_newsletter)하지 않은 회원은 제외한다.
- 직접 입력·CSV: 형식이 틀린 주소·중복·탈퇴 회원은 제외한다. 회원이 아닌 주소에도 보낸다.
"""

import asyncio
import csv
import io
import logging
import re
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from jinja2 import TemplateError
from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.errors import AppError
from app.models import ManualEmailDraft, ManualEmailJob, ManualEmailRecipient, User
from app.schemas.manual_email import DraftPayload, DraftUpdatePayload, ManualEmailFilter
from app.services import email_templates as tpl
from app.services import newsletter
from app.services.email import EmailSender
from app.services.notify import user_name
from app.services.wallet import day_range

logger = logging.getLogger(__name__)

TEMPLATE_ID = "manual_send"  # 발송 이력의 템플릿 코드
LOCALES = ("en", "ko")
DRAFT_TTL = timedelta(days=30)
PREVIEW_SIZE = 20
MAX_RECIPIENTS = 10_000
MAX_CSV_BYTES = 2 * 1024 * 1024
_EMAIL_RE = re.compile(r"^[^@\s,;<>\"']+@[^@\s,;<>\"']+\.[^@\s,;<>\"']+$")

SKIP_LABELS = {
    "UNSUBSCRIBED": "수신거부",
    "INVALID_EMAIL": "이메일 형식 오류",
    "WITHDRAWN": "탈퇴 회원",
    "DUPLICATE": "중복 주소",
}
_DONE = {"completed", "partial_failed", "failed", "cancelled"}


def _now() -> datetime:
    return datetime.now(UTC)


# ── 대상 ────────────────────────────────────────────────────


def _member_conditions(f: ManualEmailFilter) -> list:
    conditions = [
        User.role == "USER",
        User.status == "ACTIVE",
        ~User.email.like("%@deleted.local"),
    ]
    if f.email and f.email.strip():
        conditions.append(func.lower(User.email).like(f"%{f.email.strip().lower()}%"))
    start, end = day_range(f.joined_from, f.joined_to)
    if start:
        conditions.append(User.created_at >= start)
    if end:
        conditions.append(User.created_at < end)
    if f.grade and f.grade != "ALL":
        conditions.append(User.grade == f.grade)
    if f.newsletter_filter == "SUBSCRIBED":
        conditions.append(User.subscribed_newsletter.is_(True))
    elif f.newsletter_filter == "UNSUBSCRIBED":
        conditions.append(User.subscribed_newsletter.is_(False))
    return conditions


def _member_skip(user: User | None, marketing: bool) -> str | None:
    if user is None:
        return None
    if user.status == "WITHDRAWN" or user.email.endswith("@deleted.local"):
        return "WITHDRAWN"
    if marketing and not user.subscribed_newsletter:
        return "UNSUBSCRIBED"
    return None


def _preview_row(email: str, user: User | None, skip: str | None) -> dict:
    return {
        "user_id": str(user.id) if user else None,
        "email": email,
        "user_name": user_name(user) if user else None,
        "grade": user.grade if user else "-",
        "auth_provider": user.auth_provider if user else None,
        "auth_provider_label": user.auth_provider if user else None,
        "account_count": 0,  # 거래 계좌는 아직 Core에 없다
        "joined_at": user.created_at.isoformat() if user else None,
        "subscribed_newsletter": bool(user.subscribed_newsletter) if user else False,
        "newsletter_unsubscribed_at": (
            user.newsletter_unsubscribed_at.isoformat() if user and user.newsletter_unsubscribed_at else None
        ),
        "eligible": skip is None,
        "skip_reason": skip,
        "skip_reason_label": SKIP_LABELS.get(skip) if skip else None,
    }


async def search(session: AsyncSession, f: ManualEmailFilter) -> dict:
    """조건 검색 (참고용 목록). marketing_preview면 수신 동의하지 않은 회원을 제외 대상으로 표시한다."""
    conditions = _member_conditions(f)
    total, subscribed = (
        await session.execute(
            select(func.count(), func.count().filter(User.subscribed_newsletter.is_(True))).where(*conditions)
        )
    ).one()
    users = list(
        await session.scalars(
            select(User)
            .where(*conditions)
            .order_by(User.created_at.desc(), User.id)
            .offset((f.page - 1) * f.page_size)
            .limit(f.page_size)
        )
    )
    return {
        "total": total,
        "eligible": subscribed if f.marketing_preview else total,
        "subscribed_count": subscribed,
        "unsubscribed_count": total - subscribed,
        "page": f.page,
        "page_size": f.page_size,
        "total_pages": max(1, -(-total // f.page_size)),
        "items": [_preview_row(u.email, u, _member_skip(u, f.marketing_preview)) for u in users],
        "filters_applied": f.model_dump(),
    }


async def search_unsubscribed(session: AsyncSession, f: ManualEmailFilter) -> dict:
    """수신거부 관리: 마케팅 메일 수신 동의하지 않은 회원. 기간은 수신거부 시각(KST) 기준."""
    f = f.model_copy(update={"newsletter_filter": "UNSUBSCRIBED", "marketing_preview": True})
    conditions = _member_conditions(f)
    start, end = day_range(f.unsubscribed_from, f.unsubscribed_to)
    if start:
        conditions.append(User.newsletter_unsubscribed_at >= start)
    if end:
        conditions.append(User.newsletter_unsubscribed_at < end)
    total = await session.scalar(select(func.count()).where(*conditions)) or 0
    users = list(
        await session.scalars(
            select(User)
            .where(*conditions)
            .order_by(User.newsletter_unsubscribed_at.desc().nulls_last(), User.created_at.desc(), User.id)
            .offset((f.page - 1) * f.page_size)
            .limit(f.page_size)
        )
    )
    return {
        "total": total,
        "eligible": 0,
        "subscribed_count": 0,
        "unsubscribed_count": total,
        "page": f.page,
        "page_size": f.page_size,
        "total_pages": max(1, -(-total // f.page_size)),
        "items": [_preview_row(u.email, u, "UNSUBSCRIBED") for u in users],
        "filters_applied": f.model_dump(),
    }


async def export_csv(session: AsyncSession, f: ManualEmailFilter) -> str:
    users = await session.scalars(
        select(User).where(*_member_conditions(f)).order_by(User.created_at.desc(), User.id).limit(100_000)
    )
    out = io.StringIO()
    out.write("﻿")  # 엑셀에서 한글이 깨지지 않게
    writer = csv.writer(out)
    writer.writerow(["email", "name", "grade", "joined_at", "subscribed_newsletter"])
    for u in users:
        writer.writerow([u.email, user_name(u), u.grade, u.created_at.isoformat(), "Y" if u.subscribed_newsletter else "N"])
    return out.getvalue()


@dataclass
class Target:
    email: str
    user: User | None
    skip: str | None


def _is_marketing(draft: ManualEmailDraft | ManualEmailJob) -> bool:
    return draft.is_marketing and not draft.is_urgent


def _entries(draft: ManualEmailDraft) -> list[str]:
    if draft.target_mode == "csv_import":
        return list(draft.import_entries or [])
    return list(draft.manual_entries or [])


async def _entry_targets(session: AsyncSession, entries: list[str], marketing: bool) -> list[Target]:
    targets: list[Target] = []
    seen: set[str] = set()
    valid: list[str] = []
    for raw in entries:
        email = raw.strip().strip('"').strip().lower()
        if not email:
            continue
        if email in seen:
            targets.append(Target(email, None, "DUPLICATE"))
            continue
        seen.add(email)
        if not _EMAIL_RE.match(email):
            targets.append(Target(email, None, "INVALID_EMAIL"))
            continue
        valid.append(email)
    users: dict[str, User] = {}
    for i in range(0, len(valid), 1000):
        chunk = valid[i : i + 1000]
        for u in await session.scalars(select(User).where(func.lower(User.email).in_(chunk))):
            users.setdefault(u.email.lower(), u)
    for email in valid:
        user = users.get(email)
        targets.append(Target(email, user, _member_skip(user, marketing)))
    return targets


async def resolve_targets(session: AsyncSession, draft: ManualEmailDraft) -> list[Target]:
    """보낼 대상을 확정한다 (제외 대상 포함)."""
    marketing = _is_marketing(draft)
    if draft.target_mode == "filter_all":
        f = ManualEmailFilter(**(draft.filter or {}))
        users = await session.scalars(
            select(User).where(*_member_conditions(f)).order_by(User.created_at, User.id).limit(MAX_RECIPIENTS + 1)
        )
        return [Target(u.email.lower(), u, _member_skip(u, marketing)) for u in users]
    return await _entry_targets(session, _entries(draft), marketing)


async def recipient_summary(session: AsyncSession, draft: ManualEmailDraft) -> dict:
    marketing = _is_marketing(draft)
    if draft.target_mode == "filter_all":
        f = ManualEmailFilter(**(draft.filter or {}))
        conditions = _member_conditions(f)
        total, subscribed = (
            await session.execute(
                select(func.count(), func.count().filter(User.subscribed_newsletter.is_(True))).where(*conditions)
            )
        ).one()
        eligible = subscribed if marketing else total
        users = await session.scalars(
            select(User).where(*conditions).order_by(User.created_at.desc(), User.id).limit(PREVIEW_SIZE)
        )
        preview = [_preview_row(u.email, u, _member_skip(u, marketing)) for u in users]
        csv_rows = None
    else:
        targets = await _entry_targets(session, _entries(draft), marketing)
        total = len(targets)
        eligible = sum(1 for t in targets if t.skip is None)
        preview = [_preview_row(t.email, t.user, t.skip) for t in targets[:PREVIEW_SIZE]]
        csv_rows = len(draft.import_entries or []) if draft.target_mode == "csv_import" else None
    return {
        "total": total,
        "eligible": eligible,
        "skipped": total - eligible,
        "items": preview,
        "preview": preview,
        "csv_rows": csv_rows,
    }


# ── 본문 ────────────────────────────────────────────────────


def _locale_content(contents: dict, locale: str | None) -> tuple[str, dict]:
    """회원 언어 본문이 있으면 그것, 없으면 영어, 그것도 없으면 처음 것."""
    for lg in (tpl.lang(locale), "en", *contents.keys()):
        body = contents.get(lg)
        if body and body.get("subject") and body.get("html_content"):
            return lg, body
    raise AppError(422, "empty_content", "메일 제목과 본문을 입력해주세요.")


def _variables(name: str, email: str) -> dict[str, Any]:
    return {"user_name": name, "email": email}


def _render(
    contents: dict, locale: str | None, name: str, email: str, footer: Callable[[str], str] | None = None
) -> tuple[str, tpl.RenderedEmail]:
    """footer: 언어를 받아 본문 아래에 붙일 HTML (회원 수신거부 링크)."""
    lg, body = _locale_content(contents, locale)
    variables = _variables(name, email)
    content = tpl.render_html(body["html_content"], variables)
    if footer is not None:
        content += footer(lg)
    mail = tpl.RenderedEmail(
        subject=tpl.render_subject(body["subject"], variables),
        html=tpl.layout(content, lg),
        text=tpl.html_to_text(content),
    )
    return lg, mail


def _check_contents(contents: dict[str, dict]) -> dict[str, dict]:
    cleaned: dict[str, dict] = {}
    for lg, body in contents.items():
        if lg not in LOCALES:
            raise AppError(422, "invalid_locale", f"지원하지 않는 언어입니다: {lg}")
        subject = (body.get("subject") or "").strip()
        html = body.get("html_content") or ""
        if not subject and not re.sub(r"<[^>]*>", "", html).strip():
            continue
        try:
            tpl.build(subject, html, lg, _variables("John Doe", "sample@example.com"))
        except TemplateError as exc:
            raise AppError(400, "invalid_template", f"본문의 변수 문법이 잘못되었습니다: {exc}") from exc
        cleaned[lg] = {"subject": subject, "html_content": html}
    return cleaned


def content_preview(draft: ManualEmailDraft) -> dict:
    try:
        lg, mail = _render(draft.content_locales, draft.preview_locale, draft.sample_user_name, "sample@example.com")
    except AppError:
        return {"locale": draft.preview_locale, "subject_rendered": "", "html_rendered": ""}
    return {"locale": lg, "subject_rendered": mail.subject, "html_rendered": mail.html}


# ── 초안 ────────────────────────────────────────────────────


def parse_csv(data: bytes) -> list[str]:
    """CSV의 모든 칸에서 이메일처럼 보이는 값('@' 포함)을 읽는다."""
    if len(data) > MAX_CSV_BYTES:
        raise AppError(413, "csv_too_large", "CSV 파일은 2MB까지 올릴 수 있습니다.")
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = data.decode("cp949", errors="replace")
    emails = [cell.strip() for row in csv.reader(io.StringIO(text)) for cell in row if "@" in cell]
    if not emails:
        raise AppError(422, "csv_no_emails", "CSV에서 이메일 주소를 찾지 못했습니다.")
    if len(emails) > MAX_RECIPIENTS:
        raise AppError(422, "too_many_recipients", f"한 번에 {MAX_RECIPIENTS:,}명까지 보낼 수 있습니다.")
    return emails


def _check_send_at(send_at: datetime | None) -> datetime | None:
    if send_at is None:
        return None
    if send_at.tzinfo is None:
        raise AppError(422, "invalid_send_at", "예약 시각에 시간대가 필요합니다.")
    if send_at <= _now():
        raise AppError(422, "send_at_in_past", "예약 발송 시각이 이미 지났습니다. 다시 선택해주세요.")
    return send_at


async def _import_entries(session: AsyncSession, import_id: str | None) -> tuple[uuid.UUID, list[str], str | None]:
    try:
        iid = uuid.UUID(str(import_id))
    except ValueError:
        raise AppError(422, "csv_required", "CSV 파일을 다시 올려주세요.") from None
    source = await session.scalar(
        select(ManualEmailDraft)
        .where(ManualEmailDraft.import_id == iid)
        .order_by(ManualEmailDraft.created_at.desc())
        .limit(1)
    )
    if source is None or not source.import_entries:
        raise AppError(422, "csv_required", "CSV 파일을 다시 올려주세요.")
    return iid, list(source.import_entries), source.import_filename


async def _apply(
    session: AsyncSession,
    draft: ManualEmailDraft,
    data: dict,
    csv_file: tuple[str, bytes] | None,
) -> None:
    """초안 값을 바꾸고 대상·본문을 검사한다."""
    if "content_locales" in data and data["content_locales"] is not None:
        draft.content_locales = _check_contents(data["content_locales"])
    for field in ("is_marketing", "is_urgent", "preview_locale", "sample_user_name"):
        if data.get(field) is not None:
            setattr(draft, field, data[field])
    if draft.preview_locale not in LOCALES:
        draft.preview_locale = "en"
    if "send_at" in data:
        draft.send_at = _check_send_at(data["send_at"])

    mode = data.get("target_mode") or draft.target_mode
    if csv_file is not None:
        mode = "csv_import"
    draft.target_mode = mode
    if mode == "filter_all":
        if "filter" in data or draft.filter is None:
            f = ManualEmailFilter(**(data.get("filter") or {}))
            draft.filter = f.model_dump(exclude={"page", "page_size"})
        draft.manual_entries = None
    elif mode == "manual_input":
        if data.get("manual_entries") is not None:
            draft.manual_entries = [e.strip() for e in data["manual_entries"] if e and e.strip()]
        if not draft.manual_entries:
            raise AppError(422, "recipients_required", "발송 대상 이메일을 입력해주세요.")
        if len(draft.manual_entries) > MAX_RECIPIENTS:
            raise AppError(422, "too_many_recipients", f"한 번에 {MAX_RECIPIENTS:,}명까지 보낼 수 있습니다.")
        draft.filter = None
    else:  # csv_import
        if csv_file is not None:
            draft.import_id = uuid.uuid4()
            draft.import_filename = csv_file[0][:200]
            draft.import_entries = parse_csv(csv_file[1])
        elif data.get("import_id") and (draft.import_id is None or str(draft.import_id) != str(data["import_id"])):
            draft.import_id, draft.import_entries, draft.import_filename = await _import_entries(
                session, data["import_id"]
            )
        if not draft.import_entries:
            raise AppError(422, "csv_required", "CSV 파일을 올려주세요.")
        draft.filter = None
        draft.manual_entries = None


async def create_draft(
    session: AsyncSession, body: DraftPayload, admin_id: uuid.UUID, csv_file: tuple[str, bytes] | None = None
) -> ManualEmailDraft:
    draft = ManualEmailDraft(
        status="draft",
        target_mode=body.target_mode,
        content_locales={},
        expires_at=_now() + DRAFT_TTL,
        created_by=admin_id,
        updated_by=admin_id,
    )
    await _apply(session, draft, body.model_dump(), csv_file)
    session.add(draft)
    await session.flush()
    return draft


async def get_draft(session: AsyncSession, draft_id: str, *, lock: bool = False) -> ManualEmailDraft:
    try:
        did = uuid.UUID(draft_id)
    except ValueError:
        raise AppError(404, "draft_not_found", "임시 저장한 메일을 찾을 수 없습니다.") from None
    stmt = select(ManualEmailDraft).where(ManualEmailDraft.id == did)
    draft = await session.scalar(stmt.with_for_update() if lock else stmt)
    if draft is None:
        raise AppError(404, "draft_not_found", "임시 저장한 메일을 찾을 수 없습니다.")
    return draft


def _check_editable(draft: ManualEmailDraft) -> None:
    if draft.status == "sent":
        raise AppError(409, "draft_already_sent", "이미 발송한 메일입니다. 새로 작성해주세요.")
    if draft.status == "expired" or draft.expires_at <= _now():
        raise AppError(409, "draft_expired", "보관 기간이 지난 임시 저장 메일입니다. 새로 작성해주세요.")


async def update_draft(
    session: AsyncSession, draft: ManualEmailDraft, body: DraftUpdatePayload, admin_id: uuid.UUID
) -> ManualEmailDraft:
    _check_editable(draft)
    await _apply(session, draft, body.model_dump(exclude_unset=True), None)
    draft.updated_by = admin_id
    draft.expires_at = _now() + DRAFT_TTL
    await session.flush()
    return draft


async def list_drafts(session: AsyncSession) -> list[ManualEmailDraft]:
    """작성 중인 메일 (최근 저장한 것부터)."""
    return list(
        await session.scalars(
            select(ManualEmailDraft)
            .where(ManualEmailDraft.status == "draft", ManualEmailDraft.expires_at > _now())
            .order_by(ManualEmailDraft.updated_at.desc())
            .limit(10)
        )
    )


async def draft_out(session: AsyncSession, draft: ManualEmailDraft) -> dict:
    return {
        "draft_id": str(draft.id),
        "status": draft.status,
        "target_mode": draft.target_mode,
        "filter": draft.filter,
        "manual_entries": draft.manual_entries,
        "import_id": str(draft.import_id) if draft.import_id else None,
        "import_filename": draft.import_filename,
        "is_marketing": draft.is_marketing,
        "is_urgent": draft.is_urgent,
        "content_locales": draft.content_locales,
        "preview_locale": draft.preview_locale,
        "sample_user_name": draft.sample_user_name,
        "recipient_summary": await recipient_summary(session, draft),
        "content_preview": content_preview(draft),
        "send_at": draft.send_at.isoformat() if draft.send_at else None,
        "job_id": str(draft.job_id) if draft.job_id else None,
        "expires_at": draft.expires_at.isoformat(),
        "created_at": draft.created_at.isoformat(),
        "updated_at": draft.updated_at.isoformat(),
    }


# ── 발송 ────────────────────────────────────────────────────


async def create_job(session: AsyncSession, draft: ManualEmailDraft, admin_id: uuid.UUID) -> tuple[ManualEmailJob, dict]:
    """발송 작업을 만든다 (메일은 아직 보내지 않는다)."""
    _check_editable(draft)
    _, first = _locale_content(draft.content_locales, "en")
    send_at = _check_send_at(draft.send_at)
    summary = await recipient_summary(session, draft)
    if summary["eligible"] == 0:
        raise AppError(422, "no_recipients", "보낼 수 있는 대상이 없습니다. 수신거부·형식 오류 대상은 제외됩니다.")
    if summary["total"] > MAX_RECIPIENTS:
        raise AppError(422, "too_many_recipients", f"한 번에 {MAX_RECIPIENTS:,}명까지 보낼 수 있습니다.")
    job = ManualEmailJob(
        draft_id=draft.id,
        status="queued",
        target_mode=draft.target_mode,
        is_marketing=draft.is_marketing,
        is_urgent=draft.is_urgent,
        subject=first["subject"][:500],
        send_at=send_at,
        recipient_total=summary["eligible"],
        skipped_count=summary["skipped"],
        created_by=admin_id,
    )
    session.add(job)
    await session.flush()
    draft.status = "sent"
    draft.job_id = job.id
    return job, summary


def job_out(job: ManualEmailJob) -> dict:
    return {
        "job_id": str(job.id),
        "trace_id": str(job.id),
        "status": job.status,
        "recipient_total": job.recipient_total,
        "sent_count": job.sent_count,
        "failed_count": job.failed_count,
        "skipped_count": job.skipped_count,
        "subject": job.subject,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        "target_mode": job.target_mode,
        "is_marketing": job.is_marketing,
        "is_urgent": job.is_urgent,
        "send_at": job.send_at.isoformat() if job.send_at else None,
        "created_at": job.created_at.isoformat(),
    }


async def get_job(session: AsyncSession, job_id: str) -> ManualEmailJob:
    try:
        jid = uuid.UUID(job_id)
    except ValueError:
        raise AppError(404, "job_not_found", "발송 작업을 찾을 수 없습니다.") from None
    job = await session.get(ManualEmailJob, jid)
    if job is None:
        raise AppError(404, "job_not_found", "발송 작업을 찾을 수 없습니다.")
    return job


async def _start(session: AsyncSession, job_id: uuid.UUID) -> bool:
    """queued 작업의 대상을 확정해 수신자 표에 넣는다. 보낼 게 있으면 True."""
    job = await session.scalar(select(ManualEmailJob)
        .where(ManualEmailJob.id == job_id)
        .with_for_update()
        .execution_options(populate_existing=True))
    if job is None or job.status in _DONE:
        return False
    if job.status == "queued":
        draft = await session.get(ManualEmailDraft, job.draft_id)
        assert draft is not None
        targets = await resolve_targets(session, draft)
        seen: set[str] = set()
        rows = []
        for t in targets:
            if t.email in seen:  # 중복 주소는 한 줄만 남긴다 (unique)
                continue
            seen.add(t.email)
            rows.append(
                ManualEmailRecipient(
                    job_id=job.id,
                    email=t.email,
                    user_id=t.user.id if t.user else None,
                    locale=t.user.locale if t.user else None,
                    status="skipped" if t.skip else "pending",
                    skip_reason=t.skip,
                )
            )
        session.add_all(rows)
        job.status = "processing"
        job.started_at = _now()
        job.recipient_total = sum(1 for t in targets if t.skip is None)
        job.skipped_count = len(targets) - job.recipient_total
    await session.commit()
    return True


async def _send_one(
    session: AsyncSession, sender: EmailSender, job: ManualEmailJob, contents: dict, base_url: str
) -> bool:
    """대기 중인 수신자 한 명에게 보낸다. 남은 사람이 없으면 False."""
    row = await session.scalar(
        select(ManualEmailRecipient)
        .where(ManualEmailRecipient.job_id == job.id, ManualEmailRecipient.status == "pending")
        .order_by(ManualEmailRecipient.id)
        .limit(1)
        .with_for_update(skip_locked=True)
    )
    if row is None:
        return False
    user = await session.get(User, row.user_id) if row.user_id else None
    name = user_name(user) if user else row.email.split("@")[0]
    job_id = job.id
    footer = None
    if user is not None and not job.is_urgent:  # 긴급 공지가 아니면 회원에게 수신거부 링크를 넣는다
        uid = user.id
        footer = lambda lg: newsletter.footer_html(base_url, uid, lg)  # noqa: E731
    try:
        lg, mail = _render(contents, row.locale, name, row.email, footer)
        meta = {"batch_id": str(job_id), "locale": lg}
        if row.user_id:
            meta["user_id"] = str(row.user_id)
        await sender.send(row.email, mail, TEMPLATE_ID, meta)
        row.status, row.sent_at = "sent", _now()
        counter = {"sent_count": ManualEmailJob.sent_count + 1}
    except Exception as exc:  # 한 명이 실패해도 다음 사람에게 계속 보낸다
        logger.warning("수동 발송 실패 (%s → %s): %s", job_id, row.email, exc)
        row.status, row.error_message = "failed", str(exc)[:1000]
        counter = {"failed_count": ManualEmailJob.failed_count + 1}
    await session.execute(update(ManualEmailJob).where(ManualEmailJob.id == job_id).values(**counter))
    await session.commit()
    return True


async def _finish(session: AsyncSession, job_id: uuid.UUID) -> None:
    job = await session.scalar(select(ManualEmailJob)
        .where(ManualEmailJob.id == job_id)
        .with_for_update()
        .execution_options(populate_existing=True))
    if job is None or job.status != "processing":
        await session.commit()
        return
    pending = await session.scalar(
        select(func.count()).where(ManualEmailRecipient.job_id == job_id, ManualEmailRecipient.status == "pending")
    )
    if pending == 0:
        if job.failed_count == 0:
            job.status = "completed"
        elif job.sent_count == 0:
            job.status = "failed"
        else:
            job.status = "partial_failed"
        job.completed_at = _now()
    await session.commit()


async def process_job(session: AsyncSession, sender: EmailSender, job_id: uuid.UUID, base_url: str) -> None:
    """작업 하나를 끝까지 보낸다. 여러 곳에서 동시에 불러도 한 사람에게 두 번 보내지 않는다."""
    if not await _start(session, job_id):
        return
    job = await session.get(ManualEmailJob, job_id)
    draft = await session.get(ManualEmailDraft, job.draft_id) if job else None
    if draft is None:
        return
    contents = dict(draft.content_locales)
    interval = 1 / settings.manual_email_rate_per_second if settings.manual_email_rate_per_second > 0 else 0
    while await _send_one(session, sender, job, contents, base_url):
        if interval:
            await asyncio.sleep(interval)
    await _finish(session, job_id)


async def run_job_in_background(sender: EmailSender, job_id: uuid.UUID, base_url: str) -> None:
    """API 응답 뒤에 바로 보낸다 (즉시 발송). 별도 DB 세션을 쓴다."""
    from app import db

    db.get_engine()
    assert db._sessionmaker is not None
    try:
        async with db._sessionmaker() as session:
            await process_job(session, sender, job_id, base_url)
    except Exception:
        logger.exception("수동 발송 작업 실패: %s", job_id)


async def due_job_ids(session: AsyncSession, now: datetime | None = None) -> list[uuid.UUID]:
    """보낼 때가 된 작업: 예약 시각이 지난 queued, 중간에 멈춘 processing."""
    now = now or _now()
    rows = await session.scalars(
        select(ManualEmailJob.id)
        .where(
            or_(
                (ManualEmailJob.status == "queued")
                & or_(ManualEmailJob.send_at.is_(None), ManualEmailJob.send_at <= now),
                ManualEmailJob.status == "processing",
            )
        )
        .order_by(ManualEmailJob.created_at)
        .limit(20)
    )
    return list(rows)


async def run_due_jobs(session: AsyncSession, sender: EmailSender, base_url: str) -> dict[str, int]:
    ids = await due_job_ids(session)
    await session.commit()
    for job_id in ids:
        await process_job(session, sender, job_id, base_url)
    return {"processed": len(ids)}


async def cancel_job(session: AsyncSession, job: ManualEmailJob) -> None:
    """아직 시작하지 않은 예약 발송을 취소한다."""
    if job.status != "queued":
        raise AppError(409, "job_not_cancellable", "이미 발송을 시작했거나 끝난 작업은 취소할 수 없습니다.")
    job.status = "cancelled"
    job.completed_at = _now()
