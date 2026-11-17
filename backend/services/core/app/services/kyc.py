"""KYC(본인 인증). Sumsub WebSDK를 쓴다.

1. 프론트가 `GET /auth/kyc/sumsub/token`으로 WebSDK 접근 토큰을 받아 인증 화면을 띄운다.
   Sumsub의 신청자(applicant)는 회원 id(externalUserId)로 묶인다.
2. 회원이 서류를 내면 Sumsub이 웹훅으로 결과를 보낸다.
   applicantPending → PENDING, applicantReviewed(GREEN) → APPROVED, (RED) → REJECTED.
3. 프론트는 `GET /auth/kyc/status`로 상태를 본다.
"""

import hashlib
import hmac
import json
import logging
import time
import uuid

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.errors import AppError
from app.models import User
from app.services.user_admin import _apply_kyc_status

logger = logging.getLogger(__name__)

ACCESS_TOKEN_TTL_SECONDS = 600

_DIGEST_ALGORITHMS = {
    "HMAC_SHA1_HEX": hashlib.sha1,
    "HMAC_SHA256_HEX": hashlib.sha256,
    "HMAC_SHA512_HEX": hashlib.sha512,
}


def status_out(user: User) -> dict:
    message_key = {
        "NONE": "kyc.status.none",
        "PENDING": "kyc.status.pending",
        "APPROVED": "kyc.status.approved",
        "REJECTED": "kyc.status.rejected",
    }.get(user.kyc_status, "kyc.status.none")
    return {
        "status": user.kyc_status,
        "message_key": message_key,
        "reject_reason": user.kyc_reject_reason if user.kyc_status == "REJECTED" else None,
    }


def _ensure_configured() -> None:
    if not (settings.sumsub_app_token and settings.sumsub_secret_key):
        raise AppError(503, "kyc_not_configured", "본인 인증 서비스가 아직 설정되지 않았습니다.")


def _signed_headers(method: str, path_with_query: str, body: bytes) -> dict[str, str]:
    ts = str(int(time.time()))
    message = ts.encode() + method.upper().encode() + path_with_query.encode() + body
    signature = hmac.new(settings.sumsub_secret_key.encode(), message, hashlib.sha256).hexdigest()
    return {
        "X-App-Token": settings.sumsub_app_token,
        "X-App-Access-Ts": ts,
        "X-App-Access-Sig": signature,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


async def access_token(user: User) -> str:
    _ensure_configured()
    if user.kyc_status == "APPROVED":
        raise AppError(409, "kyc_already_approved", "이미 본인 인증이 끝났습니다.")
    if user.kyc_status == "PENDING":
        raise AppError(409, "kyc_pending", "본인 인증 심사 중입니다.")

    path = "/resources/accessTokens/sdk"
    body = json.dumps(
        {"userId": str(user.id), "levelName": settings.sumsub_level_name, "ttlInSecs": ACCESS_TOKEN_TTL_SECONDS}
    ).encode()
    try:
        async with httpx.AsyncClient(base_url=settings.sumsub_base_url, timeout=10) as client:
            res = await client.post(path, content=body, headers=_signed_headers("POST", path, body))
    except httpx.HTTPError as exc:
        logger.exception("Sumsub 토큰 요청 실패")
        raise AppError(503, "kyc_unavailable", "본인 인증 서비스에 연결하지 못했습니다.") from exc
    if res.status_code != 200:
        logger.warning("Sumsub 토큰 발급 실패: %s %s", res.status_code, res.text[:300])
        raise AppError(502, "kyc_token_failed", "본인 인증을 시작하지 못했습니다.")
    token = res.json().get("token")
    if not token:
        raise AppError(502, "kyc_token_failed", "본인 인증을 시작하지 못했습니다.")
    return token


def verify_webhook(body: bytes, digest: str | None, algorithm: str | None) -> None:
    if not settings.sumsub_webhook_secret:
        raise AppError(503, "kyc_not_configured", "SUMSUB_WEBHOOK_SECRET이 설정되지 않았습니다.")
    hash_fn = _DIGEST_ALGORITHMS.get(algorithm or "HMAC_SHA256_HEX")
    if hash_fn is None or not digest:
        raise AppError(401, "invalid_signature", "invalid signature")
    expected = hmac.new(settings.sumsub_webhook_secret.encode(), body, hash_fn).hexdigest()
    if not hmac.compare_digest(expected, digest.lower()):
        raise AppError(401, "invalid_signature", "invalid signature")


def _reject_reason(review: dict) -> str | None:
    return review.get("moderationComment") or review.get("clientComment") or None


async def handle_webhook(session: AsyncSession, payload: dict) -> tuple[User, str] | None:
    """상태를 반영한다. 회원을 찾았으면 (회원, 바뀌기 전 KYC 상태)를 돌려준다 (안내 메일용)."""
    event = payload.get("type")
    external_user_id = payload.get("externalUserId")
    try:
        user_id = uuid.UUID(str(external_user_id))
    except (TypeError, ValueError):
        logger.warning("Sumsub 웹훅: 알 수 없는 externalUserId %s (%s)", external_user_id, event)
        return None
    user = await session.get(User, user_id, with_for_update=True)
    if user is None:
        logger.warning("Sumsub 웹훅: 회원 없음 %s (%s)", external_user_id, event)
        return None
    before = user.kyc_status

    if event in ("applicantPending", "applicantOnHold"):
        _apply_kyc_status(user, "PENDING")
    elif event == "applicantReviewed":
        review = payload.get("reviewResult") or {}
        if review.get("reviewAnswer") == "GREEN":
            _apply_kyc_status(user, "APPROVED")
        elif review.get("reviewAnswer") == "RED":
            _apply_kyc_status(user, "REJECTED")
            user.kyc_reject_reason = _reject_reason(review)
    elif event == "applicantReset":
        user.kyc_status = "NONE"
        user.kyc_reject_reason = None
    else:
        logger.info("Sumsub 웹훅 무시: %s", event)
    return user, before

