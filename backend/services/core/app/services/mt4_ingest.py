"""MT4 거래 내역·잔고(equity) 수집. Worker가 주기마다(기본 60초) 부른다.

기존 서버(altos_funding_backend/app/domains/trading/sync_service.py)와 같은 API·같은 저장 기준을 쓰되,
계좌 50개씩 돌려 가며 받던 방식 대신 매 주기 대상 계좌 전체를 동시에(기본 10개씩)조회한다.

대상 계좌
- 발급이 끝났고(provision DONE) MT4 번호가 있는 계좌 중 거래 가능 상태(ACTIVE)인 계좌
- ACTIVE를 벗어난 계좌(대회 종료·비활성·정지 등)는 처음 본 뒤 MT4_INGEST_AFTER_CLOSE_SECONDS(기본 30분) 동안
  더 수집해 종료 청산 내역까지 받고 멈춘다 (trading_account_sync.final_synced_at). 다시 ACTIVE가 되면 이어서 수집한다.
- 대회 시작 전(PENDING) 계좌는 거래가 잠겨 있어 수집하지 않는다.

계좌 하나 처리
1. 조회 기간: 마지막으로 받은 청산 시각 − 겹침 구간(기본 1시간) ~ 지금 + 1일. 처음이면 MT4 계좌 생성 시각부터.
   기간은 MT4 서버 시간대(MT4_SERVER_TIMEZONE, 기본 Europe/Athens) 시각 문자열로 보낸다 (기존 서버와 같음).
2. GET /api/mt4/accounts/{login}/orders/all: 기간 안에 청산된 주문 + 지금 열린 포지션.
3. core.trading_account_trades에 (계좌, MT4 주문번호) 기준으로 덮어쓴다 → 몇 번을 다시 받아도 중복 없음.
   열린 포지션은 is_open = true, 청산되면 같은 행이 청산 값으로 바뀐다. 응답에서 사라진 열린 포지션 행은 지운다.
4. 잔고·평가금액: 서버별 POST /api/mt4/accounts/balances로 한 번에 받고, 빠진 계좌만 GET …/{login}/balance.
   최신 값은 trading_accounts.balance·equity…에, 이력은 MT4_EQUITY_SNAPSHOT_SECONDS(기본 5분) 간격으로 쌓는다.
5. 실패하면 커서를 그대로 두고 trading_account_sync에 오류·연속 실패 수를 남긴다 → 다음 주기에 같은 기간부터 다시 받는다.

손실 한도·수익 목표 자동 판정과 위반 시 잠금·청산은 이번 범위가 아니다 (사용자 결정 2026-11-19).
"""

import asyncio
import logging
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from decimal import Decimal, InvalidOperation
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import and_, delete, func, or_, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import settings
from app.models import TradingAccount, TradingAccountEquitySnapshot, TradingAccountSync, TradingAccountTrade
from app.services import challenge_order as orders
from app.services import mt4

logger = logging.getLogger(__name__)

# MT4 order type → 화면용 구분 (기존 서버와 같은 기준: 문자열에 Buy/Sell/Balance/Credit이 들어 있는지)
BUY, SELL, BALANCE, CREDIT, OTHER = "BUY", "SELL", "BALANCE", "CREDIT", "OTHER"
TRADE_ACTIONS = (BUY, SELL)
# 대회 시작 전 계좌 상태 (거래 잠금 상태라 수집하지 않는다)
ACCOUNT_PENDING = "PENDING"
# 잔고 일괄 조회 한 번에 넣는 계좌 수
BALANCES_CHUNK = 100
# 이보다 이른 시각은 '없음'으로 본다 (열린 포지션의 청산 시각이 1970-01-01로 오는 경우)
EPOCH_FLOOR = datetime(2000, 1, 1, tzinfo=UTC)


def server_zone() -> ZoneInfo:
    try:
        return ZoneInfo(settings.mt4_server_timezone or "UTC")
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("UTC")


def to_server_time(value: datetime) -> str:
    return value.astimezone(server_zone()).strftime("%Y-%m-%dT%H:%M:%S")


def parse_time(value: Any) -> datetime | None:
    """MT4 응답 시각. 시간대가 붙어 있으면 그대로, 없으면 MT4 서버 시간대로 읽는다."""
    if not value or not isinstance(value, str):
        return None
    text = value.strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=server_zone())
    parsed = parsed.astimezone(UTC)
    return parsed if parsed >= EPOCH_FLOOR else None


def action_of(order_type: str) -> str:
    t = (order_type or "").lower()
    if "buy" in t:
        return BUY
    if "sell" in t:
        return SELL
    if "balance" in t:
        return BALANCE
    if "credit" in t:
        return CREDIT
    return OTHER


def _dec(value: Any, default: Decimal | None = None) -> Decimal | None:
    if value is None or value == "":
        return default
    try:
        number = Decimal(str(value))
    except (InvalidOperation, ValueError):
        return default
    return number if number.is_finite() else default


def trade_values(account_id: uuid.UUID, login: int, order: dict, now: datetime) -> dict | None:
    """MT4 주문(OrderI) 한 건 → core.trading_account_trades 값. 주문번호가 없으면 None."""
    try:
        number = int(order.get("order") or 0)
    except (TypeError, ValueError):
        return None
    if number <= 0:
        return None
    order_type = str(order.get("type") or "")
    close_time = parse_time(order.get("dateClose"))
    zero = Decimal("0")
    return {
        "account_id": account_id,
        "mt4_order": number,
        "mt4_login": login,
        "type": order_type or "Unknown",
        "action": action_of(order_type),
        "is_open": close_time is None,
        "symbol": order.get("symbol") or None,
        "volume": _dec(order.get("volume"), zero),
        "open_time": parse_time(order.get("dateOpen")),
        "open_price": _dec(order.get("priceOpen")),
        "close_time": close_time,
        "close_price": _dec(order.get("priceClose")) if close_time else None,
        "stop_loss": _dec(order.get("stopLoss")),
        "take_profit": _dec(order.get("takeProfit")),
        "profit": _dec(order.get("profit"), zero),
        "commission": _dec(order.get("commission"), zero),
        "swap": _dec(order.get("swap"), zero),
        "taxes": _dec(order.get("taxes"), zero),
        "contract_size": _dec(order.get("contractSize")),
        "base_currency": order.get("symbolBaseCurrency") or None,
        "quote_currency": order.get("symbolQuoteCurrency") or None,
        "comment": order.get("comment") or None,
        "reason": order.get("reason") or None,
        "raw": order,
        "updated_at": now,
    }


# ── 대상 계좌 ───────────────────────────────────────────────


@dataclass
class Target:
    account_id: uuid.UUID
    mt4_server: str
    mt4_login: int
    status: str
    since: datetime  # 처음 수집할 때의 조회 시작 시각 (MT4 계좌 생성 시각)
    last_close_time: datetime | None
    last_snapshot_at: datetime | None
    inactive_since: datetime | None

    @property
    def tradable(self) -> bool:
        return self.status in orders.TRADABLE_STATUSES


async def load_targets(session: AsyncSession, now: datetime) -> list[Target]:
    sync = TradingAccountSync
    a = TradingAccount
    rows = await session.execute(
        select(
            a.id, a.mt4_server, a.mt4_login, a.status, a.mt4_created_at, a.issued_at, a.created_at,
            sync.last_close_time, sync.last_snapshot_at, sync.inactive_since,
        )
        .outerjoin(sync, sync.account_id == a.id)
        .where(
            a.provision_status == orders.DONE,
            a.mt4_login.is_not(None),
            or_(
                a.status.in_(orders.TRADABLE_STATUSES),
                and_(
                    # ACTIVE를 벗어난 계좌: 마지막 수집을 아직 안 끝냈고, 한 번이라도 거래 가능했던 계좌
                    sync.final_synced_at.is_(None),
                    a.status != ACCOUNT_PENDING,
                    or_(sync.last_synced_at.is_not(None), and_(a.start_at.is_not(None), a.start_at <= now)),
                ),
            ),
        )
        .order_by(a.mt4_server, a.mt4_login)
    )
    return [
        Target(
            account_id=r[0], mt4_server=r[1], mt4_login=int(r[2]), status=r[3],
            since=r[4] or r[5] or r[6], last_close_time=r[7], last_snapshot_at=r[8], inactive_since=r[9],
        )
        for r in rows.all()
    ]


# ── 저장 ────────────────────────────────────────────────────


async def save_orders(session: AsyncSession, target: Target, raw_orders: list[dict], now: datetime) -> tuple[int, datetime | None]:
    """주문을 덮어쓰고, 응답에 없는 열린 포지션 행을 지운다. (저장 건수, 가장 늦은 청산 시각)."""
    values = [v for v in (trade_values(target.account_id, target.mt4_login, o, now) for o in raw_orders) if v]
    # 같은 응답에 같은 주문번호가 두 번 오면 마지막 것을 쓴다 (ON CONFLICT는 한 문장 안 중복을 못 받는다).
    by_order = {v["mt4_order"]: v for v in values}
    rows = list(by_order.values())
    for start in range(0, len(rows), 500):
        chunk = rows[start : start + 500]
        stmt = insert(TradingAccountTrade).values(chunk)
        updatable = {c: stmt.excluded[c] for c in chunk[0] if c not in ("account_id", "mt4_order")}
        await session.execute(
            stmt.on_conflict_do_update(index_elements=["account_id", "mt4_order"], set_=updatable)
        )
    open_orders = [v["mt4_order"] for v in rows if v["is_open"]]
    gone = delete(TradingAccountTrade).where(
        TradingAccountTrade.account_id == target.account_id, TradingAccountTrade.is_open.is_(True)
    )
    if open_orders:
        gone = gone.where(TradingAccountTrade.mt4_order.not_in(open_orders))
    await session.execute(gone)
    closes = [v["close_time"] for v in rows if v["close_time"] is not None]
    return len(rows), max(closes) if closes else None


async def save_balance(session: AsyncSession, target: Target, data: dict, now: datetime) -> bool:
    """최근 잔고·평가금액을 계좌에 넣고, 간격이 지났으면 이력에도 쌓는다. 이력을 쌓았으면 True."""
    balance, equity = _dec(data.get("balance")), _dec(data.get("equity"))
    if balance is None or equity is None:
        return False
    values = {
        "balance": balance,
        "equity": equity,
        "credit": _dec(data.get("credit")),
        "margin": _dec(data.get("margin")),
        "free_margin": _dec(data.get("marginFree")),
        "margin_level": _dec(data.get("marginLevel")),
    }
    await session.execute(
        update(TradingAccount)
        .where(TradingAccount.id == target.account_id)
        # 수집 갱신은 계좌 '수정 시각'을 건드리지 않는다.
        .values(**values, equity_updated_at=now, updated_at=TradingAccount.updated_at)
    )
    interval = timedelta(seconds=settings.mt4_equity_snapshot_seconds)
    if target.last_snapshot_at is not None and now - target.last_snapshot_at < interval:
        return False
    session.add(TradingAccountEquitySnapshot(account_id=target.account_id, taken_at=now, **values))
    return True


async def record_success(
    session: AsyncSession, target: Target, now: datetime, *, count: int, last_close: datetime | None, snapshot: bool
) -> None:
    cursor = target.last_close_time
    if last_close is not None and (cursor is None or last_close > cursor):
        cursor = last_close
    inactive_since = None if target.tradable else (target.inactive_since or now)
    final = None
    if inactive_since is not None and now - inactive_since >= timedelta(seconds=settings.mt4_ingest_after_close_seconds):
        final = now
    values = {
        "last_close_time": cursor,
        "last_synced_at": now,
        "last_trades_count": count,
        "consecutive_failures": 0,
        "inactive_since": inactive_since,
        "final_synced_at": final,
        "updated_at": now,
    }
    if snapshot:
        values["last_snapshot_at"] = now
    stmt = insert(TradingAccountSync).values(account_id=target.account_id, **values)
    await session.execute(stmt.on_conflict_do_update(index_elements=["account_id"], set_=values))


async def record_failure(session: AsyncSession, target: Target, now: datetime, error: str) -> None:
    stmt = insert(TradingAccountSync).values(
        account_id=target.account_id, last_error=error[:1000], last_error_at=now, consecutive_failures=1, updated_at=now
    )
    await session.execute(
        stmt.on_conflict_do_update(
            index_elements=["account_id"],
            set_={
                "last_error": stmt.excluded.last_error,
                "last_error_at": now,
                "consecutive_failures": TradingAccountSync.consecutive_failures + 1,
                "updated_at": now,
            },
        )
    )


# ── 주기 실행 ───────────────────────────────────────────────


@dataclass
class Counts:
    accounts: int = 0
    ok: int = 0
    failed: int = 0
    trades: int = 0
    unconfigured: int = 0
    errors: list[str] = field(default_factory=list)

    def out(self) -> dict:
        return {
            "accounts": self.accounts, "ok": self.ok, "failed": self.failed,
            "trades": self.trades, "unconfigured": self.unconfigured,
        }


def window(target: Target, now: datetime) -> tuple[str, str]:
    overlap = timedelta(seconds=settings.mt4_ingest_overlap_seconds)
    start = (target.last_close_time or target.since or now) - overlap
    # dateTo는 청산 시각에만 걸린다. 넉넉히 미래로 잡아 시간대 차이로 막 청산된 주문을 놓치지 않는다.
    return to_server_time(start), to_server_time(now + timedelta(days=1))


async def _balances(client: mt4.Mt4Client, logins: list[int]) -> dict[int, dict]:
    found: dict[int, dict] = {}
    for start in range(0, len(logins), BALANCES_CHUNK):
        chunk = logins[start : start + BALANCES_CHUNK]
        try:
            items = await client.balances(chunk)
        except mt4.Mt4Error as exc:
            logger.warning("MT4 %s 잔고 일괄 조회 실패(계좌별로 다시 조회): %s", client.server, exc)
            continue
        for item in items:
            try:
                found[int(item.get("login"))] = item
            except (TypeError, ValueError):
                continue
    return found


async def _sync_one(
    sessionmaker: async_sessionmaker[AsyncSession], client: mt4.Mt4Client, target: Target,
    balance: dict | None, now: datetime, counts: Counts,
) -> None:
    try:
        date_from, date_to = window(target, now)
        raw = await client.all_orders(target.mt4_login, date_from, date_to)
        if balance is None:
            balance = await client.balance(target.mt4_login)
        async with sessionmaker() as session:
            count, last_close = await save_orders(session, target, raw, now)
            snapshot = await save_balance(session, target, balance, now) if balance else False
            await record_success(session, target, now, count=count, last_close=last_close, snapshot=snapshot)
            await session.commit()
        counts.ok += 1
        counts.trades += count
    except Exception as exc:  # 계좌 하나의 실패가 다른 계좌 수집을 막지 않는다.
        counts.failed += 1
        message = str(exc) if isinstance(exc, mt4.Mt4Error) else f"{type(exc).__name__}: {exc}"
        logger.warning("MT4 수집 실패 %s login=%s: %s", target.mt4_server, target.mt4_login, message)
        try:
            async with sessionmaker() as session:
                await record_failure(session, target, now, message)
                await session.commit()
        except Exception:
            logger.exception("MT4 수집 실패 기록 실패 login=%s", target.mt4_login)


async def run(sessionmaker: async_sessionmaker[AsyncSession], now: datetime | None = None) -> dict:
    """대상 계좌 전체를 한 번 수집한다. 결과 건수를 돌려준다 (Worker 로그·생존 기록용)."""
    now = now or datetime.now(UTC)
    async with sessionmaker() as session:
        targets = await load_targets(session, now)
    counts = Counts(accounts=len(targets))
    if not targets:
        return counts.out()
    semaphore = asyncio.Semaphore(max(1, settings.mt4_ingest_concurrency))
    by_server: dict[str, list[Target]] = {}
    for t in targets:
        by_server.setdefault(t.mt4_server, []).append(t)

    for server, group in by_server.items():
        client = mt4.client_for(server)
        if not client.base_url or not client.api_key:
            counts.unconfigured += len(group)
            continue
        async with client:
            balances = await _balances(client, [t.mt4_login for t in group])

            async def one(t: Target) -> None:
                async with semaphore:
                    await _sync_one(sessionmaker, client, t, balances.get(t.mt4_login), now, counts)

            await asyncio.gather(*(one(t) for t in group))
    return counts.out()


# ── 조회 (화면용) ───────────────────────────────────────────


def trade_out(t: TradingAccountTrade) -> dict:
    """기존 서버 TradeOut과 같은 모양 (웹 거래내역·백오피스 계좌 상세)."""
    return {
        "deal_id": t.mt4_order,
        "date": t.close_time,
        "symbol": t.symbol or "",
        "action": t.action,
        "volume": float(t.volume or 0),
        "price": float(t.open_price or 0),
        "close_price": float(t.close_price) if t.close_price is not None else None,
        "open_time": t.open_time,
        "profit": float(t.profit or 0),
        "fee": float(t.commission or 0),
        "commission": float(t.commission or 0),
        "swap": float(t.swap or 0),
        "taxes": float(t.taxes or 0),
        "entry": "Out",
        "comment": t.comment,
    }


async def closed_trades(
    session: AsyncSession, account_id: uuid.UUID, *, page: int, size: int,
    date_from: datetime | None = None, date_to: datetime | None = None,
) -> tuple[list[dict], int]:
    """청산된 매수·매도 거래 (잔고 입출금·열린 포지션 제외), 청산 시각 최신순."""
    filters = [
        TradingAccountTrade.account_id == account_id,
        TradingAccountTrade.is_open.is_(False),
        TradingAccountTrade.action.in_(TRADE_ACTIONS),
    ]
    if date_from:
        filters.append(TradingAccountTrade.close_time >= date_from)
    if date_to:
        filters.append(TradingAccountTrade.close_time <= date_to)
    total = await session.scalar(select(func.count()).select_from(TradingAccountTrade).where(*filters)) or 0
    rows = await session.scalars(
        select(TradingAccountTrade)
        .where(*filters)
        .order_by(TradingAccountTrade.close_time.desc(), TradingAccountTrade.mt4_order.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    return [trade_out(t) for t in rows], total
