"""추천인(Referral) 조회. 응답 형태는 기존 서버 /rewards/referral* 와 같다.

- 누적 리워드(total_earned) = 승인된 추천인 리워드 합계
- 대기 중 추천 = 초대한 친구 중 추천인 리워드가 아직 승인되지 않은 수 (구매 전 + 승인 대기)
- 피추천인 챌린지 구매 수 = 완료(COMPLETED)된 챌린지 주문 수, 1건 이상이면 Active
"""

import math

from sqlalchemy import and_, exists, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import ChallengeOrder, RewardRecord, User
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
    approved_reward = exists().where(
        and_(
            RewardRecord.user_id == user.id,
            RewardRecord.source_user_id == User.id,
            RewardRecord.type == "REFERRAL_BONUS",
            RewardRecord.status == "APPROVED",
        )
    )
    pending = await session.scalar(
        select(func.count()).select_from(User).where(User.referrer_id == user.id, ~approved_reward)
    )
    earned = await session.scalar(
        select(func.coalesce(func.sum(RewardRecord.amount), 0)).where(
            RewardRecord.user_id == user.id,
            RewardRecord.type == "REFERRAL_BONUS",
            RewardRecord.status == "APPROVED",
        )
    )
    policy = await reward_policy.get_policy(session)
    return ReferralStatsOut(
        total_invited=total_invited,
        pending_referrals=pending or 0,
        total_earned=float(earned or 0),
        referral_link=referral_link(user.referral_code),
        referral_code=user.referral_code,
        referral_reward_amount=policy.referral_reward_amount,
        referral_reward_condition=policy.referral_reward_condition,
    )


async def list_referrals(session: AsyncSession, user: User, page: int, size: int) -> ReferralPage:
    total = await _count_invited(session, user)
    rows = (
        await session.scalars(
            select(User)
            .where(User.referrer_id == user.id)
            .order_by(User.created_at.desc(), User.id)
            .offset((page - 1) * size)
            .limit(size)
        )
    ).all()
    counts: dict = {}
    if rows:
        counts = dict(
            (
                await session.execute(
                    select(ChallengeOrder.user_id, func.count())
                    .where(ChallengeOrder.user_id.in_([u.id for u in rows]), ChallengeOrder.status == "COMPLETED")
                    .group_by(ChallengeOrder.user_id)
                )
            ).all()
        )
    items = []
    for u in rows:
        name = f"{u.first_name or ''} {u.last_name or ''}".strip() or u.email
        count = counts.get(u.id, 0)
        items.append(
            ReferralItemOut(
                id=str(u.id),
                name=name,
                email=u.email,
                register_date=u.created_at,
                total_challenge_count=count,
                status="Active" if count > 0 else "Pending",
            )
        )
    return ReferralPage(items=items, total=total, page=page, size=size, pages=math.ceil(total / size) if total else 0)
