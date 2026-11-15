"""Google 로그인. 경로와 리다이렉트 규칙은 기존 서버와 같다."""

import logging
from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, Cookie, Query, Request
from fastapi.responses import RedirectResponse

from app.api.v1.auth import (
    REFRESH_COOKIE,
    TWO_FACTOR_COOKIE,
    Session,
    _client_ip,
    _delete_cookie,
    _set_cookie,
)
from app.config import settings
from app.errors import AppError
from app.services import auth, google_auth, tokens

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth/google", tags=["auth"])

NONCE_COOKIE = "google_oauth_nonce"


def _start(state: str | None, prompt: str | None) -> tuple[str, str]:
    google_auth.ensure_configured()
    origin = google_auth.resolve_frontend_origin(state)
    signed_state, nonce = google_auth.create_state(origin)
    return google_auth.authorize_url(signed_state, prompt), nonce


@router.get("/url", summary="Google 로그인 주소 만들기")
async def google_login_url(
    state: Annotated[str | None, Query(description="로그인 뒤 돌아갈 사용자 웹 주소")] = None,
    prompt: str | None = None,
) -> dict:
    """주소만 돌려준다. 브라우저가 이 주소로 이동하기 전에 nonce 쿠키가 필요하므로
    일반적으로는 `GET /auth/google/login`을 쓴다."""
    url, _ = _start(state, prompt)
    return {"url": url}


@router.get("/login", summary="Google 로그인 화면으로 이동")
async def google_login(
    state: Annotated[str | None, Query(description="로그인 뒤 돌아갈 사용자 웹 주소")] = None,
    prompt: str | None = None,
) -> RedirectResponse:
    """예: `/api/v1/auth/google/login?state=https://altosfunding.com&prompt=select_account`"""
    url, nonce = _start(state, prompt)
    response = RedirectResponse(url, status_code=302)
    _set_cookie(response, NONCE_COOKIE, nonce, google_auth.STATE_TTL_MINUTES * 60)
    return response


@router.get("/callback", summary="Google 로그인 콜백", include_in_schema=False)
async def google_callback(
    request: Request,
    session: Session,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    nonce_cookie: Annotated[str | None, Cookie(alias=NONCE_COOKIE)] = None,
) -> RedirectResponse:
    """Google이 돌려보내는 주소.

    - 로그인 성공: `{웹}/my-page?login_success=true` (신규 가입이면 `&welcome=true`), refresh 쿠키 설정
    - 2FA 회원: `{웹}/login/2fa`, 2FA 임시 토큰 쿠키 설정
    - 실패: `{웹}/login?error=google_auth_failed&detail=...`
    """
    payload = google_auth.read_state(state)
    origin = payload["origin"] if payload else settings.web_base_url.rstrip("/")

    def fail(detail: str) -> RedirectResponse:
        response = RedirectResponse(
            f"{origin}/login?error=google_auth_failed&detail={quote(detail)}", status_code=302
        )
        _delete_cookie(response, NONCE_COOKIE)
        return response

    if error:
        # 사용자가 Google 화면에서 취소한 경우 등
        return fail(error)
    if payload is None or not nonce_cookie or payload.get("nonce") != nonce_cookie or not code:
        return fail("invalid_state")

    try:
        google_auth.ensure_configured()
        profile = await google_auth.exchange_code(code)
        user, is_new = await google_auth.find_or_create_user(session, profile)
        auth.ensure_can_sign_in(user)
    except AppError as exc:
        await session.rollback()
        return fail(exc.error_code)

    welcome = "welcome=true" if is_new else ""
    if user.is_2fa_enabled:
        await session.commit()
        url = f"{origin}/login/2fa" + (f"?{welcome}" if welcome else "")
        response = RedirectResponse(url, status_code=302)
        _set_cookie(
            response,
            TWO_FACTOR_COOKIE,
            tokens.create_2fa_temp_token(user),
            settings.jwt_2fa_temp_expire_minutes * 60,
        )
    else:
        result = await auth.complete_login(
            session, user, _client_ip(request), request.headers.get("user-agent")
        )
        url = f"{origin}/my-page?login_success=true" + (f"&{welcome}" if welcome else "")
        response = RedirectResponse(url, status_code=302)
        _set_cookie(response, REFRESH_COOKIE, result.refresh_token, tokens.refresh_cookie_max_age())
    _delete_cookie(response, NONCE_COOKIE)
    return response
