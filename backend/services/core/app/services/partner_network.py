"""제휴 회원 IB 등록·제휴사 추천인 연결 (2026-11-28 사용자 결정).

제휴사(10Power·xnsoft) 회원은 모두 IB다. Altos 계정이 생기면(사전 가입 또는 사전 가입 없이 활성화) 한 번에
- IB 등록: 레벨 1, 상태 ACTIVE (제휴사 status=deleted면 INACTIVE). 이미 IB면 그대로. 레벨은 관리자가 백오피스에서 바꾼다.
- 추천인 연결: partner_members.sponsor_member_id의 Altos 계정을 member_relations 추천인으로 넣는다
  (수당 조직 상위가 비어 있으면 같은 사람, member_relations.set_sponsor 규칙). 양방향:
  내 추천인 계정이 있으면 나를 연결하고, 나를 추천인으로 둔 회원 중 계정이 있는 회원도 연결한다.
  · 이미 추천인이 있는 회원은 덮어쓰지 않는다 (관리자가 정한 관계 보호).
  · 추천인 계정이 없으면 비워 둔다 (더 위 추천인으로 건너뛰지 않는다). 그 추천인 계정이 생길 때 연결된다.
  · 제휴사 sponsor_id가 나중에 바뀌어도 자동으로 바꾸지 않는다 (목록에서 '다름'으로 보여 준다).
IB가 추천인이면 $40 추천인 리워드는 나가지 않는다 (reward_admin 규칙).
"""

import uuid
from dataclasses import dataclass, field

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import AppError
from app.models import IbProfile, IbProfileHistory, MemberRelation, PartnerMember, User
from app.services import member_relations

DEFAULT_LEVEL = 1
IB_REASON = "제휴 회원 IB 자동 등록"
SPONSOR_REASON = "제휴사 추천인 연결"


@dataclass
class NetworkResult:
    ib_created: int = 0
    sponsors_linked: int = 0
    # 연결하지 못한 사유별 건수: sponsor_not_found(제휴사 추천인 회원 없음), sponsor_no_account(추천인 계정 없음),
    # relation_cycle(순환), already_set(이미 다른 추천인)
    sponsor_skipped: dict[str, int] = field(default_factory=dict)

    def skip(self, reason: str) -> None:
        self.sponsor_skipped[reason] = self.sponsor_skipped.get(reason, 0) + 1

    def as_dict(self) -> dict:
        return {
            "ib_created": self.ib_created,
            "sponsors_linked": self.sponsors_linked,
            "sponsor_skipped": dict(self.sponsor_skipped),
        }


async def ensure_ib(
    session: AsyncSession, user: User, partner: PartnerMember, actor_id: uuid.UUID | None, result: NetworkResult
) -> None:
    if user.role != "USER" or user.status == "WITHDRAWN":
        return
    if await session.get(IbProfile, user.id) is not None:
        return
    status = "INACTIVE" if partner.status == "deleted" else "ACTIVE"
    session.add(IbProfile(user_id=user.id, level=DEFAULT_LEVEL, status=status, created_by=actor_id))
    session.add(
        IbProfileHistory(
            user_id=user.id,
            change_type="CREATE",
            new_level=DEFAULT_LEVEL,
            new_status=status,
            reason=IB_REASON,
            actor_id=actor_id,
        )
    )
    await session.flush()
    result.ib_created += 1


async def _account_by_member_id(session: AsyncSession, member_id: str) -> User | None:
    return await session.scalar(select(User).where(func.lower(User.partner_member_id) == member_id.lower()))


async def _link(
    session: AsyncSession, user: User, sponsor: User, actor_id: uuid.UUID | None, result: NetworkResult
) -> None:
    current = await member_relations.sponsor_id_of(session, user.id)
    if current is not None:
        if current != sponsor.id:
            result.skip("already_set")
        return
    try:
        async with session.begin_nested():
            await member_relations.set_sponsor(
                session,
                user.id,
                sponsor.id,
                change_type=member_relations.SPONSOR_SET,
                actor_id=actor_id,
                reason=SPONSOR_REASON,
            )
    except AppError:
        result.skip("relation_cycle")
        return
    result.sponsors_linked += 1


async def link_up(
    session: AsyncSession, user: User, partner: PartnerMember, actor_id: uuid.UUID | None, result: NetworkResult
) -> None:
    """내 제휴사 추천인 계정을 내 추천인으로 연결한다."""
    sponsor_member_id = (partner.sponsor_member_id or "").strip()
    if not sponsor_member_id or sponsor_member_id.lower() == partner.member_id.lower():
        return
    if await member_relations.sponsor_id_of(session, user.id) is not None:
        return  # 이미 추천인이 있으면 그대로 (관리자가 정한 관계 보호)
    sponsor = await _account_by_member_id(session, sponsor_member_id)
    if sponsor is None:
        exists = await session.scalar(
            select(func.count()).select_from(PartnerMember).where(
                func.lower(PartnerMember.member_id) == sponsor_member_id.lower()
            )
        )
        result.skip("sponsor_no_account" if exists else "sponsor_not_found")
        return
    if sponsor.status == "WITHDRAWN":
        result.skip("sponsor_no_account")
        return
    await _link(session, user, sponsor, actor_id, result)


async def link_down(session: AsyncSession, user: User, actor_id: uuid.UUID | None, result: NetworkResult) -> None:
    """나를 제휴사 추천인으로 둔 회원 중 계정이 있고 추천인이 비어 있는 회원을 나에게 연결한다."""
    assert user.partner_member_id
    rows = await session.execute(
        select(User)
        .join(PartnerMember, PartnerMember.member_id == User.partner_member_id)
        .join(MemberRelation, MemberRelation.member_id == User.id)
        .where(
            func.lower(PartnerMember.sponsor_member_id) == user.partner_member_id.lower(),
            MemberRelation.sponsor_id.is_(None),
            User.status != "WITHDRAWN",
            User.id != user.id,
        )
    )
    for child in rows.scalars().all():
        await _link(session, child, user, actor_id, result)


async def apply(
    session: AsyncSession, user: User, partner: PartnerMember, actor_id: uuid.UUID | None, result: NetworkResult
) -> None:
    """계정이 생긴 제휴 회원 한 명: IB 등록 + 추천인 연결(양방향). 커밋은 부른 쪽이 한다."""
    await ensure_ib(session, user, partner, actor_id, result)
    await link_up(session, user, partner, actor_id, result)
    await link_down(session, user, actor_id, result)


async def resync_all(session: AsyncSession, actor_id: uuid.UUID) -> NetworkResult:
    """'IB 등록·추천인 연결 다시 맞추기': 계정이 있는 모든 제휴 회원에 대해 IB 등록과 추천인 연결을 다시 한다.

    이미 IB이거나 이미 추천인이 있는 회원은 바꾸지 않는다. 한 트랜잭션으로 커밋한다.
    """
    result = NetworkResult()
    rows = await session.execute(
        select(User, PartnerMember)
        .join(PartnerMember, PartnerMember.member_id == User.partner_member_id)
        .where(User.status != "WITHDRAWN")
        .order_by(PartnerMember.joined_at, PartnerMember.member_id)
    )
    pairs = rows.all()
    for user, partner in pairs:
        await ensure_ib(session, user, partner, actor_id, result)
    for user, partner in pairs:
        await link_up(session, user, partner, actor_id, result)
    await session.commit()
    return result
