"""비밀번호 변경(로그인 상태)과 비밀번호 찾기·재설정(비로그인)."""

import logging
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.errors import AppError
from app.models import PasswordResetToken, User
from app.security import hash_password, sha256_hex, verify_password
from app.services import tokens
from app.services import email_template, partner_account
from app.services.email import EmailSender, EmailSendError
from app.services.signup import normalize_email

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(UTC)


async def change_password(
    session: AsyncSession,
    user: User,
    old_password: str,
    new_password: str,
    current_refresh_token: str | None,
) -> None:
    if user.auth_provider != "LOCAL" or not user.password_hash:
        raise AppError(400, "oauth_account_password_change", "Google 가입 계정은 비밀번호를 변경할 수 없습니다.")
    if not verify_password(old_password, user.password_hash):
        raise AppError(409, "invalid_current_password", "현재 비밀번호가 올바르지 않습니다.")
    user.password_hash = hash_password(new_password)
    # 지금 쓰는 세션만 남기고 다른 기기의 로그인은 끊는다.
    await tokens.revoke_all_for_user(session, user.id, keep_token=current_refresh_token)
    await session.commit()


def _mask(email: str) -> str:
    name, _, domain = email.partition("@")
    return f"{name[:2]}***@{domain}"


def reset_base_url(origin: str | None) -> str:
    """재설정 링크가 열릴 사용자 웹 주소.

    요청을 보낸 화면의 주소(Origin)가 허용 목록(WEB_BASE_URL, FRONTEND_ALLOWED_ORIGINS)에 있으면 그 주소를 쓴다.
    로컬 웹에서 요청했는데 링크가 다른 사이트로 가면 그 사이트의 /api가 다른 서버로 연결돼 재설정이 실패하기 때문이다.
    """
    if origin:
        candidate = origin.strip().rstrip("/")
        if candidate in settings.allowed_frontend_origins:
            return candidate
    return settings.web_base_url.rstrip("/")


async def request_reset(
    session: AsyncSession, sender: EmailSender, email: str, locale: str, origin: str | None = None
) -> None:
    """재설정 링크를 보낸다. 가입되지 않았거나 Google 가입 이메일이면 조용히 넘어간다 (이메일 존재 여부 노출 방지).

    조용히 넘어간 이유는 서버 로그에만 남긴다 (발송 이력에는 보낸 메일만 남는다).
    """
    identifier = email.strip()
    if partner_account.is_member_id(identifier):
        # 제휴사 Member ID: 그 계정의 현재 이메일로 보낸다 (같은 이메일의 다른 계정과 섞이지 않게 계정 기준).
        partner = await partner_account.find_partner(session, identifier)
        user = await partner_account.account_of(session, partner) if partner else None
        if user is None or user.status == "WITHDRAWN":
            logger.info("비밀번호 재설정 메일 미발송: 활성화되지 않은 Member ID (%s)", identifier[:2] + "***")
            return
        normalized = user.email
    else:
        normalized = normalize_email(identifier)
        user = await partner_account.find_standard_user(session, normalized)
        if user is None:
            logger.info("비밀번호 재설정 메일 미발송: 가입되지 않았거나 탈퇴한 이메일 (%s)", _mask(normalized))
            return
    if user.auth_provider not in ("LOCAL", "PARTNER"):
        logger.info("비밀번호 재설정 메일 미발송: %s 가입 계정 (%s)", user.auth_provider, _mask(normalized))
        return

    latest = await session.scalar(
        select(PasswordResetToken.created_at)
        .where(PasswordResetToken.user_id == user.id)
        .order_by(PasswordResetToken.created_at.desc())
        .limit(1)
    )
    if latest and latest > _now() - timedelta(seconds=settings.password_reset_cooldown_seconds):
        raise AppError(400, "rate_limit_exceeded", "잠시 후 다시 요청해 주세요.")

    # 이전에 보낸 링크는 모두 무효로 한다.
    await session.execute(
        update(PasswordResetToken)
        .where(PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None))
        .values(used_at=_now())
    )
    token = secrets.token_urlsafe(32)
    session.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=sha256_hex(token),
            expires_at=_now() + timedelta(minutes=settings.password_reset_ttl_minutes),
        )
    )
    await session.commit()
    reset_url = f"{reset_base_url(origin)}/reset-password?token={token}"
    variables = {"reset_url": reset_url, "expiry_minutes": settings.password_reset_ttl_minutes}
    mail = await email_template.render(session, "password_reset", locale, variables)
    try:
        if mail is not None:
            await sender.send(user.email, mail, "password_reset", {"reset_url": reset_url, "locale": locale, "user_id": str(user.id)})
    except EmailSendError:
        # 가입 여부를 드러내지 않도록 응답은 같게 두고 로그만 남긴다 (발송기에서 이미 기록).
        pass


async def reset_password(session: AsyncSession, token: str, new_password: str) -> None:
    stored = await session.scalar(
        select(PasswordResetToken)
        .where(PasswordResetToken.token_hash == sha256_hex(token))
        .with_for_update()
    )
    if stored is None or stored.used_at is not None:
        raise AppError(400, "invalid_reset_token", "Invalid or already used password reset token")
    if stored.expires_at <= _now():
        stored.used_at = _now()
        await session.commit()
        raise AppError(400, "reset_token_expired", "Password reset token has expired. Please request a new reset link.")

    user = await session.get(User, stored.user_id)
    if user is None or user.status == "WITHDRAWN":
        raise AppError(400, "invalid_reset_token", "Invalid or already used password reset token")

    user.password_hash = hash_password(new_password)
    stored.used_at = _now()
    # 비밀번호를 잊은 상황이므로 모든 기기의 로그인을 끊는다.
    await tokens.revoke_all_for_user(session, user.id)
    await session.commit()
