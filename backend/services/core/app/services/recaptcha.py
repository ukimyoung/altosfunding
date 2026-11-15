import logging

import httpx

from app.config import settings
from app.errors import AppError

logger = logging.getLogger(__name__)

VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify"


async def verify_recaptcha(token: str | None, remote_ip: str | None = None) -> None:
    """reCAPTCHA 토큰을 검증한다. 실패하면 AppError(400)를 던진다."""
    if not settings.recaptcha_secret_key:
        if settings.is_live:
            raise AppError(500, "RECAPTCHA_NOT_CONFIGURED", "reCAPTCHA가 설정되지 않았습니다.")
        logger.warning("RECAPTCHA_SECRET_KEY가 없어 reCAPTCHA 검증을 건너뜁니다 (%s).", settings.app_env)
        return

    if not token:
        raise AppError(400, "RECAPTCHA_REQUIRED", "reCAPTCHA 확인이 필요합니다.")

    data = {"secret": settings.recaptcha_secret_key, "response": token}
    if remote_ip:
        data["remoteip"] = remote_ip
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            res = await client.post(VERIFY_URL, data=data)
            body = res.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.exception("reCAPTCHA 검증 요청 실패")
        raise AppError(503, "RECAPTCHA_UNAVAILABLE", "reCAPTCHA 확인에 실패했습니다. 잠시 후 다시 시도해 주세요.") from exc

    # v3 토큰은 score가 있고, v2 토큰은 없다.
    score = body.get("score")
    if not body.get("success") or (score is not None and score < settings.recaptcha_min_score):
        raise AppError(400, "RECAPTCHA_FAILED", "reCAPTCHA 확인에 실패했습니다.")
