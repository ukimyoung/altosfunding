"""로그인, 토큰 재발급, 로그아웃."""

from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import AppError
from app.models import LoginHistory, User
from app.security import verify_password
from app.services import partner_account, tokens


@dataclass
class LoginResult:
    user: User
    access_token: str | None = None
    refresh_token: str | None = None
    # 2FA를 켠 회원은 정식 토큰 대신 임시 토큰만 받는다.
    two_factor_temp_token: str | None = None


def _now() -> datetime:
    return datetime.now(UTC)


def ensure_can_sign_in(user: User) -> None:
    if user.status != "ACTIVE":
        # 기존 서버와 같이 409로 응답한다 (프론트는 409를 로그인 실패로 보여 준다).
        raise AppError(409, "account_deactivated", "Account is deactivated")


async def login(
    session: AsyncSession,
    email: str,
    password: str,
    ip_address: str | None,
    user_agent: str | None,
    locale: str | None = None,
) -> LoginResult:
    """email에는 이메일 또는 제휴사 Member ID가 온다 (`@`가 없으면 Member ID)."""
    identifier = email.strip()
    # 프론트는 404를 "가입되지 않은 이메일", 409를 "비밀번호 오류"로 보여 준다 (기존 서버와 동일).
    if partner_account.is_member_id(identifier):
        partner = await partner_account.find_partner(session, identifier)
        if partner is None:
            raise AppError(404, "not_found", "user not found")
        user = await partner_account.account_of(session, partner)
        if user is None or user.status == "WITHDRAWN":
            # 아직 Altos 계정이 없다: 비밀번호는 보지 않고 활성화 단계로 안내한다.
            partner_account.ensure_activatable(partner)
            raise partner_account.activation_required_error(partner)
    else:
        user = await partner_account.find_standard_user(session, identifier)
        if user is None:
            if await partner_account.has_partner_account_with_email(session, identifier):
                raise AppError(404, "partner_use_member_id", "제휴사 회원은 Member ID로 로그인해 주세요.")
            raise AppError(404, "not_found", "user not found")

    if not user.password_hash or not verify_password(password, user.password_hash):
        raise AppError(409, "invalid_credentials", "Invalid password")

    ensure_can_sign_in(user)

    if user.email_verified_at is None and user.role != "ADMIN":
        raise AppError(409, "email_not_verified", "Email not verified. Please verify your email first.")

    if user.is_2fa_enabled:
        return LoginResult(user=user, two_factor_temp_token=tokens.create_2fa_temp_token(user))

    return await complete_login(session, user, ip_address, user_agent, locale)


async def complete_login(
    session: AsyncSession,
    user: User,
    ip_address: str | None,
    user_agent: str | None,
    locale: str | None = None,
) -> LoginResult:
    """비밀번호(와 2FA) 확인을 마친 회원에게 토큰을 발급하고 로그인 이력을 남긴다.

    locale을 주면 회원 언어로 저장한다 (로그인한 웹 화면의 언어).
    """
    if locale in ("en", "ko"):
        user.locale = locale
    user.last_login_at = _now()
    user.last_login_ip = ip_address
    session.add(
        LoginHistory(
            user_id=user.id,
            ip_address=ip_address,
            user_agent=user_agent[:500] if user_agent else None,
        )
    )
    refresh_token = tokens.issue_refresh_token(session, user, ip_address, user_agent)
    await session.commit()
    return LoginResult(
        user=user,
        access_token=tokens.create_access_token(user),
        refresh_token=refresh_token,
    )


async def refresh(
    session: AsyncSession, raw_token: str, ip_address: str | None, user_agent: str | None
) -> LoginResult:
    stored = await tokens.find_refresh_token(session, raw_token)
    if stored is None or stored.expires_at <= _now():
        raise AppError(401, "invalid_refresh_token", "Invalid or expired refresh token")

    if stored.revoked_at is not None:
        # 이미 바꾼 토큰이 다시 들어왔다 = 토큰이 새어 나갔을 수 있다. 모든 세션을 끊는다.
        await tokens.revoke_all_for_user(session, stored.user_id)
        await session.commit()
        raise AppError(401, "invalid_refresh_token", "Invalid or expired refresh token")

    user = await session.get(User, stored.user_id)
    if user is None:
        raise AppError(401, "invalid_refresh_token", "Invalid or expired refresh token")
    if user.status != "ACTIVE":
        stored.revoked_at = _now()
        await session.commit()
        raise AppError(401, "account_deactivated", "Account is deactivated")

    stored.revoked_at = _now()
    new_refresh = tokens.issue_refresh_token(session, user, ip_address, user_agent)
    await session.commit()
    return LoginResult(
        user=user, access_token=tokens.create_access_token(user), refresh_token=new_refresh
    )


async def logout(session: AsyncSession, raw_token: str | None) -> None:
    if not raw_token:
        return
    stored = await tokens.find_refresh_token(session, raw_token)
    if stored is not None and stored.revoked_at is None:
        stored.revoked_at = _now()
        await session.commit()
