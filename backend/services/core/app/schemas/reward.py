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
