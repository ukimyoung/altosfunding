"""고객 문의(Contact Us).

사용자 웹 'My Page > Contact Us'와 랜딩 푸터 문의 폼이 남긴 문의를 백오피스 '운영 관리 > 문의하기'에서 답한다.
상태: RECEIVED(접수) → PROCESSING(답변 임시저장) → ANSWERED(답변 전송, 이후 수정 불가).
기존 서버와 같이 답변을 보내면 문의자 이메일로 답변 메일을 보낸다.
"""

import logging
import math
from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import AppError
from app.models import ContactMessage, User
from app.schemas.contact import ContactSubmitRequest, InquiryDetailOut, InquiryListItem
from app.services import contact_category
from app.services.email import EmailSender

logger = logging.getLogger(__name__)

RECEIVED = "RECEIVED"
PROCESSING = "PROCESSING"
ANSWERED = "ANSWERED"


async def submit(
    session: AsyncSession, sender: EmailSender, body: ContactSubmitRequest, user: User | None, locale: str
) -> ContactMessage:
    await contact_category.ensure_exists(session, body.category)
    contact = ContactMessage(
        user_id=user.id if user else None,
        name=body.name.strip(),
        email=str(body.email).strip(),
        category=body.category,
        subject=body.subject.strip(),
        message=body.message.strip(),
        locale=locale,
        status=RECEIVED,
    )
    if not contact.name or not contact.subject or not contact.message:
        raise AppError(422, "validation_error", "이름, 제목, 내용을 입력해 주세요.")
    session.add(contact)
    await session.commit()
    await session.refresh(contact)
    try:
        await sender.send_contact_received(contact.email, contact.name, contact.subject, contact.id, locale)
    except Exception:  # 메일 실패로 문의 접수를 실패시키지 않는다.
        logger.exception("문의 접수 메일 발송 실패 (#%s)", contact.id)
    return contact


def _list_item(c: ContactMessage) -> InquiryListItem:
    return InquiryListItem(
        id=c.id, name=c.name, email=c.email, subject=c.subject,
        category=c.category, status=c.status, created_at=c.created_at,  # type: ignore[arg-type]
    )


async def _detail(session: AsyncSession, c: ContactMessage) -> InquiryDetailOut:
    replied_by_name = None
    if c.replied_by:
        admin = await session.get(User, c.replied_by)
        if admin:
            replied_by_name = " ".join(p for p in (admin.first_name, admin.last_name) if p).strip() or admin.email
    return InquiryDetailOut(
        **_list_item(c).model_dump(),
        message=c.message,
        reply_draft=c.reply_draft,
        reply_body=c.reply_body,
        replied_at=c.replied_at,
        replied_by=str(c.replied_by) if c.replied_by else None,
        replied_by_name=replied_by_name,
        user_id=str(c.user_id) if c.user_id else None,
    )


async def list_admin(
    session: AsyncSession, *, keyword: str | None, category: str | None, status: str | None, page: int, size: int
) -> dict:
    stmt = select(ContactMessage)
    if keyword and keyword.strip():
        # 기존 서버와 같이 이름·제목만 검색한다 (이메일 제외).
        pattern = f"%{keyword.strip()}%"
        stmt = stmt.where(or_(ContactMessage.name.ilike(pattern), ContactMessage.subject.ilike(pattern)))
    if category:
        stmt = stmt.where(ContactMessage.category == category)
    if status:
        stmt = stmt.where(ContactMessage.status == status)

    total = await session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = (
        await session.scalars(
            stmt.order_by(ContactMessage.created_at.desc(), ContactMessage.id.desc())
            .offset((page - 1) * size)
            .limit(size)
        )
    ).all()
    unanswered = await session.scalar(
        select(func.count()).select_from(ContactMessage).where(ContactMessage.status.in_([RECEIVED, PROCESSING]))
    ) or 0
    return {
        "items": [_list_item(r) for r in rows],
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if total else 0,
        "unanswered_count": unanswered,
    }


async def _get(session: AsyncSession, contact_id: int, lock: bool = False) -> ContactMessage:
    stmt = select(ContactMessage).where(ContactMessage.id == contact_id)
    if lock:
        stmt = stmt.with_for_update()
    contact = await session.scalar(stmt)
    if contact is None:
        raise AppError(404, "contact_not_found", "문의를 찾을 수 없습니다.")
    return contact


async def get_admin(session: AsyncSession, contact_id: int) -> InquiryDetailOut:
    """상세 조회는 상태를 바꾸지 않는다."""
    return await _detail(session, await _get(session, contact_id))


async def save_draft(session: AsyncSession, contact_id: int, draft: str) -> InquiryDetailOut:
    contact = await _get(session, contact_id, lock=True)
    if contact.status == ANSWERED:
        raise AppError(409, "contact_already_answered", "이미 답변을 보낸 문의입니다.")
    contact.reply_draft = draft
    if contact.status == RECEIVED:
        contact.status = PROCESSING
    await session.commit()
    await session.refresh(contact)
    return await _detail(session, contact)


async def reply(
    session: AsyncSession, sender: EmailSender, contact_id: int, reply_body: str, admin: User
) -> InquiryDetailOut:
    contact = await _get(session, contact_id, lock=True)
    if contact.status == ANSWERED:
        raise AppError(409, "contact_already_answered", "이미 답변을 보낸 문의입니다.")
    body = reply_body.strip()
    if not body:
        raise AppError(400, "reply_body_required", "답변 내용을 입력해 주세요.")

    contact.reply_body = body
    contact.reply_draft = None
    contact.replied_at = datetime.now(UTC)
    contact.replied_by = admin.id
    contact.status = ANSWERED
    await session.commit()
    await session.refresh(contact)

    try:
        await sender.send_contact_replied(
            contact.email, contact.name, contact.subject, contact.message, body, contact.id, contact.locale
        )
    except Exception:  # 답변은 저장됐으므로 메일 실패는 로그만 남긴다.
        logger.exception("문의 답변 메일 발송 실패 (#%s)", contact.id)
    return await _detail(session, contact)
