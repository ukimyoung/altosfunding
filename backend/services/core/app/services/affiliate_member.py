"""회원용 제휴 프로그램(IB) 조회: 웹 'My Page > Affiliate Program'.

- 메뉴는 IB 프로필이 있는 회원에게만 보인다(/affiliate/me의 is_ib).
- 하위 회원의 이름·이메일은 가린다(본인만 그대로). 회원 식별은 UID로 한다(IB 번호 없음).
- 조직도의 커미션은 '그 회원이 직접 결제한 구매로 내가 받은 순 커미션'이다(본인 줄은 내 총 수령액). 하위 IB 본인의 수입은 보여 주지 않는다.
"""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import AppError
from app.models import (
    ChallengeOrder,
    IbCommissionBatch,
    IbCommissionLine,
    IbProfile,
    User,
)
from app.services import affiliate, ib_commission


def _mask(text: str | None, keep: int = 3) -> str:
    if not text:
        return ""
    if len(text) <= keep:
        return text[0] + "***"
    return text[:keep] + "***"


def mask_name(user: User) -> str:
    first = (user.first_name or "").strip()
    last = (user.last_name or "").strip()
    if not first and not last:
        return _mask(user.uid)
    if not (first + last).isascii():
        # 한글 등: 성명을 붙여 첫 글자·끝 글자만 (홍길동 → 홍*동, 이순 → 이*)
        full = first + last
        return (
            full[0] + "*"
            if len(full) <= 2
            else full[0] + "*" * (len(full) - 2) + full[-1]
        )
    head = _mask(first) if first else ""
    tail = f"{last[0]}." if last else ""
    return f"{head} {tail}".strip()


def mask_email(email: str | None) -> str:
    if not email or "@" not in email:
        return _mask(email)
    local, domain = email.split("@", 1)
    if len(local) <= 3:
        return f"{local[0]}***@{domain}"
    return f"{local[:3]}***{local[-1]}@{domain}"


def _member(user: User | None, *, self_id: uuid.UUID) -> dict | None:
    if user is None:
        return None
    if user.id == self_id:
        return {
            "uid": user.uid,
            "name": affiliate._name(user) or user.uid,
            "email": user.email,
        }
    return {"uid": user.uid, "name": mask_name(user), "email": mask_email(user.email)}


async def _profile(session: AsyncSession, user: User) -> IbProfile:
    profile = await session.get(IbProfile, user.id)
    if profile is None:
        raise AppError(403, "not_ib", "IB 파트너만 이용할 수 있습니다.")
    return profile


async def overview(session: AsyncSession, user: User) -> dict:
    profile = await session.get(IbProfile, user.id)
    if profile is None:
        return {"is_ib": False}
    now = affiliate._now()
    rate_set = await affiliate.rate_set_at(session, now)
    rates = await affiliate.rates_of(session, rate_set.id) if rate_set else {}
    totals = await ib_commission.totals_by_member(session, [user.id])
    tree = await affiliate.network(session, user)
    nodes = []
    stack = list(tree["root"]["children"])
    while stack:
        node = stack.pop()
        nodes.append(node)
        stack.extend(node["children"])
    return {
        "is_ib": True,
        "uid": user.uid,
        "level": profile.level,
        "status": profile.status,
        "commission_rate": float(rates.get(profile.level, Decimal(0))),
        "total_commission": float(totals.get(user.id, 0)),
        "network_total": len(nodes),
        "network_active": sum(
            1
            for n in nodes
            if n["member_status"] == "ACTIVE"
            and n["ib_status"] in (None, affiliate.ACTIVE)
        ),
    }


async def network(session: AsyncSession, user: User) -> dict:
    await _profile(session, user)
    tree = await affiliate.network(session, user)

    # 내 커미션 줄을 구매자별로 모아, 구매자와 그 위(내 아래) 노드에 더한다.
    rows = await session.execute(
        select(
            IbCommissionBatch.buyer_id,
            func.sum(IbCommissionLine.amount - IbCommissionLine.clawed_back_amount),
        )
        .join(IbCommissionBatch, IbCommissionBatch.id == IbCommissionLine.batch_id)
        .where(IbCommissionLine.member_id == user.id, IbCommissionLine.amount > 0)
        .group_by(IbCommissionBatch.buyer_id)
    )
    by_buyer = {str(b): v for b, v in rows.all()}
    users = {
        u.id: u
        for u in await session.scalars(
            select(User).where(User.id.in_(_ids(tree["root"])))
        )
    }

    # 각 회원 줄 = 그 회원이 직접 결제한 구매로 내가 받은 순 커미션 (하위 조직 합산 안 함, 2026-11-24 결정)
    def build(node: dict) -> dict:
        children = [build(child) for child in node["children"]]
        total = Decimal(by_buyer.get(node["user_id"], 0))
        out = {
            **_member(users.get(uuid.UUID(node["user_id"])), self_id=user.id),
            "depth": node["depth"],
            "is_ib": node["is_ib"],
            "level": node["level"],
            "ib_status": node["ib_status"],
            "member_status": node["member_status"],
            "commission": float(total),
            "children": children,
        }
        return out

    root = build(tree["root"])
    # 조직 밖으로 옮겨 간 구매자 몫까지 포함한 내 전체 순 커미션
    totals = await ib_commission.totals_by_member(session, [user.id])
    root["commission"] = float(totals.get(user.id, 0))
    return {
        "root": root,
        "total": tree["total"] - 1,
        "active": tree["active"],
        "truncated": tree["truncated"],
    }


def _ids(node: dict) -> list[uuid.UUID]:
    out = [uuid.UUID(node["user_id"])]
    for child in node["children"]:
        out.extend(_ids(child))
    return out


async def commissions(
    session: AsyncSession,
    user: User,
    *,
    keyword: str | None,
    start: datetime | None,
    end: datetime | None,
    page: int,
    size: int,
) -> dict:
    await _profile(session, user)
    conds = [IbCommissionLine.member_id == user.id, IbCommissionLine.amount > 0]
    if keyword and keyword.strip():
        kw = keyword.strip()
        pattern = affiliate._like(kw)
        matched = select(User.id).where(
            or_(
                User.uid.ilike(pattern),
                func.concat(User.first_name, " ", User.last_name).ilike(pattern),
            )
        )
        conds.append(
            or_(
                IbCommissionBatch.buyer_id.in_(matched),
                IbCommissionBatch.order_id.ilike(pattern),
            )
        )
    if start:
        conds.append(IbCommissionLine.created_at >= start)
    if end:
        conds.append(IbCommissionLine.created_at < end)
    joined = (
        select(IbCommissionLine, IbCommissionBatch, ChallengeOrder.product_name)
        .join(IbCommissionBatch, IbCommissionBatch.id == IbCommissionLine.batch_id)
        .join(ChallengeOrder, ChallengeOrder.id == IbCommissionBatch.order_id)
        .where(*conds)
    )
    count, paid, clawed = (
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
            joined.order_by(
                IbCommissionLine.created_at.desc(), IbCommissionLine.id.desc()
            )
            .offset((page - 1) * size)
            .limit(size)
        )
    ).all()
    buyers = (
        {
            u.id: u
            for u in await session.scalars(
                select(User).where(User.id.in_({b.buyer_id for _, b, _ in rows}))
            )
        }
        if rows
        else {}
    )
    items = []
    for ln, b, product_name in rows:
        if ln.clawed_back_amount >= ln.amount:
            status = "REFUNDED"
        elif ln.clawed_back_amount > 0:
            status = "PARTIAL_REFUND"
        else:
            status = "COMPLETED"
        items.append(
            {
                "id": ln.id,
                "created_at": ln.created_at,
                "order_id": b.order_id,
                "product_name": product_name,
                "buyer": _member(buyers.get(b.buyer_id), self_id=user.id),
                "depth": ln.depth,
                "base_amount": float(b.base_amount),
                "applied_rate": float(ln.applied_rate),
                "amount": float(ln.amount),
                "clawed_back_amount": float(ln.clawed_back_amount),
                "net_amount": float(ln.amount - ln.clawed_back_amount),
                "status": status,
            }
        )
    return {
        "items": items,
        "total": count,
        "page": page,
        "size": size,
        "summary": {
            "paid": float(paid),
            "clawed_back": float(clawed),
            "net": float(paid - clawed),
        },
    }
