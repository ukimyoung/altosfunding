"""리워드 API. 경로와 응답 형태는 기존 서버와 같다.

- 사용자: /rewards/referral* (웹 'My Page > Reward > Referral')
- 관리자: /admin/rewards/policy (백오피스 '운영 관리 > 리워드/레퍼럴 관리 > 리워드 정책 설정')
"""

from typing import Annotated

from fastapi import APIRouter, Query

from app.deps import AdminUser, CurrentUser, Session
from app.schemas.reward import (
    ReferralCodeOut,
    ReferralPage,
    ReferralStatsOut,
    RewardPolicyOut,
    RewardPolicyUpdate,
    RewardPolicyUpdateResponse,
)
from app.services import reward as svc
from app.services import reward_policy

router = APIRouter(prefix="/rewards", tags=["rewards"])
admin_router = APIRouter(prefix="/admin/rewards", tags=["admin-rewards"])


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


@admin_router.get("/policy", response_model=RewardPolicyOut, summary="리워드 정책 조회")
async def get_reward_policy(admin: AdminUser, session: Session) -> RewardPolicyOut:
    """저장된 값이 없으면 기본값(40 USD, 첫 챌린지 구매 시, 1%p)을 돌려준다."""
    return await reward_policy.get_policy(session)


@admin_router.put("/policy", response_model=RewardPolicyUpdateResponse, summary="리워드 정책 수정")
async def update_reward_policy(
    body: RewardPolicyUpdate, admin: AdminUser, session: Session
) -> RewardPolicyUpdateResponse:
    """보낸 키만 바꾼다. 지급액은 0~1,000,000 USD(소수 둘째 자리까지), 추가율은 0~1 (0.01 = 1%p)."""
    policy = await reward_policy.update_policy(session, body.model_dump(exclude_unset=True))
    await session.commit()
    return RewardPolicyUpdateResponse(message="정책이 업데이트되었습니다", **policy.model_dump())
