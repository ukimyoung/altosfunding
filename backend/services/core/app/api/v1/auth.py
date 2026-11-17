from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_session
from app.deps import OptionalUser
from app.errors import AppError
from app.models import User
from app.schemas.auth import (
    EmailVerificationSendRequest,
    EmailVerifyRequest,
    LoginRequest,
    OkResponse,
    RefreshTokenRequest,
    RegisterRequest,
    TokenResponse,
    TwoFactorLoginRequest,
    TwoFactorRequiredResponse,
    UserOut,
    VerificationPurpose,
)
from app.services import auth, notify, signup, tokens, two_factor
from app.services.email import EmailSender, get_email_sender
from app.services.recaptcha import verify_recaptcha

router = APIRouter(prefix="/auth", tags=["auth"])

Session = Annotated[AsyncSession, Depends(get_session)]


REFRESH_COOKIE = "refreshToken"
TWO_FACTOR_COOKIE = "2fa_temp_token"
# 쿠키는 인증 API에만 실려 가도록 경로를 좁힌다 (기존 서버와 같음).
AUTH_COOKIE_PATH = "/api/v1/auth"


def _client_ip(request: Request) -> str | None:
    # Render 등 프록시 뒤에서는 X-Forwarded-For의 첫 번째 값이 실제 클라이언트다.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def _set_cookie(response: Response, key: str, value: str, max_age: int) -> None:
    response.set_cookie(
        key=key,
        value=value,
        max_age=max_age,
        path=AUTH_COOKIE_PATH,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
    )


def _delete_cookie(response: Response, key: str) -> None:
    response.delete_cookie(
        key=key,
        path=AUTH_COOKIE_PATH,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
    )


def _token_response(response: Response, result: auth.LoginResult) -> TokenResponse:
    assert result.access_token and result.refresh_token
    _set_cookie(response, REFRESH_COOKIE, result.refresh_token, tokens.refresh_cookie_max_age())
    user = result.user
    # refresh token은 쿠키로만 주고 응답 본문에는 넣지 않는다.
    return TokenResponse(
        access_token=result.access_token,
        user_id=str(user.id),
        role=user.role,
        first_name=user.first_name,
        last_name=user.last_name,
    )


def _locale(request: Request) -> str:
    return "ko" if request.headers.get("accept-language", "").lower().startswith("ko") else "en"


def _header_locale(request: Request) -> str | None:
    """웹이 보낸 화면 언어 (Accept-Language). 헤더가 없으면 None — 회원 언어를 바꾸지 않는다."""
    return _locale(request) if request.headers.get("accept-language") else None


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
    user: OptionalUser,
) -> OkResponse:
    """6자리 코드를 이메일로 보낸다 (30분 유효, 60초 안에는 다시 보낼 수 없음).

    - SIGNUP: 로그인 없이, reCAPTCHA 확인 후 미가입 이메일로 보낸다.
    - WITHDRAW_REQUEST: 로그인한 회원 본인 이메일로만 보낸다 (출금 신청 화면, reCAPTCHA 없음).
    """
    if body.purpose is VerificationPurpose.WITHDRAW_REQUEST:
        if user is None:
            raise AppError(401, "not_authenticated", "로그인이 필요합니다.")
        await signup.send_withdraw_code(session, sender, user, body.email, user.locale or "en")  # 회원 메일 언어
        return OkResponse(message_key="auth.email.verification_sent")
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
async def register(
    body: RegisterRequest,
    session: Session,
    request: Request,
    sender: Annotated[EmailSender, Depends(get_email_sender)],
) -> UserOut:
    """이메일 인증을 마친 뒤 호출한다. 가입이 끝나면 환영 메일을 보낸다."""
    out = await signup.register(session, body, _locale(request))
    await notify.welcome(session, sender, out.id)
    return out


@router.post(
    "/login",
    response_model=TokenResponse | TwoFactorRequiredResponse,
    response_model_exclude_none=False,
    summary="이메일 로그인",
)
async def login(
    body: LoginRequest, request: Request, response: Response, session: Session
) -> TokenResponse | TwoFactorRequiredResponse:
    """로그인하고 access token을 돌려준다. refresh token은 HttpOnly 쿠키로 설정한다.

    - 가입되지 않은 이메일: 404
    - 비밀번호 오류, 이용 정지 계정: 409
    - 2FA를 켠 회원: `requires_2fa: true`와 임시 토큰 쿠키(`2fa_temp_token`)를 주고,
      `POST /auth/2fa/login`에서 코드를 확인한 뒤 토큰을 발급한다.
    """
    await verify_recaptcha(body.recaptcha_token, _client_ip(request))
    result = await auth.login(
        session,
        body.email,
        body.password,
        _client_ip(request),
        request.headers.get("user-agent"),
        _header_locale(request),
    )
    if result.two_factor_temp_token:
        _set_cookie(
            response,
            TWO_FACTOR_COOKIE,
            result.two_factor_temp_token,
            settings.jwt_2fa_temp_expire_minutes * 60,
        )
        return TwoFactorRequiredResponse(
            user_id=str(result.user.id),
            message="2FA 인증이 필요합니다. POST /auth/2fa/login 으로 코드를 제출하세요.",
        )
    return _token_response(response, result)


@router.post("/refresh", response_model=TokenResponse, summary="토큰 갱신")
async def refresh(
    request: Request,
    response: Response,
    session: Session,
    body: RefreshTokenRequest | None = None,
    refresh_cookie: Annotated[str | None, Cookie(alias=REFRESH_COOKIE)] = None,
) -> TokenResponse:
    """refresh 쿠키로 새 access token을 받는다. refresh token도 새것으로 바뀐다."""
    raw = refresh_cookie or (body.refresh_token if body else None)
    if not raw:
        raise AppError(401, "invalid_refresh_token", "Refresh token is required")
    result = await auth.refresh(session, raw, _client_ip(request), request.headers.get("user-agent"))
    return _token_response(response, result)


@router.post("/logout", response_model=OkResponse, summary="로그아웃")
async def logout(
    response: Response,
    session: Session,
    refresh_cookie: Annotated[str | None, Cookie(alias=REFRESH_COOKIE)] = None,
) -> OkResponse:
    """현재 세션의 refresh token을 폐기하고 쿠키를 지운다."""
    await auth.logout(session, refresh_cookie)
    _delete_cookie(response, REFRESH_COOKIE)
    return OkResponse(message_key="auth.logout_success")


@router.post("/2fa/login", response_model=TokenResponse, summary="2FA 로그인 (TOTP/백업 코드)")
async def login_2fa(
    body: TwoFactorLoginRequest,
    request: Request,
    response: Response,
    session: Session,
    temp_cookie: Annotated[str | None, Cookie(alias=TWO_FACTOR_COOKIE)] = None,
) -> TokenResponse:
    """로그인 2단계: 임시 토큰(쿠키 우선, 없으면 body) + TOTP 또는 백업 코드로 정식 토큰을 받는다."""
    raw = temp_cookie or body.temp_token
    if not raw:
        raise AppError(401, "2fa_session_expired", "2FA 세션이 만료되었습니다. 다시 로그인해 주세요.")
    try:
        user_id = tokens.decode_token(raw, tokens.TWO_FACTOR_PENDING)
    except tokens.InvalidTokenError as exc:
        raise AppError(401, "2fa_session_expired", "2FA 세션이 만료되었습니다. 다시 로그인해 주세요.") from exc

    user = await session.get(User, user_id, with_for_update=True)
    if user is None or not user.is_2fa_enabled:
        raise AppError(401, "2fa_session_expired", "2FA 세션이 만료되었습니다. 다시 로그인해 주세요.")
    auth.ensure_can_sign_in(user)

    try:
        await two_factor.verify_code(session, user, body.code)
    except AppError as exc:
        if exc.error_code == "invalid_2fa_code":
            # 기존 서버와 같이 잘못된 코드는 401로 응답한다.
            raise AppError(401, "invalid_2fa_code", exc.message) from exc
        raise

    result = await auth.complete_login(
        session, user, _client_ip(request), request.headers.get("user-agent"), _header_locale(request)
    )
    _delete_cookie(response, TWO_FACTOR_COOKIE)
    return _token_response(response, result)
