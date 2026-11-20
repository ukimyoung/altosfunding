"""트레이딩 룰 자동 검증. Worker가 주기마다(기본 60초) run()을 부른다.

설계: 트레이딩 룰 자동 검증 설계 제안 (2026-11-20 사용자 확정 사항).

거래일
- 거래일 = RISK_TRADING_TIMEZONE(기본 Europe/Athens = MT4 서버 시각) 날짜.
  마감 = 그 날짜 다음 날 0시 (KST 06:00 여름 / 07:00 겨울, 뉴욕 17:00과 같음).
- 마감 후 RISK_CLOSE_GRACE_SECONDS(기본 5분) 기다렸다가 결산한다 (마감 직전 청산 내역 수집 대기).

1분 감시 (거래 가능한 ACTIVE 챌린지·펀디드 계좌, 최근 평가금액이 3분 이내인 계좌만)
- Max Drawdown: 평가금액(미실현 포함) ≤ 기준선(floor)이면 위반(HARD).
  floor 시작 = 자본금 − DD금액. 룰셋 dd_calc_method가 EOD면 마감마다 floor = max(floor, 마감 평가금액 − DD금액),
  INTRADAY면 감시 때마다 올리고, STATIC이면 고정. 상한 없음 (자본금에서 멈추지 않음).
- 펀디드 Daily Loss: 오늘 시작 잔고(전 거래일 마감 잔고) − 평가금액 ≥ 한도면 위반(HARD). 챌린지에는 적용 안 함.

일일 마감 결산 (core.account_daily_stats)
- 마감 평가금액·잔고, 하루 손익(마감 평가금액 − 시작 평가금액), 최저·최고 평가금액,
  체결 수(그날 진입 + 청산된 매수·매도). 체결이 1건이라도 있으면 거래일로 인정.
- 챌린지 Consistency: 하루 최대 수익 ÷ 전체 순수익 > 기준이면 경고(WARN). 확정은 최종 판정에서.

대회 종료 최종 판정
- 대회 종료(관리자 조기 종료면 그 시각) 후 RISK_FINAL_DELAY_SECONDS(기본 10분)가 지나면
  남은 거래일을 종료 시각까지 결산하고 challenge_evaluation.evaluate(source=AUTO)로 판정을 한 줄 기록한다.

조치 (2단계, RISK_ENFORCE=true. false면 기록만: rule_violations.mode = SHADOW)
- Max Drawdown 위반 → 계좌 FAILED + MT4 읽기 전용 + 전량 청산 (mt4.close_all_and_lock) + 위반 안내 메일.
- 펀디드 Daily Loss 위반 → 그날만 정지: 전량 청산 + 읽기 전용, trading_halted_until = 다음 거래일 시작.
  상태는 ACTIVE 유지, 다음 거래일이 되면 감시가 읽기 전용을 푼다.
- 대회 종료 → 거래 중이던 계좌 전량 청산 + 잠금 (challenge_order.on_challenge_status_changed).
- 최종 판정(자동·관리자 확인 공통) → 계좌 상태 PASSED/FAILED + 결과 메일 (challenge_evaluation.apply_result).
- Consistency 경고(WARN)는 조치 없음. 확정은 최종 판정에서.
"""

import logging
import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import String, and_, case, cast, func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import settings
from app.models import (
    AccountDailyStat,
    AccountRiskState,
    Challenge,
    ChallengeEvaluation,
    Product,
    Ruleset,
    RuleViolation,
    TradingAccount,
    TradingAccountEquitySnapshot,
    TradingAccountStatusHistory,
    TradingAccountTrade,
    User,
)
from app.services import challenge_order as orders
from app.services import jobs
from app.services.mt4_ingest import TRADE_ACTIONS

logger = logging.getLogger(__name__)

CHALLENGE, FUNDED = "CHALLENGE", "FUNDED"
MAX_DRAWDOWN, DAILY_LOSS, CONSISTENCY = "MAX_DRAWDOWN", "DAILY_LOSS", "CONSISTENCY"
HARD, WARN = "HARD", "WARN"
VIP_GRADES = ("VIP", "VVIP")
# 자동 최종 판정 대상: 이 기간 안에 끝난 대회만 (오래된 대회를 계속 다시 보지 않도록)
FINAL_LOOKBACK = timedelta(days=7)
CENT = Decimal("0.01")


# ── 거래일 ─────────────────────────────────────────────────────────────


def zone() -> ZoneInfo:
    try:
        return ZoneInfo(settings.risk_trading_timezone or "UTC")
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("UTC")


def trading_date(value: datetime) -> date:
    return value.astimezone(zone()).date()


def day_bounds(day: date) -> tuple[datetime, datetime]:
    """거래일의 시작·마감 시각 (UTC)."""
    start = datetime.combine(day, time(0, 0), tzinfo=zone())
    end = datetime.combine(day + timedelta(days=1), time(0, 0), tzinfo=zone())
    return start.astimezone(UTC), end.astimezone(UTC)


# ── 룰셋 금액 (_amt 우선, 없으면 % × 자본금) ─────────────────────────


def _amount(amt: Decimal | None, pct: Decimal | None, capital: Decimal) -> Decimal | None:
    if amt is not None and amt > 0:
        return Decimal(amt)
    if pct is not None and pct > 0:
        return (Decimal(capital) * Decimal(pct) / 100).quantize(CENT)
    return None


def dd_amount(ruleset: Ruleset | None, capital: Decimal, vip: bool) -> Decimal | None:
    if ruleset is None:
        return None
    if vip:
        return _amount(ruleset.max_dd_vip_amt, ruleset.max_dd_vip_pct, capital)
    return _amount(ruleset.max_dd_normal_amt, ruleset.max_dd_normal_pct, capital)


def daily_loss_amount(ruleset: Ruleset | None, capital: Decimal) -> Decimal | None:
    if ruleset is None:
        return None
    return _amount(ruleset.daily_loss_limit_amt, ruleset.daily_loss_limit_pct, capital)


def profit_target_amount(ruleset: Ruleset | None, capital: Decimal) -> Decimal | None:
    if ruleset is None:
        return None
    return _amount(ruleset.profit_target_amt, ruleset.profit_target_pct, capital)


def dd_method(ruleset: Ruleset | None) -> str:
    return (ruleset.dd_calc_method if ruleset else None) or "STATIC"


def ruleset_snapshot(ruleset: Ruleset | None) -> dict:
    if ruleset is None:
        return {}
    keys = (
        "id", "name", "dd_calc_method", "max_dd_normal_amt", "max_dd_normal_pct", "max_dd_vip_amt",
        "max_dd_vip_pct", "daily_loss_limit_amt", "daily_loss_limit_pct", "profit_target_amt",
        "profit_target_pct", "min_trading_days", "consistency_pct",
    )
    return {k: (str(v) if isinstance(v, Decimal) else v) for k in keys if (v := getattr(ruleset, k, None)) is not None}


# ── 계좌 묶음 ───────────────────────────────────────────────────────


@dataclass
class Target:
    account: TradingAccount
    product: Product
    ruleset: Ruleset | None
    user: User
    challenge: Challenge | None

    @property
    def capital(self) -> Decimal:
        return Decimal(self.account.capital or 0)

    @property
    def vip(self) -> bool:
        return self.user.grade in VIP_GRADES

    @property
    def period_start(self) -> datetime | None:
        if self.challenge is not None:
            return self.challenge.started_at or self.challenge.start_at
        return self.account.start_at or self.account.issued_at

    @property
    def period_end(self) -> datetime | None:
        """대회 종료 시각 (관리자 조기 종료면 그 시각). 펀디드는 없음."""
        c = self.challenge
        if c is None:
            return None
        if c.closed_at is not None and c.closed_at < c.end_at:
            return c.closed_at
        return c.end_at


def _target_query():
    a = TradingAccount
    return (
        select(a, Product, Ruleset, User, Challenge)
        .join(Product, Product.product_id == a.product_id)
        .outerjoin(Ruleset, Ruleset.id == Product.ruleset_id)
        .join(User, User.id == a.user_id)
        .outerjoin(Challenge, Challenge.challenge_id == a.challenge_id)
        .where(a.tier.in_((CHALLENGE, FUNDED)), a.provision_status == "DONE", a.mt4_login.is_not(None))
    )


async def _targets(session: AsyncSession, *conditions) -> list[Target]:
    rows = await session.execute(_target_query().where(*conditions).order_by(TradingAccount.id))
    return [Target(*row) for row in rows]


# ── 감시 상태 ───────────────────────────────────────────────────────


async def ensure_state(session: AsyncSession, t: Target, now: datetime) -> AccountRiskState:
    state = await session.get(AccountRiskState, t.account.id)
    if state is not None:
        return state
    capital = t.capital
    dd = dd_amount(t.ruleset, capital, t.vip)
    start = t.period_start or now
    # 챌린지는 자본금에서 시작. 펀디드는 감시를 시작할 때의 잔고에서 시작한다.
    base_balance = capital if t.account.tier == CHALLENGE else Decimal(t.account.balance or capital)
    base_equity = capital if t.account.tier == CHALLENGE else Decimal(t.account.equity or base_balance)
    state = AccountRiskState(
        account_id=t.account.id,
        ruleset_id=t.ruleset.id if t.ruleset else None,
        capital=capital,
        dd_amount=dd,
        dd_floor=(capital - dd) if dd is not None else None,
        peak_close_equity=None,
        current_trading_date=trading_date(min(start, now)),
        day_start_balance=base_balance,
        day_start_equity=base_equity,
    )
    session.add(state)
    await session.flush()
    return state


async def record_violation(
    session: AsyncSession,
    t: Target,
    rule_key: str,
    severity: str,
    day: date,
    observed: Decimal | None,
    limit: Decimal | None,
    detail: str,
    now: datetime,
    action: str | None = None,
) -> bool:
    """위반 한 줄 기록. 같은 계좌·룰·거래일이 이미 있으면 기록하지 않는다 (True = 새로 기록).

    action이 있으면 조치까지 하는 위반(mode ENFORCED, status ACTIONED). 없으면 기록만(SHADOW·OPEN).
    """
    stmt = (
        insert(RuleViolation)
        .values(
            account_id=t.account.id,
            challenge_id=t.account.challenge_id,
            rule_key=rule_key,
            severity=severity,
            trading_date=day,
            detected_at=now,
            observed_value=observed,
            limit_value=limit,
            detail=detail,
            ruleset_snapshot=ruleset_snapshot(t.ruleset),
            mode="ENFORCED" if action else "SHADOW",
            action=action or "NONE",
            status="ACTIONED" if action else "OPEN",
        )
        .on_conflict_do_nothing(index_elements=["account_id", "rule_key", "trading_date"])
        .returning(RuleViolation.id)
    )
    new_id = await session.scalar(stmt)
    if new_id is not None:
        logger.info(
            "룰 위반(%s) %s %s 계좌 %s (MT4 %s) %s", action or "기록만", severity, rule_key, t.account.id,
            t.account.mt4_login, detail,
        )
    return new_id is not None


async def change_status(
    session: AsyncSession, account: TradingAccount, to_status: str, action: str, reason: str,
    changed_by: uuid.UUID | None = None,
) -> None:
    """계좌 상태를 바꾸고 이력(core.trading_account_status_history)을 남긴다. 시스템 조치는 changed_by = null."""
    session.add(
        TradingAccountStatusHistory(
            account_id=account.id, action=action, from_status=account.status, to_status=to_status,
            reason=reason[:500], changed_by=changed_by,
        )
    )
    account.status = to_status


def _enforce() -> bool:
    return bool(settings.risk_enforce)


async def _fail_on_drawdown(session: AsyncSession, t: Target, equity: Decimal, floor: Decimal) -> None:
    """Max Drawdown 위반 조치: FAILED + 전량 청산·읽기 전용 + 안내 메일."""
    a = t.account
    await change_status(session, a, "FAILED", "RULE_VIOLATION", f"Max Drawdown 위반: 평가금액 ${equity:,.2f} ≤ 기준선 ${floor:,.2f}")
    await orders.enqueue_close_all(session, a, "max drawdown")
    await jobs.enqueue(
        session, orders.VIOLATION_MAIL_JOB,
        {
            "account_id": str(a.id), "rule_key": MAX_DRAWDOWN,
            "message_en": f"Max Drawdown breached: equity ${equity:,.2f} reached the limit ${floor:,.2f}",
            "message_ko": f"최대 손실 한도 위반: 평가금액 ${equity:,.2f}이 기준선 ${floor:,.2f}에 도달",
        },
        dedupe_key=f"mail:violated:{a.id}:{MAX_DRAWDOWN}", ref_type="trading_account", ref_id=str(a.id),
    )


async def _halt_for_day(session: AsyncSession, t: Target, day: date) -> None:
    """펀디드 Daily Loss 위반 조치: 다음 거래일 시작까지 정지 (전량 청산·읽기 전용, 상태 ACTIVE 유지)."""
    t.account.trading_halted_until = day_bounds(day)[1]
    await orders.enqueue_close_all(session, t.account, "daily loss")


async def release_halts(session: AsyncSession, now: datetime) -> int:
    """하루 정지가 끝난(다음 거래일이 된) 계좌의 읽기 전용을 푼다."""
    a = TradingAccount
    rows = list(
        await session.scalars(
            select(a).where(a.trading_halted_until.is_not(None), a.trading_halted_until <= now).with_for_update()
        )
    )
    for account in rows:
        account.trading_halted_until = None
        if account.status in orders.TRADABLE_STATUSES:
            await orders.enqueue_read_only(session, account, False)
    return len(rows)


async def _has_violation(session: AsyncSession, account_id: uuid.UUID, rule_key: str) -> bool:
    v = RuleViolation
    found = await session.scalar(
        select(v.id).where(v.account_id == account_id, v.rule_key == rule_key, v.status != "DISMISSED").limit(1)
    )
    return found is not None


# ── 일일 마감 결산 ───────────────────────────────────────────────────


async def _close_values(
    session: AsyncSession, t: Target, start: datetime, end: datetime
) -> tuple[Decimal | None, Decimal | None, Decimal | None, Decimal | None]:
    """(마감 잔고, 마감 평가금액, 구간 최저, 구간 최고). 마감 값 = end 이전 마지막 스냅샷과 계좌 최근 값 중 늦은 값."""
    snap = TradingAccountEquitySnapshot
    last = (
        await session.execute(
            select(snap.balance, snap.equity, snap.taken_at)
            .where(snap.account_id == t.account.id, snap.taken_at <= end)
            .order_by(snap.taken_at.desc())
            .limit(1)
        )
    ).first()
    balance = equity = taken = None
    if last is not None:
        balance, equity, taken = last
    a = t.account
    if (
        a.equity is not None
        and a.equity_updated_at is not None
        and a.equity_updated_at <= end
        and (taken is None or a.equity_updated_at > taken)
    ):
        balance, equity = a.balance, a.equity
    lo, hi = (
        await session.execute(
            select(func.min(snap.equity), func.max(snap.equity)).where(
                snap.account_id == t.account.id, snap.taken_at >= start, snap.taken_at <= end
            )
        )
    ).one()
    return balance, equity, lo, hi


async def _fills(session: AsyncSession, account_id: uuid.UUID, start: datetime, end: datetime) -> int:
    """구간 안의 체결 수 = 진입한 매수·매도 + 청산한 매수·매도."""
    t = TradingAccountTrade
    opened = case((and_(t.open_time >= start, t.open_time < end), 1), else_=0)
    closed = case((and_(t.is_open.is_(False), t.close_time >= start, t.close_time < end), 1), else_=0)
    total = await session.scalar(
        select(func.coalesce(func.sum(opened + closed), 0)).where(
            t.account_id == account_id,
            t.action.in_(TRADE_ACTIONS),
            or_(and_(t.open_time >= start, t.open_time < end), and_(t.close_time >= start, t.close_time < end)),
        )
    )
    return int(total or 0)


async def close_day(
    session: AsyncSession, t: Target, state: AccountRiskState, day: date, end_limit: datetime | None, now: datetime
) -> AccountDailyStat:
    day_start, day_end = day_bounds(day)
    start = max(day_start, t.period_start) if t.period_start else day_start
    end = min(day_end, end_limit) if end_limit else day_end
    end = max(end, start)
    balance, equity, lo, hi = await _close_values(session, t, start, end)
    close_balance = Decimal(balance) if balance is not None else Decimal(state.day_start_balance)
    close_equity = Decimal(equity) if equity is not None else Decimal(state.day_start_equity)
    lo = min(Decimal(lo), close_equity) if lo is not None else close_equity
    hi = max(Decimal(hi), close_equity) if hi is not None else close_equity
    fills = await _fills(session, t.account.id, start, end)

    floor_before = state.dd_floor
    if state.dd_amount is not None and dd_method(t.ruleset) in ("EOD", "INTRADAY"):
        candidate = close_equity - Decimal(state.dd_amount)
        state.dd_floor = max(Decimal(state.dd_floor), candidate) if state.dd_floor is not None else candidate
    state.peak_close_equity = (
        max(Decimal(state.peak_close_equity), close_equity) if state.peak_close_equity is not None else close_equity
    )
    values = {
        "period_start": start,
        "period_end": end,
        "start_balance": state.day_start_balance,
        "start_equity": state.day_start_equity,
        "close_balance": close_balance,
        "close_equity": close_equity,
        "day_pnl": close_equity - Decimal(state.day_start_equity),
        "low_equity": lo,
        "high_equity": hi,
        "fills_count": fills,
        "is_trading_day": fills > 0,
        "dd_floor_before": floor_before,
        "dd_floor_after": state.dd_floor,
        "closed_at": now,
    }
    stmt = insert(AccountDailyStat).values(account_id=t.account.id, trading_date=day, **values)
    await session.execute(stmt.on_conflict_do_update(index_elements=["account_id", "trading_date"], set_=values))
    state.day_start_balance = close_balance
    state.day_start_equity = close_equity
    state.current_trading_date = day + timedelta(days=1)
    await session.flush()

    if t.account.tier == CHALLENGE:
        await _consistency_warning(session, t, day, close_equity, now)
    return await session.get(AccountDailyStat, (t.account.id, day), populate_existing=True)


async def _consistency_warning(session: AsyncSession, t: Target, day: date, close_equity: Decimal, now: datetime) -> None:
    pct = t.ruleset.consistency_pct if t.ruleset else None
    if pct is None or pct <= 0:
        return
    total = close_equity - t.capital
    if total <= 0:
        return
    best = await session.scalar(select(func.max(AccountDailyStat.day_pnl)).where(AccountDailyStat.account_id == t.account.id))
    if best is None or best <= 0:
        return
    ratio = (Decimal(best) / total * 100).quantize(CENT)
    if ratio > Decimal(pct):
        await record_violation(
            session, t, CONSISTENCY, WARN, day, ratio, Decimal(pct),
            f"하루 최대 수익 ${Decimal(best):,.2f} / 전체 순수익 ${total:,.2f} = {ratio}% (기준 {pct}%, 종료 때 확정)",
            now,
        )


async def close_due_days(
    session: AsyncSession, t: Target, state: AccountRiskState, now: datetime, until: datetime | None = None
) -> int:
    """마감이 지난 거래일을 차례로 결산한다.

    until이 없으면(1분 감시) 마감 + 유예 시간이 지난 날까지. until이 있으면(최종 판정) 그 시각 전에 시작한
    날을 모두 결산하고 마지막 날은 until에서 자른다.
    """
    grace = timedelta(seconds=settings.risk_close_grace_seconds)
    closed = 0
    while True:
        day = state.current_trading_date
        day_start, day_end = day_bounds(day)
        if until is None:
            if day_end + grace > now:
                break
            await close_day(session, t, state, day, None, now)
        else:
            if day_start >= until:
                break
            await close_day(session, t, state, day, until, now)
        closed += 1
    return closed


# ── 1분 감시 ────────────────────────────────────────────────────────


async def check_account(session: AsyncSession, t: Target, now: datetime) -> dict[str, int]:
    counts = {"checked": 0, "violations": 0, "days_closed": 0}
    state = await ensure_state(session, t, now)
    counts["days_closed"] = await close_due_days(session, t, state, now)
    a = t.account
    max_age = timedelta(seconds=settings.risk_equity_max_age_seconds)
    if a.equity is None or a.equity_updated_at is None or a.equity_updated_at < now - max_age:
        return counts  # 수집이 늦은 계좌는 오래된 값으로 판정하지 않는다
    equity = Decimal(a.equity)
    state.last_equity = equity
    state.last_checked_at = now
    counts["checked"] = 1
    today = trading_date(now)

    if state.dd_amount is not None:
        if dd_method(t.ruleset) == "INTRADAY" and state.dd_floor is not None:
            state.dd_floor = max(Decimal(state.dd_floor), equity - Decimal(state.dd_amount))
        floor = state.dd_floor
        if (
            floor is not None
            and equity <= Decimal(floor)
            and not await _has_violation(session, a.id, MAX_DRAWDOWN)
            and await record_violation(
                session, t, MAX_DRAWDOWN, HARD, today, equity, Decimal(floor),
                f"평가금액 ${equity:,.2f} ≤ 기준선 ${Decimal(floor):,.2f} (DD ${Decimal(state.dd_amount):,.2f})", now,
                action="CLOSE_ALL+READ_ONLY+FAILED" if _enforce() else None,
            )
        ):
            counts["violations"] += 1
            if _enforce():
                await _fail_on_drawdown(session, t, equity, Decimal(floor))
                await session.flush()
                return counts

    halted = a.trading_halted_until is not None and a.trading_halted_until > now
    if a.tier == FUNDED and not halted:
        limit = daily_loss_amount(t.ruleset, t.capital)
        if limit is not None:
            loss = Decimal(state.day_start_balance) - equity
            if loss >= limit and await record_violation(
                session, t, DAILY_LOSS, HARD, today, loss, limit,
                f"오늘 손실 ${loss:,.2f} ≥ 한도 ${limit:,.2f} (시작 잔고 ${Decimal(state.day_start_balance):,.2f})", now,
                action="CLOSE_ALL+READ_ONLY_DAY" if _enforce() else None,
            ):
                counts["violations"] += 1
                if _enforce():
                    await _halt_for_day(session, t, today)
    await session.flush()
    return counts


async def monitor(session: AsyncSession, now: datetime) -> dict[str, int]:
    counts = {"checked": 0, "violations": 0, "days_closed": 0, "failed": 0, "released": 0}
    if _enforce():
        counts["released"] = await release_halts(session, now)
    for t in await _targets(session, TradingAccount.status == "ACTIVE"):
        try:
            async with session.begin_nested():
                result = await check_account(session, t, now)
            for k, v in result.items():
                counts[k] += v
        except Exception:
            logger.exception("룰 감시 실패: 계좌 %s", t.account.id)
            counts["failed"] += 1
    return counts


# ── 대회 종료 자동 최종 판정 ───────────────────────────────────────


async def finalize(session: AsyncSession, now: datetime) -> dict[str, int]:
    from app.services import challenge_evaluation

    counts = {"evaluated": 0, "failed": 0}
    delay = timedelta(seconds=settings.risk_final_delay_seconds)
    end = func.least(Challenge.end_at, func.coalesce(Challenge.closed_at, Challenge.end_at))
    has_auto = (
        select(ChallengeEvaluation.id)
        .where(ChallengeEvaluation.account_id == TradingAccount.id, ChallengeEvaluation.source == "AUTO")
        .exists()
    )
    targets = await _targets(
        session,
        TradingAccount.tier == CHALLENGE,
        Challenge.status == "CLOSED",
        end <= now - delay,
        end >= now - FINAL_LOOKBACK,
        ~has_auto,
    )
    for t in targets:
        try:
            async with session.begin_nested():
                state = await ensure_state(session, t, now)
                await close_due_days(session, t, state, now, until=t.period_end)
                await challenge_evaluation.evaluate(session, t.account.id, None, now, source="AUTO")
            counts["evaluated"] += 1
        except Exception:
            logger.exception("자동 최종 판정 실패: 계좌 %s — 다음 주기에 다시 시도", t.account.id)
            counts["failed"] += 1
    return counts


async def run(sessionmaker: async_sessionmaker[AsyncSession], now: datetime | None = None) -> dict[str, int]:
    """Worker 주기 작업 한 번: 1분 감시(+ 마감 결산) → 대회 종료 자동 판정."""
    now = now or datetime.now(UTC)
    async with sessionmaker() as session:
        counts = await monitor(session, now)
        await session.commit()
        final = await finalize(session, now)
        await session.commit()
    counts["evaluated"] = final["evaluated"]
    counts["failed"] += final["failed"]
    return counts


# ── 관리자 조회 ─────────────────────────────────────────────────────


async def daily_stats(session: AsyncSession, account_id: uuid.UUID) -> list[AccountDailyStat]:
    rows = await session.scalars(
        select(AccountDailyStat).where(AccountDailyStat.account_id == account_id).order_by(AccountDailyStat.trading_date)
    )
    return list(rows)


async def violations_of(session: AsyncSession, account_id: uuid.UUID) -> list[RuleViolation]:
    rows = await session.scalars(
        select(RuleViolation).where(RuleViolation.account_id == account_id).order_by(RuleViolation.detected_at)
    )
    return list(rows)


async def list_violations(
    session: AsyncSession,
    *,
    rule_key: str | None,
    severity: str | None,
    status: str | None,
    tier: str | None,
    keyword: str | None,
    page: int,
    size: int,
) -> tuple[list[dict], int]:
    v, a = RuleViolation, TradingAccount
    query = select(v, a.mt4_login, a.tier, User.email).join(a, a.id == v.account_id).join(User, User.id == a.user_id)
    if rule_key:
        query = query.where(v.rule_key == rule_key.upper())
    if severity:
        query = query.where(v.severity == severity.upper())
    if status:
        query = query.where(v.status == status.upper())
    if tier:
        query = query.where(a.tier == tier.upper())
    if keyword:
        like = f"%{keyword.strip()}%"
        query = query.where(or_(User.email.ilike(like), cast(a.mt4_login, String).ilike(like)))
    total = await session.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = await session.execute(query.order_by(v.detected_at.desc(), v.id.desc()).offset((page - 1) * size).limit(size))
    items = [
        {**violation_out(row[0]), "mt4_login": row.mt4_login, "tier": row.tier, "email": row.email}
        for row in rows
    ]
    return items, total


def violation_out(v: RuleViolation) -> dict:
    return {
        "id": v.id,
        "account_id": str(v.account_id),
        "challenge_id": v.challenge_id,
        "rule_key": v.rule_key,
        "severity": v.severity,
        "trading_date": v.trading_date,
        "detected_at": v.detected_at,
        "observed_value": float(v.observed_value) if v.observed_value is not None else None,
        "limit_value": float(v.limit_value) if v.limit_value is not None else None,
        "detail": v.detail,
        "mode": v.mode,
        "action": v.action,
        "status": v.status,
    }
