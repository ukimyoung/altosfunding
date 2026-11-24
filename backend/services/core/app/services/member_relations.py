"""회원 조직 관계 (추천인 sponsor / 수당 조직 상위 placement parent).

PRD(IB 차등 커미션) 5.1·5.2
- 관계는 core.member_relations에 회원당 1행. users에 행이 생기면 트리거가 빈 행을 만든다.
- 가입 때 추천인이 정해지면 placement parent도 같은 사람으로 넣는다. 이후 두 값은 따로 바뀐다.
- 모든 변경은 member_relation_history에 이전·새 값, 변경자, 사유를 남긴다.
- 자기 자신·순환(내 하위를 상위로 지정)은 막는다. 바꿀 때는 행 잠금(FOR UPDATE)을 건다.
- 커밋은 부른 쪽이 한다.
"""

import uuid

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import AppError
from app.models import MemberRelation, MemberRelationHistory

MIGRATION, SIGNUP, SPONSOR_SET, SPONSOR_CHANGE, PLACEMENT_CHANGE = (
    "MIGRATION",
    "SIGNUP",
    "SPONSOR_SET",
    "SPONSOR_CHANGE",
    "PLACEMENT_CHANGE",
)

# 상위 관계를 따라 올라가며 member가 나오는지 본다 (순환 검사). 컬럼 이름은 코드에서만 넣는다.
_ANCESTOR_SQL = """
with recursive up(id, depth) as (
    select cast(:start as uuid), 0
    union all
    select r.{col}, up.depth + 1
    from core.member_relations r
    join up on r.member_id = up.id
    where r.{col} is not null and up.depth < 100000
)
cycle id set is_cycle using path
select exists (select 1 from up where id = cast(:member as uuid))
"""


async def _serialize(session: AsyncSession) -> None:
    """관계 변경을 한 번에 하나씩 처리한다 (두 변경이 동시에 서로를 상위로 만드는 순환 방지). 트랜잭션 끝에 풀린다."""
    await session.execute(text("select pg_advisory_xact_lock(hashtext('core.member_relations'))"))


async def get(session: AsyncSession, member_id: uuid.UUID, *, lock: bool = False) -> MemberRelation:
    stmt = select(MemberRelation).where(MemberRelation.member_id == member_id)
    if lock:
        stmt = stmt.with_for_update()
    relation = await session.scalar(stmt)
    if relation is None:
        # 트리거가 만들지만, 혹시 없으면 여기서 만든다.
        relation = MemberRelation(member_id=member_id)
        session.add(relation)
        await session.flush()
    return relation


async def sponsor_id_of(session: AsyncSession, member_id: uuid.UUID) -> uuid.UUID | None:
    return await session.scalar(select(MemberRelation.sponsor_id).where(MemberRelation.member_id == member_id))


async def count_sponsored(session: AsyncSession, sponsor_id: uuid.UUID) -> int:
    n = await session.scalar(
        select(func.count()).select_from(MemberRelation).where(MemberRelation.sponsor_id == sponsor_id)
    )
    return n or 0


async def _is_ancestor_or_self(session: AsyncSession, column: str, member_id: uuid.UUID, start_id: uuid.UUID) -> bool:
    """start에서 column(sponsor_id|placement_parent_id)을 따라 올라가다 member를 만나면 True."""
    assert column in ("sponsor_id", "placement_parent_id")
    result = await session.scalar(
        text(_ANCESTOR_SQL.format(col=column)), {"start": str(start_id), "member": str(member_id)}
    )
    return bool(result)


def _history(relation: MemberRelation, change_type: str, *, old_sponsor, old_placement, actor_id, reason) -> MemberRelationHistory:
    return MemberRelationHistory(
        member_id=relation.member_id,
        change_type=change_type,
        old_sponsor_id=old_sponsor,
        new_sponsor_id=relation.sponsor_id,
        old_placement_parent_id=old_placement,
        new_placement_parent_id=relation.placement_parent_id,
        reason=reason,
        actor_id=actor_id,
    )


async def set_sponsor(
    session: AsyncSession,
    member_id: uuid.UUID,
    sponsor_id: uuid.UUID | None,
    *,
    change_type: str,
    actor_id: uuid.UUID | None = None,
    reason: str | None = None,
) -> MemberRelation:
    """추천인을 정하거나 바꾼다. placement parent가 비어 있으면 같은 사람으로 채운다(이미 있으면 그대로)."""
    await _serialize(session)
    relation = await get(session, member_id, lock=True)
    if relation.sponsor_id == sponsor_id:
        return relation
    if sponsor_id is not None:
        if sponsor_id == member_id:
            raise AppError(400, "self_referral", "본인 초대 코드는 사용할 수 없습니다.")
        if await _is_ancestor_or_self(session, "sponsor_id", member_id, sponsor_id):
            raise AppError(400, "relation_cycle", "하위 회원을 추천인으로 지정할 수 없습니다.")
    old_sponsor, old_placement = relation.sponsor_id, relation.placement_parent_id
    relation.sponsor_id = sponsor_id
    if relation.placement_parent_id is None and sponsor_id is not None:
        if not await _is_ancestor_or_self(session, "placement_parent_id", member_id, sponsor_id):
            relation.placement_parent_id = sponsor_id
    session.add(_history(relation, change_type, old_sponsor=old_sponsor, old_placement=old_placement, actor_id=actor_id, reason=reason))
    await session.flush()
    return relation


async def set_placement_parent(
    session: AsyncSession,
    member_id: uuid.UUID,
    parent_id: uuid.UUID | None,
    *,
    actor_id: uuid.UUID | None,
    reason: str | None,
) -> MemberRelation:
    """수당 조직 상위를 바꾼다(관리자 재배치). 하위 조직은 그대로 따라 이동한다(각자 parent가 그대로라서)."""
    await _serialize(session)
    relation = await get(session, member_id, lock=True)
    if relation.placement_parent_id == parent_id:
        return relation
    if parent_id is not None:
        if parent_id == member_id:
            raise AppError(400, "relation_self", "자기 자신을 상위로 지정할 수 없습니다.")
        if await _is_ancestor_or_self(session, "placement_parent_id", member_id, parent_id):
            raise AppError(400, "relation_cycle", "하위 조직의 회원을 상위로 지정할 수 없습니다.")
    old_sponsor, old_placement = relation.sponsor_id, relation.placement_parent_id
    relation.placement_parent_id = parent_id
    session.add(
        _history(relation, PLACEMENT_CHANGE, old_sponsor=old_sponsor, old_placement=old_placement, actor_id=actor_id, reason=reason)
    )
    await session.flush()
    return relation
