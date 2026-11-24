"""IB 차등 커미션 계산·적립·환수 (PRD 6~8, 설명은 supabase/migrations/20261124030000_core_ib_commissions.sql).

결제(지갑 차감)와 같은 트랜잭션에서 계산·적립한다. 커밋은 부른 쪽이 한다.

    plan = await ib_commission.plan(session, buyer_id, base, at)     # 경로·비율 스냅샷과 지급액 계산
    await ib_commission.lock_wallets(session, [buyer_id, *plan.payee_ids])  # 지갑 잠금 순서를 고정해 교착 방지
    ... 주문 생성·지갑 차감 ...
    await ib_commission.apply(session, plan, order)                  # 기록·적립·분개

환불되면 refund(session, order, refund_base, refund_ref)로 환불 비율만큼 IB별로 환수한다.
"""

import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from decimal import ROUND_DOWN, ROUND_HALF_UP, Decimal

from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import AppError
from app.models import (
    ChallengeOrder,
    IbCommissionBatch,
    IbCommissionClawback,
    IbCommissionLine,
    IbProfile,
    User,
    Wallet,
)
from app.services import affiliate
from app.services.wallet import (
    USER_WALLET,
    Line,
    _change_balance,
    _post_journal,
    get_wallet,
)

logger = logging.getLogger(__name__)

IB_COMMISSION = "EXPENSE:IB_COMMISSION"
CENT = Decimal("0.01")
PAID, ZERO, SKIPPED_NOT_IB, SKIPPED_INACTIVE = "PAID", "ZERO", "SKIPPED_NOT_IB", "SKIPPED_INACTIVE"

# 구매자의 placement 상위 전체 (depth 1 = 바로 위). 순환은 member_relations가 막지만 혹시 몰라 cycle 절을 둔다.
_UPLINE = text(
    """
    with recursive up(member_id, depth) as (
        select r.placement_parent_id, 1
        from core.member_relations r
        where r.member_id = cast(:buyer as uuid) and r.placement_parent_id is not null
        union all
        select r.placement_parent_id, up.depth + 1
        from core.member_relations r
        join up on r.member_id = up.member_id
        where r.placement_parent_id is not null
    ) cycle member_id set is_cycle using path
    select member_id, depth from up where not is_cycle order by depth
    """
)


@dataclass
class PlannedLine:
    depth: int
    member_id: uuid.UUID
    is_ib: bool
    level: int | None
    ib_status: str | None
    member_status: str
    level_rate: Decimal | None
    prev_max_rate: Decimal
    applied_rate: Decimal = Decimal(0)
    amount: Decimal = Decimal(0)
    result: str = SKIPPED_NOT_IB


@dataclass
class Plan:
    buyer_id: uuid.UUID
    base: Decimal
    policy: affiliate.Policy
    budget: Decimal
    lines: list[PlannedLine] = field(default_factory=list)

    @property
    def paid(self) -> Decimal:
        return sum((ln.amount for ln in self.lines), Decimal(0))

    @property
    def retained(self) -> Decimal:
        return self.budget - self.paid

    @property
    def payee_ids(self) -> list[uuid.UUID]:
        return [ln.member_id for ln in self.lines if ln.amount > 0]


def _cents_down(value: Decimal) -> Decimal:
    return value.quantize(CENT, ROUND_DOWN)


async def plan(session: AsyncSession, buyer_id: uuid.UUID, base: Decimal, at: datetime) -> Plan | None:
    """결제 시각 기준으로 커미션을 계산한다. 기준 금액이 0이면 None."""
    if base <= 0:
        return None
    policy = await affiliate.policy_at(session, at)
    budget = (base * policy.marketing_rate / 100).quantize(CENT, ROUND_HALF_UP)
    result = Plan(buyer_id=buyer_id, base=base, policy=policy, budget=budget)
    rows = (await session.execute(_UPLINE, {"buyer": str(buyer_id)})).all()
    if not rows:
        return result
    ids = [uuid.UUID(str(r.member_id)) for r in rows]
    users = {u.id: u for u in await session.scalars(select(User).where(User.id.in_(ids)))}
    profiles = {p.user_id: p for p in await session.scalars(select(IbProfile).where(IbProfile.user_id.in_(ids)))}
    used = Decimal(0)
    for r, member_id in zip(rows, ids, strict=True):
        user, profile = users[member_id], profiles.get(member_id)
        line = PlannedLine(
            depth=r.depth,
            member_id=member_id,
            is_ib=profile is not None,
            level=profile.level if profile else None,
            ib_status=profile.status if profile else None,
            member_status=user.status,
            level_rate=None,
            prev_max_rate=used,
        )
        result.lines.append(line)
        if profile is None:
            continue  # 일반 회원은 건너뛴다
        line.level_rate = policy.level_rates.get(profile.level, Decimal(0))
        if profile.status != affiliate.ACTIVE or user.status != "ACTIVE":
            line.result = SKIPPED_INACTIVE  # 비활성 IB는 받지도, 최고 비율을 올리지도 않는다
            continue
        if line.level_rate > used:
            line.applied_rate = line.level_rate - used
            line.amount = _cents_down(base * line.applied_rate / 100)
            used = line.level_rate
        line.result = PAID if line.amount > 0 else ZERO
    # 레벨 비율 ≤ 마케팅 비율이라 지급 합계는 예산을 넘지 않는다. 혹시 넘으면 계산 오류로 본다.
    if result.paid > budget:
        raise RuntimeError(f"IB 커미션 합계 {result.paid}가 예산 {budget}을 넘습니다.")
    return result


async def lock_wallets(session: AsyncSession, user_ids: list[uuid.UUID]) -> None:
    """지갑을 user_id 순서로 잠근다 (서로 다른 결제가 지갑을 반대 순서로 잠가 교착되지 않게)."""
    for user_id in sorted(set(user_ids), key=str):
        await get_wallet(session, user_id, lock=True)


async def apply(session: AsyncSession, plan_: Plan, order: ChallengeOrder) -> IbCommissionBatch:
    """계산 결과를 기록하고 IB 지갑에 적립한다."""
    policy = plan_.policy
    batch = IbCommissionBatch(
        order_id=order.id,
        buyer_id=plan_.buyer_id,
        base_amount=plan_.base,
        marketing_version_id=policy.marketing_version_id,
        marketing_rate=policy.marketing_rate,
        rate_set_id=policy.rate_set_id,
        budget=plan_.budget,
        paid_amount=plan_.paid,
        retained_amount=plan_.retained,
    )
    session.add(batch)
    await session.flush()
    payees = [ln for ln in plan_.lines if ln.amount > 0]
    journal = None
    if payees:
        journal = await _post_journal(
            session,
            entry_type="IB_COMMISSION",
            description=f"IB 커미션 적립 — 주문 {order.id} ({plan_.paid} USDT)",
            lines=[
                Line(IB_COMMISSION, debit=plan_.paid),
                *[Line(USER_WALLET, credit=ln.amount, user_id=ln.member_id) for ln in payees],
            ],
            reference_type="challenge_order",
            reference_id=order.id,
        )
        batch.journal_entry_id = journal.id
    for ln in plan_.lines:
        row = IbCommissionLine(
            batch_id=batch.id,
            depth=ln.depth,
            member_id=ln.member_id,
            is_ib=ln.is_ib,
            level=ln.level,
            ib_status=ln.ib_status,
            member_status=ln.member_status,
            level_rate=ln.level_rate,
            prev_max_rate=ln.prev_max_rate,
            applied_rate=ln.applied_rate,
            amount=ln.amount,
            result=ln.result,
        )
        if ln.amount > 0:
            wallet = await get_wallet(session, ln.member_id, lock=True)
            tx = await _change_balance(
                session, wallet, tx_type="IB_COMMISSION", direction="IN", amount=ln.amount,
                description=f"IB 커미션 (주문 {order.id}, {ln.applied_rate.normalize()}%)", journal=journal,
                reference_type="challenge_order", reference_id=order.id,
            )
            row.wallet_tx_id = tx.id
        session.add(row)
    await session.flush()
    logger.info(
        "IB 커미션: order=%s base=%s budget=%s paid=%s retained=%s payees=%d",
        order.id, plan_.base, plan_.budget, plan_.paid, plan_.retained, len(payees),
    )
    return batch


async def refund(
    session: AsyncSession, order: ChallengeOrder, refund_base: Decimal, refund_ref: str
) -> Decimal:
    """결제 금액 중 refund_base가 환불됐을 때 그 비율만큼 IB 커미션을 환수한다. 환수 합계를 돌려준다.

    누적 환불 비율로 목표 환수액을 정해 그 차이만 빼므로, 나눠서 환불돼도 전액 환불이면 정확히 전액 환수된다.
    IB 지갑이 모자라면 마이너스가 된다. 같은 refund_ref로 두 번 부르면 두 번째는 아무것도 하지 않는다.
    """
    if refund_base <= 0:
        return Decimal(0)
    batch = await session.scalar(
        select(IbCommissionBatch).where(IbCommissionBatch.order_id == order.id).with_for_update()
    )
    if batch is None or batch.base_amount <= 0:
        return Decimal(0)
    done = await session.scalar(
        select(IbCommissionClawback.id).where(
            IbCommissionClawback.batch_id == batch.id, IbCommissionClawback.refund_ref == refund_ref
        ).limit(1)
    )
    if done:
        return Decimal(0)
    refunded = min(batch.refunded_base + refund_base, batch.base_amount)
    batch.refunded_base = refunded
    lines = (
        await session.scalars(
            select(IbCommissionLine)
            .where(IbCommissionLine.batch_id == batch.id, IbCommissionLine.amount > 0)
            .order_by(IbCommissionLine.depth)
            .with_for_update()
        )
    ).all()
    takes: list[tuple[IbCommissionLine, Decimal]] = []
    for ln in lines:
        target = ln.amount if refunded >= batch.base_amount else (ln.amount * refunded / batch.base_amount).quantize(CENT, ROUND_HALF_UP)
        take = min(target, ln.amount) - ln.clawed_back_amount
        if take > 0:
            takes.append((ln, take))
    total = sum((t for _, t in takes), Decimal(0))
    if total <= 0:
        await session.flush()
        return Decimal(0)
    journal = await _post_journal(
        session,
        entry_type="IB_COMMISSION_CLAWBACK",
        description=f"IB 커미션 환수 — 주문 {order.id} 환불 {refund_base} USDT ({total} USDT)",
        lines=[
            *[Line(USER_WALLET, debit=t, user_id=ln.member_id) for ln, t in takes],
            Line(IB_COMMISSION, credit=total),
        ],
        reference_type="challenge_order",
        reference_id=order.id,
        reversed_entry_id=batch.journal_entry_id,
    )
    await lock_wallets(session, [ln.member_id for ln, _ in takes])
    for ln, take in takes:
        wallet = await get_wallet(session, ln.member_id, lock=True)
        tx = await _change_balance(
            session, wallet, tx_type="IB_COMMISSION_CLAWBACK", direction="OUT", amount=take,
            description=f"IB 커미션 환수 (주문 {order.id} 환불)", journal=journal,
            reference_type="challenge_order", reference_id=order.id, allow_negative=True,
        )
        ln.clawed_back_amount += take
        session.add(
            IbCommissionClawback(
                batch_id=batch.id, line_id=ln.id, refund_ref=refund_ref, refund_base=refund_base,
                amount=take, wallet_tx_id=tx.id, journal_entry_id=journal.id,
            )
        )
    batch.clawed_back_amount += total
    await session.flush()
    logger.info("IB 커미션 환수: order=%s refund=%s clawback=%s", order.id, refund_base, total)
    return total


async def negative_wallet(session: AsyncSession, user_id: uuid.UUID) -> bool:
    balance = await session.scalar(select(Wallet.balance_usdt).where(Wallet.user_id == user_id))
    return balance is not None and balance < 0


# ── 관리자 조회 ───────────────────────────────────────────


def _f(value: Decimal | None) -> float | None:
    return None if value is None else float(value)


def _brief(user: User | None) -> dict | None:
    if user is None:
        return None
    name = f"{user.first_name or ''} {user.last_name or ''}".strip() or None
    return {"user_id": str(user.id), "uid": user.uid, "name": name, "email": user.email}


async def _users(session: AsyncSession, ids) -> dict[uuid.UUID, User]:
    ids = {i for i in ids if i}
    if not ids:
        return {}
    return {u.id: u for u in await session.scalars(select(User).where(User.id.in_(ids)))}


def _user_match(keyword: str):
    pattern = affiliate._like(keyword.strip())
    return select(User.id).where(
        or_(
            User.uid.ilike(pattern),
            User.email.ilike(pattern),
            func.concat(User.first_name, " ", User.last_name).ilike(pattern),
        )
    )


async def list_commissions(
    session: AsyncSession,
    *,
    keyword: str | None,
    ib_user_id: uuid.UUID | None,
    start: datetime | None,
    end: datetime | None,
    page: int,
    size: int,
) -> dict:
    """IB별 지급 내역 (커미션 상세 화면). 지급액이 있는 줄만."""
    conds = [IbCommissionLine.amount > 0]
    if ib_user_id:
        conds.append(IbCommissionLine.member_id == ib_user_id)
    if keyword and keyword.strip():
        matched = _user_match(keyword)
        conds.append(
            or_(
                IbCommissionLine.member_id.in_(matched),
                IbCommissionBatch.buyer_id.in_(matched),
                IbCommissionBatch.order_id.ilike(affiliate._like(keyword.strip())),
            )
        )
    if start:
        conds.append(IbCommissionLine.created_at >= start)
    if end:
        conds.append(IbCommissionLine.created_at < end)
    base = (
        select(IbCommissionLine, IbCommissionBatch, ChallengeOrder.product_name)
        .join(IbCommissionBatch, IbCommissionBatch.id == IbCommissionLine.batch_id)
        .join(ChallengeOrder, ChallengeOrder.id == IbCommissionBatch.order_id)
        .where(*conds)
    )
    totals = (
        await session.execute(
            select(
                func.count(),
                func.coalesce(func.sum(IbCommissionLine.amount), 0),
                func.coalesce(func.sum(IbCommissionLine.clawed_back_amount), 0),
            )
            .select_from(IbCommissionLine)
            .join(IbCommissionBatch, IbCommissionBatch.id == IbCommissionLine.batch_id)
            .where(*conds)
        )
    ).one()
    rows = (
        await session.execute(
            base.order_by(IbCommissionLine.created_at.desc(), IbCommissionLine.id.desc())
            .offset((page - 1) * size)
            .limit(size)
        )
    ).all()
    users = await _users(session, [ln.member_id for ln, _, _ in rows] + [b.buyer_id for _, b, _ in rows])
    items = [
        {
            "id": ln.id,
            "created_at": ln.created_at,
            "order_id": b.order_id,
            "product_name": product_name,
            "base_amount": _f(b.base_amount),
            "buyer": _brief(users.get(b.buyer_id)),
            "ib": _brief(users.get(ln.member_id)),
            "depth": ln.depth,
            "level": ln.level,
            "level_rate": _f(ln.level_rate),
            "prev_max_rate": _f(ln.prev_max_rate),
            "applied_rate": _f(ln.applied_rate),
            "amount": _f(ln.amount),
            "clawed_back_amount": _f(ln.clawed_back_amount),
            "net_amount": _f(ln.amount - ln.clawed_back_amount),
            "status": "CLAWED_BACK" if ln.clawed_back_amount >= ln.amount else ("PARTIAL_CLAWBACK" if ln.clawed_back_amount > 0 else "CREDITED"),
        }
        for ln, b, product_name in rows
    ]
    count, paid, clawed = totals
    return {
        "items": items,
        "total": count,
        "page": page,
        "size": size,
        "summary": {"paid": _f(paid), "clawed_back": _f(clawed), "net": _f(paid - clawed)},
    }


def _batch_out(b: IbCommissionBatch, users: dict, product_name: str | None) -> dict:
    return {
        "id": b.id,
        "order_id": b.order_id,
        "product_name": product_name,
        "created_at": b.created_at,
        "buyer": _brief(users.get(b.buyer_id)),
        "base_amount": _f(b.base_amount),
        "marketing_rate": _f(b.marketing_rate),
        "budget": _f(b.budget),
        "paid_amount": _f(b.paid_amount),
        "retained_amount": _f(b.retained_amount),
        "refunded_base": _f(b.refunded_base),
        "clawed_back_amount": _f(b.clawed_back_amount),
    }


async def list_batches(
    session: AsyncSession, *, keyword: str | None, start: datetime | None, end: datetime | None, page: int, size: int
) -> dict:
    """주문(결제)별 예산·지급·회사 귀속 (커미션 플로우 목록)."""
    conds = []
    if keyword and keyword.strip():
        conds.append(
            or_(
                IbCommissionBatch.buyer_id.in_(_user_match(keyword)),
                IbCommissionBatch.order_id.ilike(affiliate._like(keyword.strip())),
                IbCommissionBatch.id.in_(
                    select(IbCommissionLine.batch_id).where(
                        IbCommissionLine.member_id.in_(_user_match(keyword)), IbCommissionLine.amount > 0
                    )
                ),
            )
        )
    if start:
        conds.append(IbCommissionBatch.created_at >= start)
    if end:
        conds.append(IbCommissionBatch.created_at < end)
    totals = (
        await session.execute(
            select(
                func.count(),
                func.coalesce(func.sum(IbCommissionBatch.base_amount), 0),
                func.coalesce(func.sum(IbCommissionBatch.budget), 0),
                func.coalesce(func.sum(IbCommissionBatch.paid_amount), 0),
                func.coalesce(func.sum(IbCommissionBatch.retained_amount), 0),
                func.coalesce(func.sum(IbCommissionBatch.clawed_back_amount), 0),
            ).where(*conds)
        )
    ).one()
    rows = (
        await session.execute(
            select(IbCommissionBatch, ChallengeOrder.product_name)
            .join(ChallengeOrder, ChallengeOrder.id == IbCommissionBatch.order_id)
            .where(*conds)
            .order_by(IbCommissionBatch.created_at.desc(), IbCommissionBatch.id.desc())
            .offset((page - 1) * size)
            .limit(size)
        )
    ).all()
    users = await _users(session, [b.buyer_id for b, _ in rows])
    count, base, budget, paid, retained, clawed = totals
    return {
        "items": [_batch_out(b, users, name) for b, name in rows],
        "total": count,
        "page": page,
        "size": size,
        "summary": {
            "base_amount": _f(base),
            "budget": _f(budget),
            "paid": _f(paid),
            "retained": _f(retained),
            "clawed_back": _f(clawed),
        },
    }


async def batch_detail(session: AsyncSession, order_id: str) -> dict:
    """주문 1건의 커미션 플로우: 결제 시점 경로 스냅샷과 단계별 지급·건너뜀."""
    row = (
        await session.execute(
            select(IbCommissionBatch, ChallengeOrder.product_name)
            .join(ChallengeOrder, ChallengeOrder.id == IbCommissionBatch.order_id)
            .where(IbCommissionBatch.order_id == order_id)
        )
    ).first()
    if row is None:
        raise AppError(404, "commission_not_found", "이 주문의 IB 커미션 기록이 없습니다.")
    batch, product_name = row
    lines = (
        await session.scalars(
            select(IbCommissionLine).where(IbCommissionLine.batch_id == batch.id).order_by(IbCommissionLine.depth)
        )
    ).all()
    users = await _users(session, [batch.buyer_id, *[ln.member_id for ln in lines]])
    out = _batch_out(batch, users, product_name)
    out["lines"] = [
        {
            "depth": ln.depth,
            "member": _brief(users.get(ln.member_id)),
            "is_ib": ln.is_ib,
            "level": ln.level,
            "ib_status": ln.ib_status,
            "member_status": ln.member_status,
            "level_rate": _f(ln.level_rate),
            "prev_max_rate": _f(ln.prev_max_rate),
            "applied_rate": _f(ln.applied_rate),
            "amount": _f(ln.amount),
            "clawed_back_amount": _f(ln.clawed_back_amount),
            "result": ln.result,
        }
        for ln in lines
    ]
    return out


async def totals_by_member(session: AsyncSession, member_ids: list[uuid.UUID]) -> dict[uuid.UUID, Decimal]:
    """회원별 순 커미션 합계 (적립 − 환수)."""
    if not member_ids:
        return {}
    rows = await session.execute(
        select(
            IbCommissionLine.member_id,
            func.sum(IbCommissionLine.amount - IbCommissionLine.clawed_back_amount),
        )
        .where(IbCommissionLine.member_id.in_(member_ids), IbCommissionLine.amount > 0)
        .group_by(IbCommissionLine.member_id)
    )
    return {m: v for m, v in rows.all()}
