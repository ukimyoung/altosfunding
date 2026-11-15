"""KYC(본인 인증) API. 경로와 응답 형태는 기존 서버와 같다."""

import json
from typing import Annotated

from fastapi import APIRouter, Header, Request
from pydantic import BaseModel

from app.api.v1.auth import Session
from app.deps import CurrentUser
from app.errors import AppError
from app.services import kyc

router = APIRouter(tags=["kyc"])


class KycStatusResponse(BaseModel):
    status: str
    message_key: str
    reject_reason: str | None = None


class SumsubTokenResponse(BaseModel):
    ok: bool
    token: str


@router.get("/auth/kyc/status", response_model=KycStatusResponse, summary="내 본인 인증 상태")
async def kyc_status(user: CurrentUser) -> KycStatusResponse:
    """NONE(미제출) / PENDING(심사 중) / APPROVED(완료) / REJECTED(반려, reject_reason 포함)"""
    return KycStatusResponse(**kyc.status_out(user))


@router.get("/auth/kyc/sumsub/token", response_model=SumsubTokenResponse, summary="Sumsub WebSDK 접근 토큰")
async def sumsub_token(user: CurrentUser) -> SumsubTokenResponse:
    """인증 화면을 열 때마다 새로 받는다 (10분 유효)."""
    return SumsubTokenResponse(ok=True, token=await kyc.access_token(user))


@router.post("/webhooks/sumsub", summary="Sumsub 웹훅", include_in_schema=False)
async def sumsub_webhook(
    request: Request,
    session: Session,
    x_payload_digest: Annotated[str | None, Header()] = None,
    x_payload_digest_alg: Annotated[str | None, Header()] = None,
) -> dict:
    """Sumsub 대시보드의 Webhooks에 이 주소를 등록한다. 서명(X-Payload-Digest)이 맞아야 처리한다."""
    body = await request.body()
    kyc.verify_webhook(body, x_payload_digest, x_payload_digest_alg)
    try:
        payload = json.loads(body)
    except ValueError as exc:
        raise AppError(400, "invalid_payload", "invalid payload") from exc
    await kyc.handle_webhook(session, payload)
    await session.commit()
    return {"ok": True}
