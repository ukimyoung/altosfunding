"""제휴사(10Power·xnsoft) 회원 가져오기.

제휴사 회원 조회 API(GET /api/partner/v1/members)를 페이지 끝까지 불러 core.partner_members에 저장한다.

- FULL: since 없이 전체 (백오피스 '전체 다시 가져오기').
- INCREMENTAL: 마지막 성공 회차 as_of − 5분을 since로 (Worker 자동 주기, 백오피스 '지금 가져오기').
  성공한 회차가 없으면 since 없이 전체를 받는다.
- 회차(core.partner_member_sync_runs)는 Core가 QUEUED로 만들고 작업 큐에 넣으면 Worker가 실행한다.
  한 번에 한 회차만 있다. 페이지마다 커밋하고 last_cursor를 남겨, Worker가 중간에 멈추면 그 다음 페이지부터 이어 받는다.
- 항목 검사: member_id 없음·'@' 포함, site·status가 정해진 값 밖, 날짜 형식 오류는 그 항목만 실패로 남긴다.
- 같은 회원은 member_id(대소문자 무시)로 덮어쓴다. 제휴사 updated_at이 같으면 '변화 없음'.
- 활성화된 뒤에는 제휴사 이메일·이름·전화가 바뀌어도 Altos 계정 값은 바꾸지 않는다 (partner_members에만 저장).
- status=deleted: 연결된 Altos 계정을 INACTIVE로 (사유 PARTNER_DELETED, 로그인 세션 폐기).
  다시 deleted가 아니게 되면 PARTNER_DELETED로 막힌 계정만 ACTIVE로 되돌린다 (관리자가 막은 계정은 그대로).
- 오류: 400·401·403은 설정 문제라 바로 FAILED. 429는 잠시 기다려 다시. 500·네트워크 오류는 FAILED로 두고
  다음 주기에 같은 since로 다시 받는다 (기준은 항상 마지막 성공 회차의 as_of).
"""

import asyncio
import logging
import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta, timezone

import httpx
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.errors import AppError
from app.models import PartnerMember, PartnerMemberSyncRun, User, UserStatusHistory
from app.services import jobs, partner_mock, user_admin

logger = logging.getLogger(__name__)

JOB_KIND = "partner_members.sync"
FULL, INCREMENTAL = "FULL", "INCREMENTAL"
QUEUED, RUNNING, SUCCEEDED, FAILED = "QUEUED", "RUNNING", "SUCCEEDED", "FAILED"
SINCE_OVERLAP = timedelta(minutes=5)
SITES = {"10power", "xnsoft"}
STATUSES = {"active", "unconfirmed", "suspended", "deleted"}
DELETED = "deleted"
REASON_DELETED = "PARTNER_DELETED"
REASON_RESTORED = "PARTNER_RESTORED"
MAX_FAILURES = 500
RATE_LIMIT_RETRIES = 5
RATE_LIMIT_WAIT_SECONDS = 10
KST = timezone(timedelta(hours=9))


def _now() -> datetime:
    return datetime.now(UTC)


# ── 제휴사 API 호출 ──────────────────────────────────────────


class PartnerApiError(Exception):
    def __init__(self, message: str, status: int | None = None) -> None:
        super().__init__(message)
        self.status = status


def is_mock() -> bool:
    return settings.partner_members_api_url.strip().lower() == "mock" and not settings.is_live


def is_configured() -> bool:
    if is_mock():
        return True
    return bool(settings.partner_members_api_url.strip().startswith("http") and settings.partner_members_api_key)


async def fetch_page(since: datetime | None, cursor: str | None, limit: int) -> dict:
    """한 페이지를 받는다. 테스트는 이 함수를 바꿔 끼운다."""
    if is_mock():
        return partner_mock.list_members(since, cursor, limit)
    params: dict[str, str | int] = {"limit": limit}
    if since is not None:
        params["since"] = since.astimezone(KST).isoformat(timespec="seconds")
    if cursor:
        params["cursor"] = cursor
    headers = {"Authorization": f"Bearer {settings.partner_members_api_key}", "Accept": "application/json"}
    async with httpx.AsyncClient(timeout=settings.partner_members_http_timeout_seconds) as client:
        for attempt in range(RATE_LIMIT_RETRIES + 1):
            try:
                res = await client.get(settings.partner_members_api_url, params=params, headers=headers)
            except httpx.HTTPError as exc:
                raise PartnerApiError(f"제휴사 API에 연결하지 못했습니다: {exc.__class__.__name__}") from exc
            if res.status_code == 429 and attempt < RATE_LIMIT_RETRIES:
                await asyncio.sleep(RATE_LIMIT_WAIT_SECONDS)
                continue
            if res.status_code != 200:
                raise PartnerApiError(_http_error_message(res.status_code, res.text), res.status_code)
            try:
                body = res.json()
            except ValueError as exc:
                raise PartnerApiError("제휴사 API 응답이 JSON이 아닙니다.", res.status_code) from exc
            return body
    raise PartnerApiError("제휴사 API 호출 횟수 제한(429)이 계속됩니다.", 429)


def _http_error_message(status: int, body: str) -> str:
    known = {
        400: "요청 변수 형식 오류(400)",
        401: "전용 키가 없거나 틀립니다(401). PARTNER_MEMBERS_API_KEY를 확인하세요",
        403: "허용되지 않은 IP입니다(403). Worker의 Outbound IP를 제휴사에 등록해야 합니다",
        429: "호출 횟수 제한(429)",
        500: "제휴사 서버 오류(500). 다음 주기에 다시 받습니다",
    }
    return f"{known.get(status, f'HTTP {status}')}: {body[:300]}"


# ── 회차 만들기 (Core·Worker) ────────────────────────────────


async def active_run(session: AsyncSession) -> PartnerMemberSyncRun | None:
    return await session.scalar(
        select(PartnerMemberSyncRun).where(PartnerMemberSyncRun.status.in_((QUEUED, RUNNING)))
    )


async def last_succeeded(session: AsyncSession) -> PartnerMemberSyncRun | None:
    return await session.scalar(
        select(PartnerMemberSyncRun)
        .where(PartnerMemberSyncRun.status == SUCCEEDED)
        .order_by(PartnerMemberSyncRun.finished_at.desc())
        .limit(1)
    )


async def start(session: AsyncSession, mode: str, requested_by: uuid.UUID | None) -> PartnerMemberSyncRun:
    """회차를 만들고 작업 큐에 넣는다. 커밋은 호출한 쪽이 한다. 실행 중인 회차가 있으면 409."""
    if not is_configured():
        raise AppError(
            409, "partner_api_not_configured", "제휴사 API 주소·키가 설정되지 않았습니다 (PARTNER_MEMBERS_API_URL)."
        )
    if mode not in (FULL, INCREMENTAL):
        raise AppError(400, "invalid_mode", "mode는 FULL 또는 INCREMENTAL입니다.")
    if await active_run(session) is not None:
        raise AppError(409, "partner_sync_running", "이미 가져오는 중입니다. 끝난 뒤 다시 실행해 주세요.")
    since = None
    if mode == INCREMENTAL:
        last = await last_succeeded(session)
        if last is not None and last.as_of is not None:
            since = last.as_of - SINCE_OVERLAP
    run = PartnerMemberSyncRun(mode=mode, status=QUEUED, requested_by=requested_by, since=since)
    session.add(run)
    try:
        async with session.begin_nested():
            await session.flush()
    except IntegrityError as exc:  # 동시에 두 번 눌렀을 때 (QUEUED·RUNNING 하나만)
        raise AppError(409, "partner_sync_running", "이미 가져오는 중입니다. 끝난 뒤 다시 실행해 주세요.") from exc
    # 처리 도중 Worker가 죽으면 lease 뒤 한 번 더 실행돼 이어 받는다.
    await jobs.enqueue(
        session, JOB_KIND, {"run_id": run.id}, max_attempts=2, ref_type="partner_member_sync_run", ref_id=str(run.id)
    )
    return run


async def start_scheduled(session: AsyncSession) -> dict:
    """Worker 자동 주기: 설정돼 있고 실행 중인 회차가 없으면 변경분 가져오기를 넣는다."""
    if not is_configured() or settings.partner_sync_interval_minutes <= 0:
        return {}
    if await active_run(session) is not None:
        return {}
    try:
        run = await start(session, INCREMENTAL, None)
    except AppError:
        return {}
    await session.commit()
    return {"queued_run": run.id}


# ── 실행 (Worker 작업) ───────────────────────────────────────


@dataclass
class _Item:
    member_id: str
    site: str
    name: str
    email: str | None
    phone: str | None
    sponsor_member_id: str | None
    status: str
    joined_at: datetime
    membership_expires_on: date | None
    membership_active: bool
    partner_updated_at: datetime
    raw: dict


def _text(value: object) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        value = str(value)
    value = value.strip()
    return value or None


def _parse_datetime(value: object, field: str) -> datetime:
    if not isinstance(value, str):
        raise ValueError(f"{field} 없음")  # noqa: TRY004  항목 검사 실패는 모두 ValueError(사유)
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=KST)  # 명세: +09:00
    return parsed


def parse_item(raw: object) -> _Item:
    """제휴사 항목 하나를 검사·정리한다. 잘못된 항목은 ValueError(사유)."""
    if not isinstance(raw, dict):
        raise ValueError("항목 형식 오류")  # noqa: TRY004
    member_id = _text(raw.get("member_id"))
    if not member_id:
        raise ValueError("member_id 없음")
    if "@" in member_id:
        raise ValueError("member_id에 '@' 포함")
    site = _text(raw.get("site"))
    if site not in SITES:
        raise ValueError(f"알 수 없는 site: {site}")
    status = _text(raw.get("status"))
    if status not in STATUSES:
        raise ValueError(f"알 수 없는 status: {status}")
    email = _text(raw.get("email"))
    membership = raw.get("membership") if isinstance(raw.get("membership"), dict) else {}
    expires = _text(membership.get("expires_on"))
    try:
        joined_at = _parse_datetime(raw.get("joined_at"), "joined_at")
        updated_at = _parse_datetime(raw.get("updated_at"), "updated_at")
        expires_on = date.fromisoformat(expires) if expires else None
    except ValueError as exc:
        raise ValueError(f"날짜 형식 오류: {exc}") from exc
    return _Item(
        member_id=member_id,
        site=site,
        name=_text(raw.get("name")) or "",
        email=email.lower() if email else None,
        phone=_text(raw.get("phone")),
        sponsor_member_id=_text(raw.get("sponsor_id")),
        status=status,
        joined_at=joined_at,
        membership_expires_on=expires_on,
        membership_active=bool(membership.get("active")),
        partner_updated_at=updated_at,
        raw=raw,
    )


def _add_failure(run: PartnerMemberSyncRun, member_id: object, reason: str) -> None:
    run.failed += 1
    if len(run.failures) < MAX_FAILURES:
        run.failures = [*run.failures, {"member_id": str(member_id or "")[:100], "reason": reason[:300]}]


async def _apply_status_to_account(session: AsyncSession, run: PartnerMemberSyncRun, partner: PartnerMember) -> None:
    """제휴사 deleted를 연결된 Altos 계정 상태에 반영한다."""
    user = await session.scalar(select(User).where(User.partner_member_id == partner.member_id).with_for_update())
    if user is None or user.role != "USER":
        return
    if partner.status == DELETED:
        if user.status == "ACTIVE":
            await user_admin.change_status(session, user, "INACTIVE", REASON_DELETED, None)
            run.deactivated += 1
        return
    if user.status != "INACTIVE":
        return
    last_reason = await session.scalar(
        select(UserStatusHistory.reason)
        .where(UserStatusHistory.user_id == user.id)
        .order_by(UserStatusHistory.created_at.desc(), UserStatusHistory.id.desc())
        .limit(1)
    )
    if last_reason == REASON_DELETED:
        await user_admin.change_status(session, user, "ACTIVE", REASON_RESTORED, None)
        run.reactivated += 1


async def _save_page(session: AsyncSession, run: PartnerMemberSyncRun, items: list) -> None:
    parsed: dict[str, _Item] = {}
    for raw in items:
        try:
            item = parse_item(raw)
        except ValueError as exc:
            _add_failure(run, raw.get("member_id") if isinstance(raw, dict) else None, str(exc))
            continue
        parsed[item.member_id.lower()] = item  # 같은 페이지에 두 번 오면 뒤의 값
    if not parsed:
        return
    existing = {
        p.member_id.lower(): p
        for p in await session.scalars(
            select(PartnerMember).where(func.lower(PartnerMember.member_id).in_(list(parsed))).with_for_update()
        )
    }
    now = _now()
    for key, item in parsed.items():
        partner = existing.get(key)
        if partner is None:
            partner = PartnerMember(member_id=item.member_id, first_synced_at=now)
            session.add(partner)
            run.inserted += 1
        elif partner.partner_updated_at == item.partner_updated_at and partner.raw == item.raw:
            partner.last_synced_at = now
            run.unchanged += 1
            continue
        else:
            run.updated += 1
        status_changed = partner.status != item.status
        partner.site = item.site
        partner.name = item.name
        partner.email = item.email
        partner.phone = item.phone
        partner.sponsor_member_id = item.sponsor_member_id
        partner.status = item.status
        partner.joined_at = item.joined_at
        partner.membership_expires_on = item.membership_expires_on
        partner.membership_active = item.membership_active
        partner.partner_updated_at = item.partner_updated_at
        partner.raw = item.raw
        partner.last_synced_at = now
        partner.last_sync_run_id = run.id
        if status_changed or item.status == DELETED:
            await session.flush()
            await _apply_status_to_account(session, run, partner)


async def run(session: AsyncSession, run_id: int) -> dict:
    """회차 하나를 끝까지 실행한다. 페이지마다 커밋한다. 결과 건수를 돌려준다."""
    sync_run = await session.get(PartnerMemberSyncRun, run_id, with_for_update=True)
    if sync_run is None or sync_run.status not in (QUEUED, RUNNING):
        return {"skipped": True}
    sync_run.status = RUNNING
    sync_run.started_at = sync_run.started_at or _now()
    await session.commit()

    cursor = sync_run.last_cursor  # 중간에 멈췄던 회차는 이어서 받는다
    first = cursor is None
    try:
        while True:
            body = await fetch_page(sync_run.since, cursor, settings.partner_sync_page_size)
            if not isinstance(body, dict) or not isinstance(body.get("items"), list):
                raise PartnerApiError("제휴사 API 응답 형식이 다릅니다 (items 없음).")
            if first and sync_run.as_of is None and body.get("as_of"):
                sync_run.as_of = _parse_datetime(body["as_of"], "as_of")
            first = False
            sync_run.fetched += len(body["items"])
            await _save_page(session, sync_run, body["items"])
            sync_run.pages += 1
            has_more = bool(body.get("has_more")) and bool(body.get("next_cursor"))
            cursor = body.get("next_cursor") if has_more else None
            sync_run.last_cursor = cursor
            await session.commit()
            if not has_more:
                break
            if not is_mock():
                await asyncio.sleep(settings.partner_sync_request_gap_seconds)
    except Exception as exc:  # noqa: BLE001  이 회차는 실패로 끝내고 다음 주기에 같은 since로 다시 받는다
        await session.rollback()
        sync_run = await session.get(PartnerMemberSyncRun, run_id, with_for_update=True)
        assert sync_run is not None
        sync_run.status = FAILED
        sync_run.error = str(exc)[:2000] if isinstance(exc, PartnerApiError) else f"{exc.__class__.__name__}: {exc}"[:2000]
        sync_run.finished_at = _now()
        await session.commit()
        logger.warning("제휴사 회원 가져오기 실패 (run=%s): %s", run_id, sync_run.error)
        return {"status": FAILED}

    sync_run.status = SUCCEEDED
    sync_run.as_of = sync_run.as_of or sync_run.started_at
    sync_run.finished_at = _now()
    await session.commit()
    return {
        "status": SUCCEEDED,
        "fetched": sync_run.fetched,
        "inserted": sync_run.inserted,
        "updated": sync_run.updated,
        "failed": sync_run.failed,
        "deactivated": sync_run.deactivated,
        "reactivated": sync_run.reactivated,
    }


async def mark_failed(session: AsyncSession, run_id: int, error: str) -> None:
    sync_run = await session.get(PartnerMemberSyncRun, run_id, with_for_update=True)
    if sync_run is not None and sync_run.status in (QUEUED, RUNNING):
        sync_run.status = FAILED
        sync_run.error = error[:2000]
        sync_run.finished_at = _now()
