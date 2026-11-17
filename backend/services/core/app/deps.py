"""인증 의존성. 라우터에서 Depends(get_current_user) / Depends(require_admin)으로 쓴다."""

from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.errors import AppError
from app.models import User
from app.services import tokens
from app.services.email import EmailSender, get_email_sender

_bearer = HTTPBearer(auto_error=False)

Session = Annotated[AsyncSession, Depends(get_session)]


async def get_current_user(
    session: Session,
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    if creds is None:
        raise AppError(401, "not_authenticated", "로그인이 필요합니다.")
    try:
        user_id = tokens.decode_token(creds.credentials, tokens.ACCESS)
    except tokens.InvalidTokenError as exc:
        raise AppError(401, "invalid_token", "로그인 정보가 만료되었습니다. 다시 로그인해 주세요.") from exc

    user = await session.get(User, user_id)
    if user is None or user.status == "WITHDRAWN":
        raise AppError(401, "user_not_found", "로그인 정보가 올바르지 않습니다.")
    if user.status != "ACTIVE":
        raise AppError(403, "account_deactivated", "Account is deactivated")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def get_optional_user(
    session: Session,
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User | None:
    """로그인하지 않아도 되는 API용. 토큰이 없거나 맞지 않으면 None (기존 서버와 같음)."""
    if creds is None:
        return None
    try:
        user_id = tokens.decode_token(creds.credentials, tokens.ACCESS)
    except tokens.InvalidTokenError:
        return None
    user = await session.get(User, user_id)
    if user is None or user.status != "ACTIVE":
        return None
    return user


OptionalUser = Annotated[User | None, Depends(get_optional_user)]


async def require_admin(user: CurrentUser) -> User:
    if user.role != "ADMIN":
        raise AppError(403, "forbidden", "Permission denied")
    return user


AdminUser = Annotated[User, Depends(require_admin)]

# 메일 발송기 (테스트에서는 dependency_overrides로 바꾼다)
Sender = Annotated[EmailSender, Depends(get_email_sender)]
