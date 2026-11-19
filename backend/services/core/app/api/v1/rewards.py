"""리워드 API. 경로와 응답 형태는 기존 서버와 같다.

- 사용자: /rewards/referral* (웹 'My Page > Reward > Referral')
- 사용자: /rewards/mine, /rewards/summary (웹 'My Page > Reward' 리워드 이력)
- 관리자: /admin/rewards/* (백오피스 '운영 관리 > 리워드/레퍼럴 관리': 추천인 리워드·트레이딩 보너스·리워드 정책 설정)
"""

from typing import Annotated

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

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
from app.services import reward_admin
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


@router.get("/mine", summary="내 리워드 이력 (추천인 리워드 + 트레이딩 보너스)")
async def get_my_rewards(
    user: CurrentUser,
    session: Session,
    type: Annotated[str | None, Query(description="TRADING_BONUS | REFERRAL_BONUS 등")] = None,
    status: Annotated[str | None, Query(description="PENDING | APPROVED | REJECTED")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> dict:
    return await reward_admin.my_rewards(session, user, type_=type, status=status, page=page, size=size)


@router.get("/summary", summary="내 리워드 집계 (총액·유형별)")
async def get_my_reward_summary(user: CurrentUser, session: Session) -> dict:
    return await reward_admin.my_summary(session, user)


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


# ── 추천인 리워드 ───────────────────────────────────────────


class RejectBody(BaseModel):
    rejection_reason: str = Field(min_length=1, max_length=500)


class ActionResponse(BaseModel):
    message: str


@admin_router.get("/referrals/stats", summary="추천인 리워드 통계 (상단 카드)")
async def get_referral_reward_stats(admin: AdminUser, session: Session) -> dict:
    """누적·지급 완료 = 승인 합계, 대기 = PENDING 합계, 활성 레퍼럴 = 추천인으로 가입한 ACTIVE 회원 수."""
    return await reward_admin.referral_stats(session)


@admin_router.get("/referral-links", summary="추천 관계 목록 (가입 기준, 구매 전 포함)")
async def get_referral_links(
    admin: AdminUser,
    session: Session,
    keyword: Annotated[str | None, Query(description="추천인/피추천인 이메일·이름·추천 코드")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> dict:
    return await reward_admin.list_referral_links(session, keyword=keyword, page=page, size=size)


@admin_router.get("/referrals", summary="추천인 리워드 목록")
async def get_referral_rewards(
    admin: AdminUser,
    session: Session,
    status: Annotated[
        str | None,
        Query(description="PENDING | APPROVED | REJECTED | AWAITING_PURCHASE (PENDING에는 구매 전 추천도 포함)"),
    ] = None,
    keyword: Annotated[str | None, Query(description="추천인/피추천인 이메일·이름·추천 코드")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> dict:
    """추천 관계마다 1행. 첫 구매 전이면 id=0, status=AWAITING_PURCHASE, amount=0."""
    return await reward_admin.list_referral_rewards(session, status=status, keyword=keyword, page=page, size=size)


@admin_router.post("/referrals/{reward_id}/approve", response_model=ActionResponse, summary="추천인 리워드 승인 (지갑 입금)")
async def approve_referral_reward(reward_id: int, admin: AdminUser, session: Session) -> ActionResponse:
    """피추천인의 챌린지 구매 완료 이력이 없으면 no_purchase_history."""
    await reward_admin.approve_referral_reward(session, admin, reward_id)
    return ActionResponse(message="승인 완료")


@admin_router.post("/referrals/{reward_id}/reject", response_model=ActionResponse, summary="추천인 리워드 반려")
async def reject_referral_reward(reward_id: int, body: RejectBody, admin: AdminUser, session: Session) -> ActionResponse:
    await reward_admin.reject_referral_reward(session, admin, reward_id, body.rejection_reason.strip())
    return ActionResponse(message="반려 완료")


# ── 트레이딩 보너스 ─────────────────────────────────────────


@admin_router.get("/trading-bonuses/stats", summary="트레이딩 보너스 통계 (상단 카드)")
async def get_trading_bonus_stats(admin: AdminUser, session: Session) -> dict:
    return await reward_admin.trading_bonus_stats(session)


@admin_router.get("/trading-bonuses", summary="트레이딩 보너스 목록")
async def get_trading_bonuses(
    admin: AdminUser,
    session: Session,
    status: Annotated[str | None, Query(description="PENDING | APPROVED | REJECTED")] = None,
    keyword: Annotated[str | None, Query(description="회원 이메일·이름, 계좌번호")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> dict:
    """수익 정산(payout)이 Core로 옮겨지기 전까지는 비어 있다."""
    return await reward_admin.list_trading_bonuses(session, status=status, keyword=keyword, page=page, size=size)


@admin_router.post("/trading-bonuses/{bonus_id}/approve", response_model=ActionResponse, summary="트레이딩 보너스 승인 (지갑 입금)")
async def approve_trading_bonus(bonus_id: int, admin: AdminUser, session: Session) -> ActionResponse:
    await reward_admin.approve_trading_bonus(session, admin, bonus_id)
    return ActionResponse(message="승인 완료")


@admin_router.post("/trading-bonuses/{bonus_id}/reject", response_model=ActionResponse, summary="트레이딩 보너스 반려")
async def reject_trading_bonus(bonus_id: int, body: RejectBody, admin: AdminUser, session: Session) -> ActionResponse:
    await reward_admin.reject_trading_bonus(session, admin, bonus_id, body.rejection_reason.strip())
    return ActionResponse(message="반려 완료")
