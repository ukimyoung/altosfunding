"""메일 발송 이력 조회 (백오피스 '이메일/알림 관리 > 발송 이력').

이력은 app.services.email.LoggingEmailSender가 메일 한 통마다 남긴다.
"""

import uuid

from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import AppError
from app.models import EmailLog, EmailTemplate, ManualEmailJob, User
from app.services.wallet import day_range

STATUSES = ("SENT", "FAILED")


def _filters(event_type, status, keyword, start_date, end_date, trace_id=None) -> list:
    conditions = []
    if trace_id:
        try:
            conditions.append(EmailLog.batch_id == uuid.UUID(str(trace_id)))
        except ValueError:
            raise AppError(422, "invalid_trace_id", "묶음 id 형식이 올바르지 않습니다.") from None
    if event_type:
        conditions.append(EmailLog.template_id == event_type)
    if status:
        if status not in STATUSES:
            raise AppError(422, "invalid_status", "상태는 SENT 또는 FAILED입니다.")
        conditions.append(EmailLog.status == status)
    if keyword and keyword.strip():
        like = f"%{keyword.strip().lower()}%"
        conditions.append(
            or_(
                func.lower(EmailLog.recipient).like(like),
                func.lower(EmailLog.subject).like(like),
            )
        )
    start, end = day_range(start_date, end_date)  # 날짜는 KST 기준
    if start:
        conditions.append(EmailLog.created_at >= start)
    if end:
        conditions.append(EmailLog.created_at < end)
    return conditions


async def _templates(session: AsyncSession, ids: set[str]) -> dict[str, EmailTemplate]:
    if not ids:
        return {}
    rows = await session.scalars(select(EmailTemplate).where(EmailTemplate.id.in_(ids)))
    return {t.id: t for t in rows}


# DB 템플릿이 없는 발송 (수동 발송 등)
_BUILTIN_EVENTS = {"manual_send": ("수동 발송", "관리자가 직접 작성해 보낸 메일")}


def _template_fields(template: EmailTemplate | None, template_id: str | None = None) -> dict:
    builtin = _BUILTIN_EVENTS.get(template_id or "")
    if template is None and builtin:
        return {"template_name": builtin[0], "event_name": builtin[1], "send_mode": "manual", "delay_minutes": 0}
    return {
        "template_name": template.name if template else None,
        "event_name": template.description if template else None,
        "send_mode": template.send_mode if template else "instant",
        "delay_minutes": template.delay_minutes if template else 0,
    }


async def list_logs(
    session: AsyncSession,
    *,
    event_type: str | None,
    status: str | None,
    keyword: str | None,
    start_date: str | None,
    end_date: str | None,
    group_by_batch: bool,
    trace_id: str | None = None,
    page: int,
    page_size: int,
) -> dict:
    conditions = _filters(event_type, status, keyword, start_date, end_date, trace_id)
    summary_row = (
        await session.execute(
            select(
                func.count(),
                func.count().filter(EmailLog.status == "SENT"),
                func.count().filter(EmailLog.status == "FAILED"),
            ).where(*conditions)
        )
    ).one()
    summary = {
        "total": summary_row[0],
        "sent": summary_row[1],
        "failed": summary_row[2],
    }

    if group_by_batch:
        sent_at = func.max(EmailLog.created_at)
        stmt = (
            select(
                EmailLog.batch_id,
                func.min(EmailLog.id).label("first_id"),
                func.min(EmailLog.template_id).label("template_id"),
                func.min(EmailLog.subject).label("subject"),
                func.count().label("total"),
                func.count().filter(EmailLog.status == "SENT").label("sent"),
                func.count().filter(EmailLog.status == "FAILED").label("failed"),
                func.min(EmailLog.recipient).label("recipient"),
                sent_at.label("sent_at"),
            )
            .where(*conditions)
            .group_by(EmailLog.batch_id)
        )
        total = await session.scalar(select(func.count()).select_from(stmt.subquery()))
        rows = (
            await session.execute(
                stmt.order_by(sent_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        ).all()
        templates = await _templates(session, {r.template_id for r in rows})
        # 수동 발송 묶음은 회원 이름을 넣기 전의 원래 제목과 즉시/예약 여부를 보여 준다
        jobs = {
            j.id: j
            for j in await session.scalars(
                select(ManualEmailJob).where(ManualEmailJob.id.in_([r.batch_id for r in rows]))
            )
        } if rows else {}
        items = [
            {
                # 한 통뿐인 묶음은 그 이력 id로 바로 상세를 연다
                "id": r.first_id if r.total == 1 else None,
                "trace_id": str(r.batch_id),
                "event_type": r.template_id,
                "subject": r.subject,
                "recipient": r.recipient if r.total == 1 else None,
                "total_count": r.total,
                "success_count": r.sent,
                "failed_count": r.failed,
                # 묶음 상태: 모두 성공 SENT, 모두 실패 FAILED, 섞여 있으면 PARTIAL
                "status": "SENT" if not r.failed else ("FAILED" if not r.sent else "PARTIAL"),
                "sent_at": r.sent_at.isoformat(),
                **_template_fields(templates.get(r.template_id), r.template_id),
                **_job_fields(jobs.get(r.batch_id)),
            }
            for r in rows
        ]
    else:
        total = summary["total"]
        logs = list(
            await session.scalars(
                select(EmailLog)
                .where(*conditions)
                .order_by(EmailLog.created_at.desc(), EmailLog.id.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        )
        templates = await _templates(session, {log.template_id for log in logs})
        items = [_log_item(log, templates.get(log.template_id)) for log in logs]
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "summary": summary,
        "items": items,
    }


def _job_fields(job: ManualEmailJob | None) -> dict:
    if job is None:
        return {}
    return {"subject": job.subject, "send_mode": "scheduled" if job.send_at else "instant"}


def _log_item(log: EmailLog, template: EmailTemplate | None) -> dict:
    ok = log.status == "SENT"
    return {
        "id": log.id,
        "trace_id": str(log.batch_id),
        "event_type": log.template_id,
        "subject": log.subject,
        "recipient": log.recipient,
        "user_id": str(log.user_id) if log.user_id else None,
        "locale": log.locale,
        "status": log.status,
        "error_message": log.error_message,
        "provider": log.provider,
        "provider_message_id": log.provider_message_id,
        "total_count": 1,
        "success_count": 1 if ok else 0,
        "failed_count": 0 if ok else 1,
        "sent_at": log.created_at.isoformat(),
        **_template_fields(template, log.template_id),
    }


async def get_log(session: AsyncSession, log_id: int) -> dict:
    log = await session.get(EmailLog, log_id)
    if log is None:
        raise AppError(404, "log_not_found", "발송 이력을 찾을 수 없습니다.")
    template = await session.get(EmailTemplate, log.template_id)
    item = _log_item(log, template)
    user = await session.get(User, log.user_id) if log.user_id else None
    item["user_uid"] = user.uid if user else None
    return item


async def list_event_types(session: AsyncSession) -> list[dict]:
    """필터 드롭다운용: 등록된 템플릿 + 이력에만 남은 템플릿 코드."""
    templates = list(
        await session.scalars(
            select(EmailTemplate).order_by(
                case((EmailTemplate.is_system, 0), else_=1),
                EmailTemplate.created_at,
                EmailTemplate.id,
            )
        )
    )
    known = {t.id for t in templates}
    events = [{"id": t.id, "name": t.name} for t in templates]
    extra = await session.scalars(
        select(EmailLog.template_id)
        .distinct()
        .where(EmailLog.template_id.not_in(known) if known else True)
    )
    events += [
        {"id": tid, "name": _BUILTIN_EVENTS.get(tid, (tid,))[0]} for tid in sorted(extra)
    ]
    return events

