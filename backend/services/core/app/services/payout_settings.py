"""백오피스 '시스템 > 수익 분배 설정': 기본 분배 비율과 네트워크별 출금 수수료 (기존 서버 payout_settings_service와 같음).

core.platform_config PAYOUT scope
- profit_split_pct: 트레이더 몫 % (50~100). 바꿀 때마다 core.platform_config_history에 남긴다.
- network_fees: [{name, desc, fee, is_active}] — 웹 입금·출금 팝업의 네트워크 목록과 출금 수수료
"""

import math

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import AppError
from app.models import PlatformConfig, PlatformConfigHistory, User
from app.services.wallet import get_network_fees, normalize_network

SCOPE = "PAYOUT"
PROFIT_SPLIT_KEY = "profit_split_pct"
NETWORK_FEES_KEY = "network_fees"
DEFAULT_PROFIT_SPLIT = 80.0


async def _save(session: AsyncSession, key: str, value: object, description: str) -> None:
    await session.execute(
        pg_insert(PlatformConfig)
        .values(scope=SCOPE, key=key, value=value, description=description)
        .on_conflict_do_update(index_elements=["scope", "key"], set_={"value": value})
    )


async def get_profit_split(session: AsyncSession) -> dict:
    value = await session.scalar(
        select(PlatformConfig.value).where(PlatformConfig.scope == SCOPE, PlatformConfig.key == PROFIT_SPLIT_KEY)
    )
    trader = round(float(value), 2) if isinstance(value, (int, float)) else DEFAULT_PROFIT_SPLIT
    return {"trader_pct": trader, "company_pct": round(100 - trader, 2)}


async def set_profit_split(session: AsyncSession, admin: User, trader_pct: float) -> dict:
    if trader_pct < 50 or trader_pct > 100:
        raise AppError(422, "invalid_profit_split", "트레이더 수익 비율은 50% 이상 100% 이하여야 합니다.")
    new = round(trader_pct, 2)
    old = (await get_profit_split(session))["trader_pct"]
    if new != old:
        await _save(session, PROFIT_SPLIT_KEY, new, "트레이더 수익 배분율 (%) — 나머지는 플랫폼 몫")
        session.add(
            PlatformConfigHistory(scope=SCOPE, key=PROFIT_SPLIT_KEY, old_value=old, new_value=new, changed_by=admin.id)
        )
        await session.commit()
    return await get_profit_split(session)


async def profit_split_history(session: AsyncSession, page: int, size: int) -> dict:
    cond = (PlatformConfigHistory.scope == SCOPE, PlatformConfigHistory.key == PROFIT_SPLIT_KEY)
    total = await session.scalar(select(func.count()).select_from(PlatformConfigHistory).where(*cond)) or 0
    rows = (
        await session.execute(
            select(PlatformConfigHistory, User.email)
            .outerjoin(User, User.id == PlatformConfigHistory.changed_by)
            .where(*cond)
            .order_by(PlatformConfigHistory.created_at.desc(), PlatformConfigHistory.id.desc())
            .offset((page - 1) * size)
            .limit(size)
        )
    ).all()
    items = [
        {
            "id": h.id,
            "old_pct": float(h.old_value) if h.old_value is not None else None,
            "new_pct": float(h.new_value),
            "admin_email": email,
            "changed_at": h.created_at,
        }
        for h, email in rows
    ]
    return {"items": items, "total": total, "page": page, "size": size, "pages": math.ceil(total / size) if size else 0}


async def set_network_fees(session: AsyncSession, networks: list[dict]) -> list[dict]:
    rows: list[dict] = []
    seen: set[str] = set()
    for item in networks:
        name = str(item.get("name") or "").strip()
        if not name:
            raise AppError(422, "invalid_network", "네트워크 이름을 입력해 주세요.")
        key = normalize_network(name)
        if key in seen:
            raise AppError(422, "duplicate_network", f"네트워크 이름이 중복되었습니다: {name}")
        seen.add(key)
        fee = float(item.get("fee") or 0)
        if fee < 0 or round(fee, 2) != fee:
            raise AppError(422, "invalid_network", f"{name} 수수료는 0 이상, 소수점 둘째 자리까지 입력할 수 있습니다.")
        rows.append(
            {"name": name, "desc": str(item.get("desc") or "").strip(), "fee": fee, "is_active": bool(item.get("is_active", True))}
        )
    await _save(session, NETWORK_FEES_KEY, rows, "네트워크별 출금 수수료")
    await session.commit()
    return await get_network_fees(session)
