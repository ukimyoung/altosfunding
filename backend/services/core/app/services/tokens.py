"""JWT access token과 DB에 저장하는 refresh token."""

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

import jwt
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import RefreshToken, User

ALGORITHM = "HS256"
ACCESS = "access"
TWO_FACTOR_PENDING = "2fa_pending"


class InvalidTokenError(Exception):
    pass


def _now() -> datetime:
    return datetime.now(UTC)


def create_access_token(user: User) -> str:
    now = _now()
    payload = {
        "sub": str(user.id),
        "role": user.role,
        "type": ACCESS,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_access_expire_minutes),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def create_2fa_temp_token(user: User) -> str:
    now = _now()
    payload = {
        "sub": str(user.id),
        "type": TWO_FACTOR_PENDING,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_2fa_temp_expire_minutes),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def decode_token(token: str, expected_type: str) -> uuid.UUID:
    """서명·만료·종류를 확인하고 회원 id를 돌려준다."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        if payload.get("type") != expected_type:
            raise InvalidTokenError("wrong token type")
        return uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise InvalidTokenError(str(exc)) from exc


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def issue_refresh_token(
    session: AsyncSession, user: User, ip_address: str | None, user_agent: str | None
) -> str:
    """새 refresh token을 만들어 세션에 추가한다. 커밋은 호출한 쪽에서 한다."""
    token = secrets.token_urlsafe(48)
    session.add(
        RefreshToken(
            user_id=user.id,
            token_hash=_hash(token),
            expires_at=_now() + timedelta(days=settings.jwt_refresh_expire_days),
            ip_address=ip_address,
            user_agent=user_agent[:500] if user_agent else None,
        )
    )
    return token


async def find_refresh_token(session: AsyncSession, token: str) -> RefreshToken | None:
    from sqlalchemy import select

    return await session.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == _hash(token)).with_for_update()
    )


async def revoke_all_for_user(session: AsyncSession, user_id: uuid.UUID) -> None:
    await session.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=_now())
    )


def refresh_cookie_max_age() -> int:
    return settings.jwt_refresh_expire_days * 24 * 60 * 60
