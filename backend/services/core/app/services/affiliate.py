"""IB(제휴) 프로그램: IB 프로필, 레벨 비율·마케팅 비율 정책, 조직도·재배치 (PRD 5.2~5.4).

- IB는 회원 1명당 1개 프로필(레벨 1~40, 상태 ACTIVE|INACTIVE|BANNED). BANNED는 다시 바꿀 수 없다.
- 레벨 비율은 40개를 한 번에 버전으로 저장하고, 마케팅 비율도 버전으로 저장한다(effective_from부터 적용).
- 레벨 비율은 그 기간의 마케팅 비율을 넘을 수 없다. 마케팅 비율을 낮춰 기존 레벨 비율보다 작아지면 저장을 막는다.
- 조직도는 수당 조직(placement_parent) 기준. 재배치는 IB만, 사유 필수, member_relations 이력에 남는다.
- 커밋은 부른 쪽(API)이 한다.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import AppError
from app.models import (
    IbLevelRate,
    IbLevelRateSet,
    IbProfile,
    IbProfileHistory,
    MarketingPolicyVersion,
    MemberRelation,
    User,
)
from app.services import member_relations

LEVELS = range(1, 41)
STATUSES = ("ACTIVE", "INACTIVE", "BANNED")
ACTIVE, INACTIVE, BANNED = STATUSES
RATE_STEP = Decimal("0.0001")
MAX_TREE_NODES = 5000
# 적용 시작 시각은 지금 이후만 (과거 주문 재계산 금지). 화면·서버 시계 차이로 1분까지는 허용한다.
PAST_TOLERANCE = timedelta(minutes=1)


def _now() -> datetime:
    return datetime.now(UTC)


def _name(user: User | None) -> str | None:
    if user is None:
        return None
    return f"{user.first_name or ''} {user.last_name or ''}".strip() or None


def _like(keyword: str) -> str:
    escaped = keyword.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def _rate(value) -> Decimal:
    try:
        rate = Decimal(str(value)).quantize(RATE_STEP)
    except Exception as exc:
        raise AppError(422, "invalid_rate", "비율은 숫자여야 합니다.") from exc
    if rate < 0 or rate > 100:
        raise AppError(422, "invalid_rate", "비율은 0% 이상 100% 이하여야 합니다.")
    return rate


def _effective_from(value: datetime | None) -> datetime:
    now = _now()
    if value is None:
        return now
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    if value < now - PAST_TOLERANCE:
        raise AppError(422, "effective_from_in_past", "적용 시작 시각은 지금 이후여야 합니다.")
    return max(value, now)


async def _lock_policy(session: AsyncSession) -> None:
    await session.execute(text("select pg_advisory_xact_lock(hashtext('core.ib_policy'))"))


def _float(value: Decimal | None) -> float | None:
    return None if value is None else float(value)


# ── 정책 조회 ─────────────────────────────────────────────


async def marketing_at(session: AsyncSession, at: datetime) -> MarketingPolicyVersion | None:
    return await session.scalar(
        select(MarketingPolicyVersion)
        .where(MarketingPolicyVersion.effective_from <= at)
        .order_by(MarketingPolicyVersion.effective_from.desc(), MarketingPolicyVersion.version.desc())
        .limit(1)
    )


async def rate_set_at(session: AsyncSession, at: datetime) -> IbLevelRateSet | None:
    return await session.scalar(
        select(IbLevelRateSet)
        .where(IbLevelRateSet.effective_from <= at)
        .order_by(IbLevelRateSet.effective_from.desc(), IbLevelRateSet.version.desc())
        .limit(1)
    )


async def rates_of(session: AsyncSession, set_id: int) -> dict[int, Decimal]:
    rows = await session.execute(select(IbLevelRate.level, IbLevelRate.rate).where(IbLevelRate.set_id == set_id))
    return {level: rate for level, rate in rows.all()}


@dataclass
class Policy:
    """결제 시각에 적용되는 정책 (3단계 계산이 쓴다)."""

    marketing_version_id: int
    marketing_rate: Decimal
    rate_set_id: int
    level_rates: dict[int, Decimal]


async def policy_at(session: AsyncSession, at: datetime) -> Policy:
    marketing = await marketing_at(session, at)
    rate_set = await rate_set_at(session, at)
    if marketing is None or rate_set is None:
        raise AppError(500, "ib_policy_missing", "적용할 마케팅 비율·레벨 비율이 없습니다.")
    return Policy(marketing.id, marketing.rate, rate_set.id, await rates_of(session, rate_set.id))


def _marketing_out(m: MarketingPolicyVersion, actors: dict) -> dict:
    return {
        "id": m.id,
        "version": m.version,
        "rate": _float(m.rate),
        "effective_from": m.effective_from,
        "reason": m.reason,
        "actor_id": str(m.actor_id) if m.actor_id else None,
        "actor_name": actors.get(m.actor_id),
        "created_at": m.created_at,
    }


async def _actor_names(session: AsyncSession, ids) -> dict:
    ids = {i for i in ids if i}
    if not ids:
        return {}
    users = await session.scalars(select(User).where(User.id.in_(ids)))
    return {u.id: _name(u) or u.email for u in users}


async def marketing_overview(session: AsyncSession) -> dict:
    now = _now()
    current = await marketing_at(session, now)
    versions = (
        await session.scalars(
            select(MarketingPolicyVersion).order_by(
                MarketingPolicyVersion.effective_from.desc(), MarketingPolicyVersion.version.desc()
            )
        )
    ).all()
    actors = await _actor_names(session, [v.actor_id for v in versions])
    return {
        "current": _marketing_out(current, actors) if current else None,
        "scheduled": [_marketing_out(v, actors) for v in versions if v.effective_from > now][::-1],
        "history": [_marketing_out(v, actors) for v in versions],
    }


async def level_rates_overview(session: AsyncSession) -> dict:
    now = _now()
    current = await rate_set_at(session, now)
    sets = (
        await session.scalars(
            select(IbLevelRateSet).order_by(IbLevelRateSet.effective_from.desc(), IbLevelRateSet.version.desc())
        )
    ).all()
    actors = await _actor_names(session, [s.actor_id for s in sets])

    async def _out(s: IbLevelRateSet) -> dict:
        rates = await rates_of(session, s.id)
        return {
            "id": s.id,
            "version": s.version,
            "effective_from": s.effective_from,
            "reason": s.reason,
            "actor_id": str(s.actor_id) if s.actor_id else None,
            "actor_name": actors.get(s.actor_id),
            "created_at": s.created_at,
            "rates": [{"level": level, "rate": _float(rates.get(level, Decimal(0)))} for level in LEVELS],
        }

    marketing = await marketing_at(session, now)
    return {
        "current": await _out(current) if current else None,
        "scheduled": [await _out(s) for s in sets if s.effective_from > now][::-1],
        "history": [
            {k: v for k, v in (await _out(s)).items() if k != "rates"} for s in sets
        ],
        "marketing_rate": _float(marketing.rate) if marketing else None,
    }


# ── 정책 변경 ─────────────────────────────────────────────


async def _marketing_rates_between(session: AsyncSession, start: datetime, end: datetime | None) -> list[Decimal]:
    """[start, end) 동안 적용되는 마케팅 비율들."""
    rates = []
    first = await marketing_at(session, start)
    if first is not None:
        rates.append(first.rate)
    stmt = select(MarketingPolicyVersion.rate).where(MarketingPolicyVersion.effective_from > start)
    if end is not None:
        stmt = stmt.where(MarketingPolicyVersion.effective_from < end)
    rates.extend(await session.scalars(stmt))
    return rates


async def _max_level_rates_between(session: AsyncSession, start: datetime, end: datetime | None) -> Decimal:
    """[start, end) 동안 적용되는 레벨 비율 버전들의 최고 비율."""
    set_ids = []
    first = await rate_set_at(session, start)
    if first is not None:
        set_ids.append(first.id)
    stmt = select(IbLevelRateSet.id).where(IbLevelRateSet.effective_from > start)
    if end is not None:
        stmt = stmt.where(IbLevelRateSet.effective_from < end)
    set_ids.extend(await session.scalars(stmt))
    if not set_ids:
        return Decimal(0)
    value = await session.scalar(select(func.max(IbLevelRate.rate)).where(IbLevelRate.set_id.in_(set_ids)))
    return value or Decimal(0)


async def _next_effective(session: AsyncSession, model, after: datetime) -> datetime | None:
    return await session.scalar(select(func.min(model.effective_from)).where(model.effective_from > after))


async def create_marketing_version(
    session: AsyncSession, *, rate, effective_from: datetime | None, reason: str | None, actor: User
) -> MarketingPolicyVersion:
    reason = (reason or "").strip()
    if not reason:
        raise AppError(422, "reason_required", "변경 사유를 입력해 주세요.")
    rate = _rate(rate)
    await _lock_policy(session)
    start = _effective_from(effective_from)
    end = await _next_effective(session, MarketingPolicyVersion, start)
    highest = await _max_level_rates_between(session, start, end)
    if highest > rate:
        raise AppError(
            409,
            "level_rate_exceeds_marketing",
            f"레벨 커미션 비율 중 {highest.normalize()}%가 새 마케팅 비율보다 큽니다. 레벨 비율을 먼저 낮춰 주세요.",
        )
    version = (await session.scalar(select(func.max(MarketingPolicyVersion.version)))) or 0
    row = MarketingPolicyVersion(version=version + 1, rate=rate, effective_from=start, reason=reason, actor_id=actor.id)
    session.add(row)
    await session.flush()
    return row


async def save_level_rates(
    session: AsyncSession, *, rates: list[dict], effective_from: datetime | None, reason: str | None, actor: User
) -> IbLevelRateSet:
    by_level: dict[int, Decimal] = {}
    for item in rates:
        level = int(item.get("level", 0))
        if level not in LEVELS or level in by_level:
            raise AppError(422, "invalid_levels", "레벨 1~40의 비율을 한 번씩 모두 보내 주세요.")
        by_level[level] = _rate(item.get("rate"))
    if set(by_level) != set(LEVELS):
        raise AppError(422, "invalid_levels", "레벨 1~40의 비율을 한 번씩 모두 보내 주세요.")
    await _lock_policy(session)
    start = _effective_from(effective_from)
    end = await _next_effective(session, IbLevelRateSet, start)
    marketing = await _marketing_rates_between(session, start, end)
    limit = min(marketing) if marketing else Decimal(0)
    over = sorted(level for level, rate in by_level.items() if rate > limit)
    if over:
        raise AppError(
            422,
            "level_rate_exceeds_marketing",
            f"마케팅 비율 {limit.normalize()}%보다 큰 레벨이 있습니다: Level {', '.join(map(str, over))}",
        )
    version = (await session.scalar(select(func.max(IbLevelRateSet.version)))) or 0
    rate_set = IbLevelRateSet(version=version + 1, effective_from=start, reason=(reason or "").strip() or None, actor_id=actor.id)
    session.add(rate_set)
    await session.flush()
    session.add_all(IbLevelRate(set_id=rate_set.id, level=level, rate=rate) for level, rate in by_level.items())
    await session.flush()
    return rate_set


# ── IB 파트너 ─────────────────────────────────────────────


async def is_ib(session: AsyncSession, user_id: uuid.UUID) -> bool:
    return bool(await session.scalar(select(IbProfile.user_id).where(IbProfile.user_id == user_id)))


async def _get_profile(session: AsyncSession, user_id: uuid.UUID, *, lock: bool = False) -> IbProfile:
    profile = await session.get(IbProfile, user_id, with_for_update=lock)
    if profile is None:
        raise AppError(404, "ib_not_found", "IB 파트너가 아닙니다.")
    return profile


def _check_status(status: str) -> str:
    status = (status or "").upper()
    if status not in STATUSES:
        raise AppError(422, "invalid_status", "상태는 ACTIVE, INACTIVE, BANNED 중 하나여야 합니다.")
    return status


async def add_partner(session: AsyncSession, *, user_id: uuid.UUID, level: int, status: str, actor: User) -> IbProfile:
    if level not in LEVELS:
        raise AppError(422, "invalid_level", "레벨은 1~40이어야 합니다.")
    status = _check_status(status)
    user = await session.get(User, user_id)
    if user is None or user.status == "WITHDRAWN":
        raise AppError(404, "user_not_found", "회원을 찾을 수 없습니다.")
    if await is_ib(session, user_id):
        raise AppError(409, "already_ib", "이미 IB 파트너로 등록된 회원입니다.")
    profile = IbProfile(user_id=user_id, level=level, status=status, created_by=actor.id)
    session.add(profile)
    session.add(
        IbProfileHistory(user_id=user_id, change_type="CREATE", new_level=level, new_status=status, actor_id=actor.id)
    )
    await session.flush()
    return profile


async def update_partner(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    level: int | None,
    status: str | None,
    reason: str | None,
    actor: User,
) -> IbProfile:
    profile = await _get_profile(session, user_id, lock=True)
    new_level = profile.level if level is None else level
    new_status = profile.status if status is None else _check_status(status)
    if new_level not in LEVELS:
        raise AppError(422, "invalid_level", "레벨은 1~40이어야 합니다.")
    if profile.status == BANNED and new_status != BANNED:
        raise AppError(409, "ib_banned", "영구정지된 IB는 다시 활성화할 수 없습니다.")
    if new_level == profile.level and new_status == profile.status:
        return profile
    session.add(
        IbProfileHistory(
            user_id=user_id,
            change_type="UPDATE",
            old_level=profile.level,
            new_level=new_level,
            old_status=profile.status,
            new_status=new_status,
            reason=(reason or "").strip() or None,
            actor_id=actor.id,
        )
    )
    profile.level, profile.status = new_level, new_status
    await session.flush()
    return profile


_DESCENDANT_COUNTS = text(
    """
    with recursive d(root, id) as (
        select r.placement_parent_id, r.member_id
        from core.member_relations r
        where r.placement_parent_id = any(cast(:ids as uuid[]))
        union all
        select d.root, r.member_id
        from core.member_relations r
        join d on r.placement_parent_id = d.id
    )
    select root, count(*) as n from d group by root
    """
)


async def _descendant_counts(session: AsyncSession, ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    if not ids:
        return {}
    rows = await session.execute(_DESCENDANT_COUNTS, {"ids": [str(i) for i in ids]})
    return {uuid.UUID(str(root)): n for root, n in rows.all()}


def _user_brief(user: User | None) -> dict | None:
    if user is None:
        return None
    return {"user_id": str(user.id), "uid": user.uid, "name": _name(user), "email": user.email}


async def _partner_items(session: AsyncSession, rows: list[tuple[IbProfile, User]]) -> list[dict]:
    ids = [user.id for _, user in rows]
    relations = {
        r.member_id: r
        for r in await session.scalars(select(MemberRelation).where(MemberRelation.member_id.in_(ids)))
    } if ids else {}
    parent_ids = {r.placement_parent_id for r in relations.values() if r.placement_parent_id}
    parents = {u.id: u for u in await session.scalars(select(User).where(User.id.in_(parent_ids)))} if parent_ids else {}
    child_rows = (
        await session.execute(
            select(MemberRelation.placement_parent_id, User)
            .join(User, User.id == MemberRelation.member_id)
            .join(IbProfile, IbProfile.user_id == MemberRelation.member_id)
            .where(MemberRelation.placement_parent_id.in_(ids))
            .order_by(IbProfile.created_at)
        )
    ).all() if ids else []
    children: dict[uuid.UUID, list[User]] = {}
    for parent_id, child in child_rows:
        children.setdefault(parent_id, []).append(child)
    counts = await _descendant_counts(session, ids)
    items = []
    for profile, user in rows:
        relation = relations.get(user.id)
        upline = parents.get(relation.placement_parent_id) if relation and relation.placement_parent_id else None
        downline_ibs = children.get(user.id, [])
        items.append(
            {
                **_user_brief(user),
                "phone": user.phone,
                "level": profile.level,
                "status": profile.status,
                "registered_at": profile.created_at,
                "upline": _user_brief(upline),
                "downline_ibs": [_user_brief(c) for c in downline_ibs[:5]],
                "downline_ib_count": len(downline_ibs),
                "downline_count": counts.get(user.id, 0),
            }
        )
    return items


async def list_partners(
    session: AsyncSession, *, keyword: str | None, status: str | None, page: int, size: int
) -> dict:
    conditions = [User.status != "WITHDRAWN"]
    if status:
        conditions.append(IbProfile.status == _check_status(status))
    keyword = (keyword or "").strip()
    if keyword:
        pattern = _like(keyword)
        upline = User.__table__.alias("upline")
        upline_match = (
            select(MemberRelation.member_id)
            .join(upline, upline.c.id == MemberRelation.placement_parent_id)
            .where(or_(upline.c.uid.ilike(pattern), upline.c.email.ilike(pattern)))
        )
        conditions.append(
            or_(
                User.email.ilike(pattern),
                User.uid.ilike(pattern),
                User.first_name.ilike(pattern),
                User.last_name.ilike(pattern),
                func.concat(User.first_name, " ", User.last_name).ilike(pattern),
                User.id.in_(upline_match),
            )
        )
    base = select(IbProfile, User).join(User, User.id == IbProfile.user_id).where(*conditions)
    total = await session.scalar(select(func.count()).select_from(base.subquery())) or 0
    rows = (
        await session.execute(
            base.order_by(IbProfile.created_at.desc(), IbProfile.user_id).offset((page - 1) * size).limit(size)
        )
    ).all()
    summary_rows = (
        await session.execute(
            select(IbProfile.status, func.count())
            .join(User, User.id == IbProfile.user_id)
            .where(User.status != "WITHDRAWN")
            .group_by(IbProfile.status)
        )
    ).all()
    by_status = {s: n for s, n in summary_rows}
    return {
        "items": await _partner_items(session, [tuple(r) for r in rows]),
        "total": total,
        "page": page,
        "size": size,
        "summary": {
            "total": sum(by_status.values()),
            "active": by_status.get(ACTIVE, 0),
            "inactive": by_status.get(INACTIVE, 0),
            "banned": by_status.get(BANNED, 0),
        },
    }


async def partner_detail(session: AsyncSession, user_id: uuid.UUID) -> dict:
    profile = await _get_profile(session, user_id)
    user = await session.get(User, user_id)
    item = (await _partner_items(session, [(profile, user)]))[0]
    history = (
        await session.scalars(
            select(IbProfileHistory).where(IbProfileHistory.user_id == user_id).order_by(IbProfileHistory.id.desc())
        )
    ).all()
    actors = await _actor_names(session, [h.actor_id for h in history])
    item["history"] = [
        {
            "change_type": h.change_type,
            "old_level": h.old_level,
            "new_level": h.new_level,
            "old_status": h.old_status,
            "new_status": h.new_status,
            "reason": h.reason,
            "actor_name": actors.get(h.actor_id),
            "created_at": h.created_at,
        }
        for h in history
    ]
    return item


# ── 조직도·재배치 ─────────────────────────────────────────


_SUBTREE = text(
    """
    with recursive t(id, parent_id, depth) as (
        select cast(:root as uuid), cast(null as uuid), 0
        union all
        select r.member_id, r.placement_parent_id, t.depth + 1
        from core.member_relations r
        join t on r.placement_parent_id = t.id
    )
    select id, parent_id, depth from t order by depth limit :limit
    """
)


async def find_member(session: AsyncSession, keyword: str) -> User | None:
    keyword = keyword.strip()
    if not keyword:
        return None
    try:
        return await session.get(User, uuid.UUID(keyword))
    except ValueError:
        pass
    exact = await session.scalar(select(User).where(or_(User.uid == keyword, func.lower(User.email) == keyword.lower())))
    if exact:
        return exact
    pattern = _like(keyword)
    return await session.scalar(
        select(User)
        .outerjoin(IbProfile, IbProfile.user_id == User.id)
        .where(
            User.status != "WITHDRAWN",
            or_(
                User.uid.ilike(pattern),
                User.email.ilike(pattern),
                func.concat(User.first_name, " ", User.last_name).ilike(pattern),
            ),
        )
        .order_by(IbProfile.user_id.is_(None), User.created_at)
        .limit(1)
    )


async def network(session: AsyncSession, root: User) -> dict:
    rows = (await session.execute(_SUBTREE, {"root": str(root.id), "limit": MAX_TREE_NODES + 1})).all()
    truncated = len(rows) > MAX_TREE_NODES
    rows = rows[:MAX_TREE_NODES]
    ids = [uuid.UUID(str(r.id)) for r in rows]
    users = {u.id: u for u in await session.scalars(select(User).where(User.id.in_(ids)))}
    profiles = {p.user_id: p for p in await session.scalars(select(IbProfile).where(IbProfile.user_id.in_(ids)))}
    nodes: dict[uuid.UUID, dict] = {}
    for r in rows:
        uid = uuid.UUID(str(r.id))
        user = users[uid]
        profile = profiles.get(uid)
        nodes[uid] = {
            **_user_brief(user),
            "depth": r.depth,
            "is_ib": profile is not None,
            "level": profile.level if profile else None,
            "ib_status": profile.status if profile else None,
            "member_status": user.status,
            # 3단계(커미션 적립) 전까지는 0
            "commission_total": 0.0,
            "children": [],
        }
        if r.parent_id is not None:
            parent = nodes.get(uuid.UUID(str(r.parent_id)))
            if parent is not None:
                parent["children"].append(nodes[uid])
    tree = nodes[root.id]
    return {
        "root": tree,
        "total": len(nodes),
        "active": sum(1 for n in nodes.values() if n["member_status"] == "ACTIVE" and n["ib_status"] in (None, ACTIVE)),
        "truncated": truncated,
    }


async def relocate(
    session: AsyncSession, *, member_id: uuid.UUID, new_parent_id: uuid.UUID, reason: str | None, actor: User
) -> MemberRelation:
    reason = (reason or "").strip()
    if not reason:
        raise AppError(422, "reason_required", "재배치 사유를 입력해 주세요.")
    if not await is_ib(session, member_id):
        raise AppError(422, "relocate_member_not_ib", "IB 파트너만 재배치할 수 있습니다.")
    if not await is_ib(session, new_parent_id):
        raise AppError(422, "relocate_parent_not_ib", "새 Upline은 IB 파트너여야 합니다.")
    return await member_relations.set_placement_parent(
        session, member_id, new_parent_id, actor_id=actor.id, reason=reason
    )


async def candidates(session: AsyncSession, keyword: str, limit: int = 20) -> list[dict]:
    """IB 추가 화면의 회원 검색. 이미 정해진 placement Upline을 같이 보여 준다(바꾸려면 재배치)."""
    keyword = keyword.strip()
    if not keyword:
        return []
    pattern = _like(keyword)
    rows = (
        await session.execute(
            select(User, MemberRelation.placement_parent_id, IbProfile.user_id)
            .outerjoin(MemberRelation, MemberRelation.member_id == User.id)
            .outerjoin(IbProfile, IbProfile.user_id == User.id)
            .where(
                User.status != "WITHDRAWN",
                or_(
                    User.uid.ilike(pattern),
                    User.email.ilike(pattern),
                    func.concat(User.first_name, " ", User.last_name).ilike(pattern),
                ),
            )
            .order_by(User.created_at.desc())
            .limit(limit)
        )
    ).all()
    parent_ids = {p for _, p, _ in rows if p}
    parents = {u.id: u for u in await session.scalars(select(User).where(User.id.in_(parent_ids)))} if parent_ids else {}
    return [
        {**_user_brief(user), "is_ib": ib is not None, "upline": _user_brief(parents.get(parent))}
        for user, parent, ib in rows
    ]
