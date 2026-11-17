"""Google 로그인 (OAuth 2.0 인가 코드 + OpenID Connect).

흐름: 프론트 → GET /auth/google/login → Google 로그인 화면 → GET /auth/google/callback
→ 코드로 Google 토큰을 받아 ID 토큰을 검증 → 회원 찾기/만들기 → 사용자 웹으로 리다이렉트.

state에는 돌아갈 사용자 웹 주소와 임의 값(nonce)을 서명해 넣고, 같은 nonce를 쿠키에도 넣어
다른 사이트가 콜백을 위조해 호출하지 못하게 한다.
"""

import logging
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode, urlsplit

import httpx
import jwt
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.errors import AppError
from app.models import User
from app.services.signup import _generate_unique, generate_uid, normalize_email

logger = logging.getLogger(__name__)

AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
ISSUERS = ("https://accounts.google.com", "accounts.google.com")
STATE_TYPE = "google_oauth_state"
STATE_TTL_MINUTES = 10

_jwks_client: jwt.PyJWKClient | None = None


@dataclass
class GoogleProfile:
    sub: str
    email: str
    first_name: str | None
    last_name: str | None
    avatar_url: str | None


def ensure_configured() -> None:
    if not (settings.google_client_id and settings.google_client_secret and settings.google_redirect_uri):
        raise AppError(503, "google_login_not_configured", "Google 로그인이 아직 설정되지 않았습니다.")


def resolve_frontend_origin(state: str | None) -> str:
    """프론트가 넘긴 주소가 허용 목록에 있으면 그 주소로, 아니면 기본 사용자 웹으로 돌려보낸다."""
    if state:
        parts = urlsplit(state.strip())
        origin = f"{parts.scheme}://{parts.netloc}".rstrip("/")
        if parts.scheme in ("http", "https") and origin in settings.allowed_frontend_origins:
            return origin
    return settings.web_base_url.rstrip("/")


def create_state(frontend_origin: str) -> tuple[str, str]:
    """(state 값, 쿠키에 넣을 nonce)를 만든다."""
    nonce = secrets.token_urlsafe(24)
    now = datetime.now(UTC)
    state = jwt.encode(
        {
            "type": STATE_TYPE,
            "origin": frontend_origin,
            "nonce": nonce,
            "iat": now,
            "exp": now + timedelta(minutes=STATE_TTL_MINUTES),
        },
        settings.secret_key,
        algorithm="HS256",
    )
    return state, nonce


def read_state(state: str | None) -> dict | None:
    """서명이 맞고 만료되지 않은 state면 내용을, 아니면 None을 돌려준다."""
    if not state:
        return None
    try:
        payload = jwt.decode(state, settings.secret_key, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    if payload.get("type") != STATE_TYPE:
        return None
    return payload


def authorize_url(state: str, prompt: str | None) -> str:
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
    }
    if prompt in ("none", "consent", "select_account"):
        params["prompt"] = prompt
    return f"{AUTHORIZE_URL}?{urlencode(params)}"


def _verify_id_token(id_token: str) -> dict:
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = jwt.PyJWKClient(JWKS_URL, cache_keys=True)
    signing_key = _jwks_client.get_signing_key_from_jwt(id_token)
    return jwt.decode(
        id_token,
        signing_key.key,
        algorithms=["RS256"],
        audience=settings.google_client_id,
        issuer=ISSUERS,
        leeway=60,
    )


async def exchange_code(code: str) -> GoogleProfile:
    """인가 코드를 Google 토큰으로 바꾸고 ID 토큰을 검증해 프로필을 돌려준다."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.post(
                TOKEN_URL,
                data={
                    "code": code,
                    "client_id": settings.google_client_id,
                    "client_secret": settings.google_client_secret,
                    "redirect_uri": settings.google_redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
    except httpx.HTTPError as exc:
        logger.exception("Google 토큰 요청 실패")
        raise AppError(503, "google_unavailable", "Google에 연결하지 못했습니다.") from exc
    if res.status_code != 200:
        logger.warning("Google 토큰 교환 실패: %s %s", res.status_code, res.text[:300])
        raise AppError(400, "google_auth_failed", "Google 인증에 실패했습니다.")

    id_token = res.json().get("id_token")
    if not id_token:
        raise AppError(400, "google_auth_failed", "Google 인증에 실패했습니다.")
    try:
        claims = _verify_id_token(id_token)
    except (jwt.PyJWTError, jwt.PyJWKClientError) as exc:
        logger.warning("Google ID 토큰 검증 실패: %s", exc)
        raise AppError(400, "google_auth_failed", "Google 인증에 실패했습니다.") from exc

    if not claims.get("email") or claims.get("email_verified") is not True:
        raise AppError(400, "google_email_not_verified", "Google 계정의 이메일이 인증되지 않았습니다.")
    return GoogleProfile(
        sub=claims["sub"],
        email=claims["email"],
        first_name=claims.get("given_name"),
        last_name=claims.get("family_name"),
        avatar_url=claims.get("picture"),
    )


async def find_or_create_user(
    session: AsyncSession, profile: GoogleProfile, locale: str = "en"
) -> tuple[User, bool]:
    """같은 이메일 회원이 있으면 그 회원으로 로그인하고, 없으면 바로 가입시킨다 (기존 서버와 동일).

    Google이 인증한 이메일이므로 이메일 가입 회원도 같은 이메일이면 Google로 로그인할 수 있다.
    """
    email = normalize_email(profile.email)
    user = await session.scalar(select(User).where(User.email == email, User.status != "WITHDRAWN"))
    if user is not None:
        if user.email_verified_at is None:
            user.email_verified_at = datetime.now(UTC)
        if not user.avatar_url and profile.avatar_url:
            user.avatar_url = profile.avatar_url
        return user, False

    user = User(
        uid=await generate_uid(session),
        email=email,
        password_hash=None,
        auth_provider="GOOGLE",
        first_name=profile.first_name,
        last_name=profile.last_name,
        avatar_url=profile.avatar_url,
        email_verified_at=datetime.now(UTC),
        referral_code=await _generate_unique(session, User.referral_code, 8),
        # 기존 서버와 같이 Google 가입은 약관 동의로 본다 (로그인 화면에 약관 안내가 있다).
        agreed_to_terms=True,
        locale=locale,
    )
    session.add(user)
    try:
        await session.flush()
    except IntegrityError:
        # 같은 이메일로 동시에 가입한 경우: 먼저 만들어진 회원으로 로그인한다.
        await session.rollback()
        user = await session.scalar(select(User).where(User.email == email, User.status != "WITHDRAWN"))
        if user is None:
            raise
        return user, False
    return user, True
