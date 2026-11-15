from typing import Annotated

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.schemas.auth import (
    EmailVerificationSendRequest,
    EmailVerifyRequest,
    OkResponse,
    RegisterRequest,
    UserOut,
)
from app.services import signup
from app.services.email import EmailSender, get_email_sender
from app.services.recaptcha import verify_recaptcha

router = APIRouter(prefix="/auth", tags=["auth"])

Session = Annotated[AsyncSession, Depends(get_session)]


def _locale(request: Request) -> str:
    return "ko" if request.headers.get("accept-language", "").lower().startswith("ko") else "en"


@router.post(
    "/email/send-verification",
    status_code=status.HTTP_201_CREATED,
    response_model=OkResponse,
    summary="이메일 인증 코드 발송",
)
async def send_verification(
    body: EmailVerificationSendRequest,
    request: Request,
    session: Session,
    sender: Annotated[EmailSender, Depends(get_email_sender)],
) -> OkResponse:
    """6자리 코드를 이메일로 보낸다 (30분 유효, 60초 안에는 다시 보낼 수 없음)."""
    await verify_recaptcha(body.recaptcha_token, request.client.host if request.client else None)
    await signup.send_verification_code(session, sender, body.email, body.purpose, _locale(request))
    return OkResponse(message_key="auth.email.verification_sent")


@router.post("/email/verify", response_model=OkResponse, summary="이메일 인증 코드 확인")
async def verify_email(body: EmailVerifyRequest, session: Session) -> OkResponse:
    await signup.verify_code(session, body.email, body.code, body.purpose)
    return OkResponse(message_key="auth.email.verified")


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    response_model=UserOut,
    summary="회원가입",
)
async def register(body: RegisterRequest, session: Session) -> UserOut:
    """이메일 인증을 마친 뒤 호출한다."""
    return await signup.register(session, body)
