"""백오피스 Leaderboard '확인하기': 챌린지 계좌의 거래 내역이 룰셋에 맞는지 확인해 통과 여부를 정한다.

흐름
1. 계좌·대회·상품·룰셋·회원을 읽는다 (챌린지 계좌만, 발급 완료된 계좌만).
2. 판정 기간 = 대회 시작 ~ 종료 시각(관리자가 먼저 종료했으면 그 시각, 아직 진행 중이면 지금).
3. 그 기간의 거래(매수·매도)를 MT4 수집 데이터(core.trading_account_trades)에서 모은다.
   기간 안에 연 거래 + 기간 전에 열었지만 기간 안에 닫은 거래. 잔고 입출금(BALANCE)은 제외.
4. 평가금액은 Leaderboard 수익률과 같은 값(종료 시각 기준)을 쓴다.
5. RULE_CHECKS에 등록된 룰을 차례로 돌린다. 모두 통과하면 PASSED, 하나라도 실패하면 FAILED.
6. 결과를 core.challenge_evaluations에 한 줄 쌓는다 (계좌별 마지막 줄이 현재 판정).

룰 (2026-11-20 사용자 확정, 룰셋에 값이 없는 룰은 적용하지 않는다)
- 수익 목표: 종료 시각 평가금액 − 자본금 ≥ 목표 (profit_target_amt, 없으면 profit_target_pct × 자본금).
- 최소 거래일: 진입 또는 청산 체결이 1건이라도 있는 거래일(MT4 서버 날짜) 수 ≥ min_trading_days.
- Max Drawdown: 기간 중 Max Drawdown 위반 기록(core.rule_violations, 취소되지 않은 것)이 없어야 한다.
  위반 감시는 Worker의 trading_rules가 1분마다 한다.
- Consistency: 하루 최대 수익 ÷ 전체 순수익 ≤ consistency_pct. 하루 수익은 일일 결산(core.account_daily_stats)의
  하루 손익(미실현 포함). 결산이 없으면 청산 거래의 실현 손익을 청산일별로 합친 값. 전체 순수익이 0 이하이면
  비율을 따지지 않는다 (수익 목표에서 이미 불합격).

관리자 '확인하기'(source=MANUAL)와 대회 종료 후 Worker 자동 판정(source=AUTO)이 같은 룰을 쓴다.
판정은 결과 기록만 한다. 계좌 상태(PASSED/FAILED)·MT4 읽기 전용·펀디드 발급은 바꾸지 않는다.
"""

import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import AppError
from app.models import (
    AccountDailyStat,
    Challenge,
    ChallengeEvaluation,
    Product,
    Ruleset,
    RuleViolation,
    TradingAccount,
    TradingAccountTrade,
    User,
)
from app.services import leaderboard
from app.services.mt4_ingest import TRADE_ACTIONS


@dataclass
class EvaluationContext:
    """룰 함수가 받는 판정 재료."""

    account: TradingAccount
    challenge: Challenge
    product: Product
    ruleset: Ruleset | None
    user: User
    period_start: datetime
    period_end: datetime
    capital: Decimal
    equity: Decimal
    profit: Decimal
    profit_rate: Decimal
    # 기간 안의 매수·매도 거래 (미결 포함), 연 시각 순
    trades: list[TradingAccountTrade] = field(default_factory=list)
    # 기간 안의 일일 결산과 룰 위반 기록 (Worker trading_rules)
    daily_stats: list[AccountDailyStat] = field(default_factory=list)
    violations: list[RuleViolation] = field(default_factory=list)

    @property
    def closed_trades(self) -> list[TradingAccountTrade]:
        return [t for t in self.trades if not t.is_open]

    @property
    def open_positions(self) -> list[TradingAccountTrade]:
        return [t for t in self.trades if t.is_open]

    @property
    def is_vip(self) -> bool:
        return self.user.grade in leaderboard.VIP_GRADES


@dataclass
class RuleResult:
    key: str  # 예: "max_drawdown"
    label: str  # 화면 표시 이름, 예: "최대 손실 한도"
    passed: bool
    detail: str | None = None  # 예: "최대 손실 -8.2% (한도 -10%)"

    def as_dict(self) -> dict:
        return {"key": self.key, "label": self.label, "passed": self.passed, "detail": self.detail}


# 룰 함수: 판정 재료를 받아 결과를 돌려준다. 룰셋에 해당 조건이 없으면 None(적용 안 함).
RuleCheck = Callable[[EvaluationContext], RuleResult | None]

def _money(value: Decimal) -> str:
    return f"${Decimal(value):,.2f}"


def check_profit_target(ctx: EvaluationContext) -> RuleResult | None:
    from app.services import trading_rules as tr

    target = tr.profit_target_amount(ctx.ruleset, ctx.capital)
    if target is None:
        return None
    return RuleResult(
        "profit_target", "수익 목표", ctx.profit >= target, f"수익 {_money(ctx.profit)} / 목표 {_money(target)}"
    )


def trading_days(ctx: EvaluationContext) -> set:
    """진입 또는 청산 체결이 기간 안에 1건이라도 있는 거래일(MT4 서버 날짜)."""
    from app.services import trading_rules as tr

    days = set()
    for t in ctx.trades:
        for at in (t.open_time, None if t.is_open else t.close_time):
            if at is not None and ctx.period_start <= at <= ctx.period_end:
                days.add(tr.trading_date(at))
    return days


def check_min_trading_days(ctx: EvaluationContext) -> RuleResult | None:
    need = ctx.ruleset.min_trading_days if ctx.ruleset else None
    if not need:
        return None
    days = len(trading_days(ctx))
    return RuleResult("min_trading_days", "최소 거래일", days >= need, f"거래일 {days}일 / 최소 {need}일")


def check_max_drawdown(ctx: EvaluationContext) -> RuleResult | None:
    from app.services import trading_rules as tr

    dd = tr.dd_amount(ctx.ruleset, ctx.capital, ctx.is_vip)
    if dd is None:
        return None
    hits = [v for v in ctx.violations if v.rule_key == tr.MAX_DRAWDOWN and v.status != "DISMISSED"]
    if hits:
        first = hits[0]
        detail = f"{first.detected_at:%Y-%m-%d %H:%M} UTC 위반: {first.detail}"
    else:
        floors = [s.dd_floor_after for s in ctx.daily_stats if s.dd_floor_after is not None]
        detail = f"위반 없음 (DD {_money(dd)}" + (f", 마지막 기준선 {_money(floors[-1])})" if floors else ")")
    return RuleResult("max_drawdown", "최대 손실 한도 (Max Drawdown)", not hits, detail)


def daily_profits(ctx: EvaluationContext) -> dict:
    """거래일별 하루 손익. 일일 결산이 있으면 그 값(미실현 포함), 없으면 청산 거래의 실현 손익을 청산일별로 합친다."""
    from app.services import trading_rules as tr

    if ctx.daily_stats:
        return {s.trading_date: Decimal(s.day_pnl) for s in ctx.daily_stats}
    out: dict = {}
    for t in ctx.closed_trades:
        if t.close_time is None or not (ctx.period_start <= t.close_time <= ctx.period_end):
            continue
        day = tr.trading_date(t.close_time)
        out[day] = out.get(day, Decimal(0)) + Decimal(t.profit) + Decimal(t.commission) + Decimal(t.swap) + Decimal(t.taxes)
    return out


def check_consistency(ctx: EvaluationContext) -> RuleResult | None:
    pct = ctx.ruleset.consistency_pct if ctx.ruleset else None
    if pct is None or pct <= 0:
        return None
    total = ctx.profit
    if total <= 0:
        return RuleResult("consistency", "일관성 (Consistency)", True, f"전체 순수익 {_money(total)} — 비율 계산 안 함")
    profits = daily_profits(ctx)
    best_day, best = max(profits.items(), key=lambda kv: kv[1]) if profits else (None, Decimal(0))
    ratio = (best / total * 100).quantize(Decimal("0.01")) if best > 0 else Decimal(0)
    detail = f"하루 최대 수익 {_money(best)}" + (f" ({best_day})" if best_day else "") + (
        f" / 전체 순수익 {_money(total)} = {ratio}% (기준 {pct}%)"
    )
    return RuleResult("consistency", "일관성 (Consistency)", ratio <= Decimal(pct), detail)


# 판정 순서대로. 룰 함수가 None을 돌려주면(룰셋에 값 없음) 적용하지 않는다.
RULE_CHECKS: list[RuleCheck] = [
    check_profit_target,
    check_min_trading_days,
    check_max_drawdown,
    check_consistency,
]


async def _load(session: AsyncSession, account_id: uuid.UUID):
    row = (
        await session.execute(
            select(TradingAccount, Challenge, Product, Ruleset, User)
            .join(Challenge, Challenge.challenge_id == TradingAccount.challenge_id)
            .join(Product, Product.product_id == TradingAccount.product_id)
            .outerjoin(Ruleset, Ruleset.id == Product.ruleset_id)
            .join(User, User.id == TradingAccount.user_id)
            .where(TradingAccount.id == account_id)
        )
    ).first()
    if row is None:
        raise AppError(404, "account_not_found", "챌린지 계좌를 찾을 수 없습니다.")
    account = row[0]
    if account.tier != "CHALLENGE" or account.provision_status != "DONE" or account.mt4_login is None:
        raise AppError(400, "account_not_evaluable", "발급 완료된 챌린지 계좌만 확인할 수 있습니다.")
    return row


async def _trades(
    session: AsyncSession, account_id: uuid.UUID, start: datetime, end: datetime
) -> list[TradingAccountTrade]:
    t = TradingAccountTrade
    rows = await session.scalars(
        select(t)
        .where(
            t.account_id == account_id,
            t.action.in_(TRADE_ACTIONS),
            or_(
                and_(t.open_time >= start, t.open_time <= end),
                and_(t.close_time >= start, t.close_time <= end),
            ),
        )
        .order_by(t.open_time, t.mt4_order)
    )
    return list(rows)


async def build_context(session: AsyncSession, account_id: uuid.UUID, now: datetime) -> EvaluationContext:
    account, challenge, product, ruleset, user = await _load(session, account_id)
    start = challenge.started_at or challenge.start_at
    end = min(leaderboard.cutoff(challenge), now)
    if end < start:
        raise AppError(400, "challenge_not_started", "대회가 시작된 뒤에 확인할 수 있습니다.")
    snap = await leaderboard.snapshot_before_end(session, account.id)
    equity, _, _, _ = leaderboard.account_value(account, challenge, snap, now)
    capital = Decimal(account.capital or 0)
    profit = equity - capital
    rate = (profit / capital * 100).quantize(Decimal("0.0001")) if capital > 0 else Decimal(0)
    stats = await session.scalars(
        select(AccountDailyStat)
        .where(AccountDailyStat.account_id == account.id, AccountDailyStat.period_start < end)
        .order_by(AccountDailyStat.trading_date)
    )
    violations = await session.scalars(
        select(RuleViolation)
        .where(RuleViolation.account_id == account.id, RuleViolation.detected_at <= end)
        .order_by(RuleViolation.detected_at, RuleViolation.id)
    )
    return EvaluationContext(
        account=account, challenge=challenge, product=product, ruleset=ruleset, user=user,
        period_start=start, period_end=end, capital=capital, equity=equity, profit=profit,
        profit_rate=rate, trades=await _trades(session, account.id, start, end),
        daily_stats=list(stats), violations=list(violations),
    )


def run_rules(ctx: EvaluationContext, rules: list[RuleCheck] | None = None) -> list[RuleResult]:
    results = []
    for rule in RULE_CHECKS if rules is None else rules:
        result = rule(ctx)
        if result is not None:
            results.append(result)
    return results


async def evaluate(
    session: AsyncSession, account_id: uuid.UUID, admin_id: uuid.UUID | None, now: datetime, source: str = "MANUAL"
) -> ChallengeEvaluation:
    ctx = await build_context(session, account_id, now)
    results = run_rules(ctx)
    evaluation = ChallengeEvaluation(
        account_id=ctx.account.id,
        challenge_id=ctx.challenge.challenge_id,
        ruleset_id=ctx.ruleset.id if ctx.ruleset else None,
        result="PASSED" if all(r.passed for r in results) else "FAILED",
        period_start=ctx.period_start,
        period_end=ctx.period_end,
        capital=ctx.capital,
        equity=ctx.equity,
        profit=ctx.profit,
        profit_rate=ctx.profit_rate,
        trades_count=len(ctx.closed_trades),
        open_positions=len(ctx.open_positions),
        checks=[r.as_dict() for r in results],
        rules_applied=len(results),
        evaluated_by=admin_id,
        source=source,
    )
    session.add(evaluation)
    await session.flush()
    return evaluation


async def latest(session: AsyncSession, account_id: uuid.UUID) -> ChallengeEvaluation | None:
    ev = ChallengeEvaluation
    return await session.scalar(
        select(ev).where(ev.account_id == account_id).order_by(ev.created_at.desc(), ev.id.desc()).limit(1)
    )
