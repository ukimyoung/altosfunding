"""리워드 API (사용자 웹 'My Page > Reward > Referral'). 경로와 응답 형태는 기존 서버와 같다."""

from typing import Annotated

from fastapi import APIRouter, Query

from app.deps import CurrentUser, Session
from app.schemas.reward import ReferralCodeOut, ReferralPage, ReferralStatsOut
from app.services import reward as svc

router = APIRouter(prefix="/rewards", tags=["rewards"])


@router.get("/referral-code", response_model=ReferralCodeOut, summary="내 추천인 코드·링크")
async def get_referral_code(user: CurrentUser) -> ReferralCodeOut:
    return svc.referral_code_out(user)


@router.get("/referrals/stats", response_model=ReferralStatsOut, summary="추천인 통계 (상단 카드, 코드·링크 포함)")
async def get_referral_stats(user: CurrentUser, session: Session) -> ReferralStatsOut:
    return await svc.referral_stats(session, user)


@router.get("/referrals", response_model=ReferralPage, summary="내가 초대한 회원 목록")
async def get_referrals(
    user: CurrentUser,
    session: Session,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> ReferralPage:
    return await svc.list_referrals(session, user, page, size)
