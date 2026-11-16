from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class ReferralCodeOut(BaseModel):
    referral_code: str
    referral_link: str


class ReferralStatsOut(BaseModel):
    total_invited: int
    pending_referrals: int
    total_earned: float
    referral_link: str
    referral_code: str
    # 'How it works' 문구에 쓰는 현재 리워드 정책 (기존 서버 응답에는 없던 필드)
    referral_reward_amount: int | float
    referral_reward_condition: Literal["FIRST_PURCHASE", "FUNDED_UPGRADE"]


class ReferralItemOut(BaseModel):
    id: str
    name: str
    email: str
    register_date: datetime | None
    total_challenge_count: int
    status: Literal["Active", "Pending"]


class ReferralPage(BaseModel):
    items: list[ReferralItemOut]
    total: int
    page: int
    size: int
    pages: int


# ── 리워드 정책 ─────────────────────────────────────────────

ReferralRewardCondition = Literal["FIRST_PURCHASE", "FUNDED_UPGRADE"]


class RewardPolicyOut(BaseModel):
    """백오피스 '리워드 정책 설정' 탭. 기존 서버 GET /admin/rewards/policy와 같은 키."""

    referral_reward_amount: int | float
    referral_reward_condition: ReferralRewardCondition
    trading_bonus_rate: float


class RewardPolicyUpdate(BaseModel):
    """보낸 키만 바꾼다. 백오피스는 카드마다 따로 저장한다."""

    referral_reward_condition: ReferralRewardCondition | None = None
    referral_reward_amount: float | None = None
    trading_bonus_rate: float | None = None


class RewardPolicyUpdateResponse(RewardPolicyOut):
    message: str
