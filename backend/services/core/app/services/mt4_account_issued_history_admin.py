"""MT4 계좌번호 기록 관리 (백오피스 운영 관리 > 계좌 관리).

발급(app/jobs/mt4.py _reserve_login)은 새 번호를 core.mt4_account_issued_history에 넣다가 충돌하면 그 번호를 건너뛴다.
그래서 관리자가 BLACKLISTED 행을 미리 넣어 두기만 하면 발급 대상에서 빠진다.

- 등록: 비어 있는 번호는 BLACKLISTED(source=ADMIN)로 넣고, 정리 대상(ORPHANED)은 BLACKLISTED로 바꾼다.
  사용 중(IN_USE)·발급 중(RESERVED)·이미 블랙리스트인 번호는 건너뛴다.
- 해제: 관리자가 등록한 BLACKLISTED만 행을 지운다. 자동 블랙리스트(SYSTEM)는 MT4에 실제 계좌가 있는 번호라 해제할 수 없다.
  번호 카운터는 올라가기만 하므로, 이미 지나간 번호는 해제해도 다시 발급되지 않는다.
"""

from sqlalchemy import String, cast, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import AppError
from app.models import Mt4AccountIssuedHistory, Product, User
from app.services import mt4

MAX_RANGE = 1000
SERVERS = (mt4.DEMO, mt4.LIVE)


def tiers_of_server(server: str) -> list[str]:
    return [tier for tier, s in mt4.SERVER_OF_TIER.items() if s == server]


async def login_pools(session: AsyncSession, server: str) -> list[dict]:
    """서버에서 번호를 나눠 주는 상품별 범위와 현재 카운터."""
    rows = await session.scalars(
        select(Product).where(Product.tier_type.in_(tiers_of_server(server))).order_by(Product.tier_type, Product.product_id)
    )
    return [
        {
            "product_id": p.product_id,
            "name": p.name,
            "tier_type": p.tier_type,
            "is_active": p.is_active,
            "pool_start": p.mt4_login_pool_start,
            "pool_end": p.mt4_login_pool_end,
            "last_mt4_login": p.last_mt4_login,
            # 다음 발급 때 확인할 번호 (블랙리스트 등 기록된 번호는 그때 건너뛴다)
            "next_login": (p.last_mt4_login + 1) if p.last_mt4_login is not None else p.mt4_login_pool_start,
        }
        for p in rows
    ]


def _pool_products(login: int, pools: list[dict]) -> list[dict]:
    """번호가 속한 상품 범위와, 그 상품의 카운터가 이미 지나갔는지."""
    return [
        {
            "product_id": p["product_id"],
            "name": p["name"],
            "passed": p["last_mt4_login"] is not None and p["last_mt4_login"] >= login,
        }
        for p in pools
        if p["pool_start"] <= login <= p["pool_end"]
    ]


async def list_logins(
    session: AsyncSession,
    *,
    server: str,
    status: str | None,
    source: str | None,
    login: str | None,
    page: int,
    page_size: int,
) -> dict:
    query = (
        select(Mt4AccountIssuedHistory, Product.name, User.email)
        .outerjoin(Product, Product.product_id == Mt4AccountIssuedHistory.product_id)
        .outerjoin(User, User.id == Mt4AccountIssuedHistory.created_by)
        .where(Mt4AccountIssuedHistory.mt4_server == server)
    )
    if status:
        query = query.where(Mt4AccountIssuedHistory.status == status)
    if source:
        query = query.where(Mt4AccountIssuedHistory.source == source)
    if login:
        query = query.where(cast(Mt4AccountIssuedHistory.mt4_login, String).like(f"%{login}%"))
    total = await session.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = (
        await session.execute(
            query.order_by(Mt4AccountIssuedHistory.updated_at.desc(), Mt4AccountIssuedHistory.mt4_login.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()
    counts = dict(
        (
            await session.execute(
                select(Mt4AccountIssuedHistory.status, func.count()).where(Mt4AccountIssuedHistory.mt4_server == server).group_by(Mt4AccountIssuedHistory.status)
            )
        ).all()
    )
    pools = await login_pools(session, server)
    return {
        "items": [
            {
                "mt4_server": row.mt4_server,
                "mt4_login": row.mt4_login,
                "status": row.status,
                "source": row.source,
                "reason": row.reason,
                "product_id": row.product_id,
                "product_name": product_name,
                "account_id": str(row.account_id) if row.account_id else None,
                "created_by_email": email,
                "created_at": row.created_at,
                "updated_at": row.updated_at,
                "pool_products": _pool_products(row.mt4_login, pools),
            }
            for row, product_name, email in rows
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "counts": {s: counts.get(s, 0) for s in ("BLACKLISTED", "IN_USE", "RESERVED", "ORPHANED")},
    }


async def add_blacklist(
    session: AsyncSession, admin: User, *, server: str, login_from: int, login_to: int | None, reason: str
) -> dict:
    login_to = login_from if login_to is None else login_to
    if login_to < login_from:
        raise AppError(400, "invalid_login_range", "끝 번호는 시작 번호보다 크거나 같아야 합니다.")
    if login_to - login_from + 1 > MAX_RANGE:
        raise AppError(400, "login_range_too_large", f"한 번에 {MAX_RANGE}개까지 등록할 수 있습니다.")

    logins = list(range(login_from, login_to + 1))
    added = list(
        await session.scalars(
            insert(Mt4AccountIssuedHistory)
            .values(
                [
                    {"mt4_server": server, "mt4_login": n, "status": "BLACKLISTED", "reason": reason,
                     "source": "ADMIN", "created_by": admin.id}
                    for n in logins
                ]
            )
            .on_conflict_do_nothing()
            .returning(Mt4AccountIssuedHistory.mt4_login)
        )
    )
    taken = set(added)
    existing = await session.scalars(
        select(Mt4AccountIssuedHistory)
        .where(Mt4AccountIssuedHistory.mt4_server == server, Mt4AccountIssuedHistory.mt4_login.in_([n for n in logins if n not in taken]))
        .with_for_update()
    )
    converted: list[int] = []
    skipped: list[dict] = []
    for row in existing:
        if row.status == "ORPHANED":
            # MT4에서 정리를 확인한 정리 대상 번호를 블랙리스트로 바꾼다 (다시 쓰지 않음).
            row.status, row.source, row.created_by = "BLACKLISTED", "ADMIN", admin.id
            row.reason = reason
            converted.append(row.mt4_login)
        else:
            skipped.append({"mt4_login": row.mt4_login, "status": row.status, "source": row.source})
    await session.commit()
    return {
        "added": sorted(added),
        "converted": sorted(converted),
        "skipped": sorted(skipped, key=lambda r: r["mt4_login"]),
    }


async def release_blacklist(session: AsyncSession, server: str, login: int) -> None:
    row = await session.get(Mt4AccountIssuedHistory, (server, login), with_for_update=True)
    if row is None:
        raise AppError(404, "mt4_login_not_found", "등록된 번호가 아닙니다.")
    if row.status != "BLACKLISTED" or row.source != "ADMIN":
        raise AppError(409, "mt4_login_not_releasable", "관리자가 등록한 블랙리스트만 해제할 수 있습니다.")
    await session.delete(row)
    await session.commit()
