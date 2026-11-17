"""회원 알림 메일 (입출금·KYC·회원 상태 등).

업무 처리(DB 커밋)가 끝난 뒤 부른다. 메일이 실패해도 업무 결과는 그대로 두고 로그만 남긴다.
템플릿은 백오피스 '템플릿 관리'의 DB 템플릿을 쓰고, 사용 안 함으로 꺼 두면 보내지 않는다.

언어: 회원 언어(core.users.locale)로 보낸다. 회원 언어는 가입·로그인 때와 웹에서 언어를 바꿀 때 저장된다.
회원이 직접 한 요청(출금 신청·본인 탈퇴)은 그 요청의 화면 언어(Accept-Language)를 쓴다.
"""

import logging
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import User
from app.services import email_template
from app.services.email import EmailSender

logger = logging.getLogger(__name__)

DEFAULT_NOTIFY_LOCALE = "en"


def user_name(user: User) -> str:
    name = " ".join(p for p in (user.first_name, user.last_name) if p and p.strip()).strip()
    return name or user.email


def amount_text(value: Decimal | float | None) -> str:
    return f"{Decimal(str(value or 0)):,.2f}"


def time_text(value: datetime | None) -> str:
    return value.strftime("%Y-%m-%d %H:%M UTC") if value else "-"


def login_url() -> str:
    return f"{settings.web_base_url.rstrip('/')}/login"


async def send(
    session: AsyncSession,
    sender: EmailSender,
    to: str,
    template_id: str,
    variables: dict[str, Any],
    *,
    locale: str = DEFAULT_NOTIFY_LOCALE,
    meta: dict | None = None,
) -> bool:
    """메일을 보낸다. 보냈으면 True, 꺼져 있거나 실패하면 False (예외를 올리지 않는다)."""
    try:
        mail = await email_template.render(session, template_id, locale, variables)
        if mail is None:
            logger.info("메일 템플릿이 꺼져 있어 보내지 않음: %s → %s", template_id, to)
            return False
        await sender.send(to, mail, template_id, {"locale": locale, **(meta or {})})
        return True
    except Exception:
        logger.exception("알림 메일 발송 실패: %s → %s", template_id, to)
        return False


async def to_user(
    session: AsyncSession,
    sender: EmailSender,
    user: User,
    template_id: str,
    variables: dict[str, Any] | None = None,
    *,
    locale: str | None = None,
    meta: dict | None = None,
) -> bool:
    """회원에게 보낸다. locale을 주지 않으면 회원 언어."""
    locale = locale or user.locale or DEFAULT_NOTIFY_LOCALE
    if user.status == "WITHDRAWN" or user.email.endswith("@deleted.local"):
        return False
    values = {"user_name": user_name(user), **(variables or {})}
    return await send(session, sender, user.email, template_id, values, locale=locale, meta={"user_id": str(user.id), **(meta or {})})


async def kyc_changed(session: AsyncSession, sender: EmailSender, user: User, before: str) -> None:
    """KYC 상태가 승인·반려로 바뀌었으면 안내 메일을 보낸다."""
    if user.kyc_status == before:
        return
    if user.kyc_status == "APPROVED":
        await to_user(session, sender, user, "kyc_approved")
    elif user.kyc_status == "REJECTED":
        reason = user.kyc_reject_reason or "-"
        await to_user(session, sender, user, "kyc_rejected", {"reason": reason})


async def welcome(session: AsyncSession, sender: EmailSender, user_id: Any) -> None:
    """회원가입 환영 메일 (가입 때 저장한 회원 언어)."""
    user = await session.get(User, user_id)
    if user is not None:
        await to_user(session, sender, user, "user_registered", {"login_url": login_url()})
