"""추천인(Referral) 조회. 응답 형태는 기존 서버 /rewards/referral* 와 같다.

추천 보상(리워드 기록)과 챌린지 주문은 아직 Core에 없어서,
- 누적 리워드(total_earned)는 0,
- 피추천인의 챌린지 구매 수는 0, 상태는 모두 Pending,
- 대기 중 추천 수는 초대한 친구 수와 같다.
리워드·주문 기능을 옮길 때 이 부분을 실제 값으로 채운다.
"""

import math

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import User
from app.schemas.reward import ReferralCodeOut, ReferralItemOut, ReferralPage, ReferralStatsOut
from app.services import reward_policy


def referral_link(code: str) -> str:
    return f"{settings.web_base_url.rstrip('/')}/signup?ref={code}"


def referral_code_out(user: User) -> ReferralCodeOut:
    return ReferralCodeOut(referral_code=user.referral_code, referral_link=referral_link(user.referral_code))


async def _count_invited(session: AsyncSession, user: User) -> int:
    n = await session.scalar(select(func.count()).select_from(User).where(User.referrer_id == user.id))
    return n or 0


async def referral_stats(session: AsyncSession, user: User) -> ReferralStatsOut:
    total_invited = await _count_invited(session, user)
    policy = await reward_policy.get_policy(session)
    return ReferralStatsOut(
        total_invited=total_invited,
        pending_referrals=total_invited,
        total_earned=0.0,
        referral_link=referral_link(user.referral_code),
        referral_code=user.referral_code,
        referral_reward_amount=policy.referral_reward_amount,
        referral_reward_condition=policy.referral_reward_condition,
    )


async def list_referrals(session: AsyncSession, user: User, page: int, size: int) -> ReferralPage:
    total = await _count_invited(session, user)
    rows = await session.scalars(
        select(User)
        .where(User.referrer_id == user.id)
        .order_by(User.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    items = []
    for u in rows:
        name = f"{u.first_name or ''} {u.last_name or ''}".strip() or u.email
        items.append(
            ReferralItemOut(
                id=str(u.id),
                name=name,
                email=u.email,
                register_date=u.created_at,
                total_challenge_count=0,
                status="Pending",
            )
        )
    return ReferralPage(items=items, total=total, page=page, size=size, pages=math.ceil(total / size) if total else 0)
