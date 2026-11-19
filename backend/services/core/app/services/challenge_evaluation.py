"""백오피스 Leaderboard '확인하기': 챌린지 계좌의 거래 내역이 룰셋에 맞는지 확인해 통과 여부를 정한다.

흐름
1. 계좌·대회·상품·룰셋·회원을 읽는다 (챌린지 계좌만, 발급 완료된 계좌만).
2. 판정 기간 = 대회 시작 ~ 종료 시각(관리자가 먼저 종료했으면 그 시각, 아직 진행 중이면 지금).
3. 그 기간의 거래(매수·매도)를 MT4 수집 데이터(core.trading_account_trades)에서 모은다.
   기간 안에 연 거래 + 기간 전에 열었지만 기간 안에 닫은 거래. 잔고 입출금(BALANCE)은 제외.
4. 평가금액은 Leaderboard 수익률과 같은 값(종료 시각 기준)을 쓴다.
5. RULE_CHECKS에 등록된 룰을 차례로 돌린다. 모두 통과하면 PASSED, 하나라도 실패하면 FAILED.
6. 결과를 core.challenge_evaluations에 한 줄 쌓는다 (계좌별 마지막 줄이 현재 판정).

룰셋 판정 로직은 운영자가 다시 설계한 뒤 RULE_CHECKS에 추가한다. 지금은 등록된 룰이 없어서
모든 계좌가 PASSED로 판정되고 rules_applied = 0으로 남는다 (화면에 '룰셋 판정 미적용'으로 표시).

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
    Challenge,
    ChallengeEvaluation,
    Product,
    Ruleset,
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

# 룰셋 판정 로직 (운영자 설계 후 추가). 예: RULE_CHECKS.append(check_max_drawdown)
RULE_CHECKS: list[RuleCheck] = []


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
    return EvaluationContext(
        account=account, challenge=challenge, product=product, ruleset=ruleset, user=user,
        period_start=start, period_end=end, capital=capital, equity=equity, profit=profit,
        profit_rate=rate, trades=await _trades(session, account.id, start, end),
    )


def run_rules(ctx: EvaluationContext, rules: list[RuleCheck] | None = None) -> list[RuleResult]:
    results = []
    for rule in RULE_CHECKS if rules is None else rules:
        result = rule(ctx)
        if result is not None:
            results.append(result)
    return results


async def evaluate(
    session: AsyncSession, account_id: uuid.UUID, admin_id: uuid.UUID | None, now: datetime
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
    )
    session.add(evaluation)
    await session.flush()
    return evaluation


async def latest(session: AsyncSession, account_id: uuid.UUID) -> ChallengeEvaluation | None:
    ev = ChallengeEvaluation
    return await session.scalar(
        select(ev).where(ev.account_id == account_id).order_by(ev.created_at.desc(), ev.id.desc()).limit(1)
    )
