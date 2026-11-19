"""백오피스 대회 > Leaderboard. 같은 날(한국 시간 종료일) 끝나는 대회 참가 계좌를 수익률 순으로 줄 세운다.

화면 왼쪽 위 날짜 = 대회 종료일 (한국 시간, 대회 목록 화면의 종료일 표시와 같은 기준).

수익률 = (평가금액 − 자본금) ÷ 자본금 × 100.
- 끝난 대회(종료 시각이 지남): 종료 시각 시점의 평가금액. 종료 시각 이전의 마지막 잔고 스냅샷과
  계좌의 최근 값(종료 시각 이전에 받은 것만) 중 더 늦은 값을 쓴다. 종료 후에 받은 값은 쓰지 않는다.
- 진행 중·시작 전 대회: 계좌의 최근 평가금액.
- 받은 값이 없으면 자본금(수익률 0)으로 둔다.

같은 수익률이면 수익금이 큰 순, 그다음 MT4 번호 순이다.

달성 여부(is_passed)는 룰셋의 통과 조건으로 계산한다. VIP·VVIP 회원은 VIP 조건을 쓴다.
- 상대평가(RELATIVE): 같은 날 같은 등급 그룹(일반 / VIP) 순위가 상위 N% 안 (인원 × N% 내림).
- 절대평가(ABSOLUTE): 수익금이 정한 금액 이상 (금액이 없으면 자본금 × N%).
기존 서버와 다른 점: 기존 서버는 RELATIVE를 "수익률 N% 이상"으로 계산했지만,
백오피스 룰셋 화면은 "상위 N%"로 입력받으므로 순위 기준으로 계산한다.
"""

import math
import uuid
from datetime import UTC, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Challenge, Product, Ruleset, TradingAccount, TradingAccountEquitySnapshot, User
from app.services.challenge import CANCELLED, KST, _parse_day

VIP_GRADES = ("VIP", "VVIP")
GRADES = ("NORMAL", *VIP_GRADES)


def cutoff(challenge: Challenge) -> datetime:
    """수익률 기준 시각: 대회 종료 시각 (관리자가 먼저 종료했으면 그 시각)."""
    if challenge.closed_at is not None and challenge.closed_at < challenge.end_at:
        return challenge.closed_at
    return challenge.end_at


def _cohort(grade: str | None) -> str:
    return "VIP" if grade in VIP_GRADES else "NORMAL"


def _kst_day_bounds(date: str) -> tuple[datetime, datetime]:
    start = datetime.combine(_parse_day(date), time(0, 0), tzinfo=KST)
    return start, start + timedelta(days=1)


async def challenges_on(session: AsyncSession, date: str, product_id: str | None = None) -> list[Challenge]:
    """종료일(한국 시간)이 date인 대회 (취소된 대회 제외)."""
    start, end = _kst_day_bounds(date)
    query = select(Challenge).where(
        Challenge.end_at >= start, Challenge.end_at < end, Challenge.status != CANCELLED
    )
    if product_id:
        query = query.where(Challenge.product_id == product_id)
    return list(await session.scalars(query.order_by(Challenge.start_at, Challenge.challenge_id)))


async def end_dates(session: AsyncSession) -> list[str]:
    """대회가 끝나는 날짜 목록 (한국 시간 YYYYMMDD, 최근 순, 취소 제외). Leaderboard 날짜 이동용."""
    day = func.to_char(func.timezone("Asia/Seoul", Challenge.end_at), "YYYYMMDD")
    rows = await session.scalars(
        select(day).where(Challenge.status != CANCELLED).group_by(day).order_by(day.desc())
    )
    return list(rows)


async def _snapshots_before_end(session: AsyncSession, account_ids: list[uuid.UUID]) -> dict:
    """계좌별로 대회 종료 시각(cutoff) 이전의 마지막 스냅샷."""
    if not account_ids:
        return {}
    snap = TradingAccountEquitySnapshot
    rows = await session.execute(
        select(snap.account_id, snap.equity, snap.balance, snap.taken_at)
        .join(TradingAccount, TradingAccount.id == snap.account_id)
        .join(Challenge, Challenge.challenge_id == TradingAccount.challenge_id)
        .where(
            snap.account_id.in_(account_ids),
            snap.taken_at <= func.least(Challenge.end_at, func.coalesce(Challenge.closed_at, Challenge.end_at)),
        )
        .distinct(snap.account_id)
        .order_by(snap.account_id, snap.taken_at.desc())
    )
    return {r.account_id: r for r in rows}


def _pass_condition(ruleset: Ruleset | None, grade: str | None) -> tuple[str | None, Decimal | None, Decimal | None]:
    if ruleset is None:
        return None, None, None
    if grade in VIP_GRADES:
        return ruleset.pass_condition_vip_type, ruleset.pass_condition_vip_pct, ruleset.pass_condition_vip_amt
    return ruleset.pass_condition_type, ruleset.pass_condition_pct, ruleset.pass_condition_amt


def _sort_key(entry: dict):
    return (-entry["profit_rate"], -entry["profit"], entry["mt4_login"] or 0)


async def build(
    session: AsyncSession,
    date: str,
    *,
    product_id: str | None = None,
    now: datetime | None = None,
) -> tuple[list[Challenge], list[dict]]:
    """대회 목록과 등급 구분 없는 전체 순위 (rank는 전체 기준, cohort_rank는 일반/VIP 그룹 기준)."""
    now = now or datetime.now(UTC)
    challenges = await challenges_on(session, date, product_id)
    if not challenges:
        return [], []
    by_id = {c.challenge_id: c for c in challenges}

    rows = (
        await session.execute(
            select(TradingAccount, User, Product, Ruleset)
            .join(User, User.id == TradingAccount.user_id)
            .join(Product, Product.product_id == TradingAccount.product_id)
            .outerjoin(Ruleset, Ruleset.id == Product.ruleset_id)
            .where(
                TradingAccount.challenge_id.in_(list(by_id)),
                TradingAccount.tier == "CHALLENGE",
                TradingAccount.provision_status == "DONE",
                TradingAccount.mt4_login.is_not(None),
            )
        )
    ).all()
    ended_ids = [a.id for a, *_ in rows if cutoff(by_id[a.challenge_id]) <= now]
    snapshots = await _snapshots_before_end(session, ended_ids)

    entries: list[dict] = []
    for account, user, product, ruleset in rows:
        challenge = by_id[account.challenge_id]
        capital = Decimal(account.capital or 0)
        end = cutoff(challenge)
        ended = end <= now
        equity = balance = taken_at = None
        if ended:
            snap = snapshots.get(account.id)
            if snap is not None:
                equity, balance, taken_at = snap.equity, snap.balance, snap.taken_at
            if (
                account.equity is not None
                and account.equity_updated_at is not None
                and account.equity_updated_at <= end
                and (taken_at is None or account.equity_updated_at > taken_at)
            ):
                equity, balance, taken_at = account.equity, account.balance, account.equity_updated_at
        elif account.equity is not None:
            equity, balance, taken_at = account.equity, account.balance, account.equity_updated_at
        equity = Decimal(equity) if equity is not None else capital
        profit = equity - capital
        rate = float(round(profit / capital * 100, 4)) if capital > 0 else 0.0
        name = " ".join(p for p in (user.first_name, user.last_name) if p)
        entries.append({
            "account_id": str(account.id),
            "mt4_login": account.mt4_login,
            "user_id": str(user.id),
            "email": user.email,
            "user_grade": user.grade or "NORMAL",
            "nickname": name,
            "challenge_id": challenge.challenge_id,
            "product_id": product.product_id,
            "product_name": product.name,
            "capital": float(capital),
            "equity": float(equity),
            "balance": float(balance) if balance is not None else float(capital),
            "profit": float(round(profit, 2)),
            "profit_rate": rate,
            "account_status": account.status,
            "participant_status": account.status,
            "snapshot_ts": taken_at,
            "basis": "END" if ended else "LATEST",
            "_rule": _pass_condition(ruleset, user.grade),
        })

    entries.sort(key=_sort_key)
    cohort_sizes: dict[str, int] = {}
    for entry in entries:
        cohort = _cohort(entry["user_grade"])
        cohort_sizes[cohort] = cohort_sizes.get(cohort, 0) + 1
        entry["cohort_rank"] = cohort_sizes[cohort]
    for i, entry in enumerate(entries, start=1):
        entry["rank"] = i
        kind, pct, amt = entry.pop("_rule")
        passed = False
        if kind == "RELATIVE" and pct is not None:
            limit = math.floor(cohort_sizes[_cohort(entry["user_grade"])] * float(pct) / 100)
            passed = entry["cohort_rank"] <= limit
        elif kind == "ABSOLUTE":
            target = float(amt) if amt is not None else (
                entry["capital"] * float(pct) / 100 if pct is not None else None
            )
            passed = target is not None and entry["profit"] >= target
        entry["is_passed"] = passed
    return challenges, entries


def filter_grade(entries: list[dict], grade: str | None) -> list[dict]:
    """등급 탭(NORMAL / VIP / VVIP)만 남기고 그 안에서 순위를 다시 매긴다."""
    if not grade:
        return entries
    picked = [dict(e) for e in entries if (e["user_grade"] or "NORMAL") == grade]
    for i, entry in enumerate(picked, start=1):
        entry["rank"] = i
    return picked


def summary_stats(entries: list[dict]) -> dict:
    """Leaderboard 상단 카드. 승격 대상·VIP 달성자는 달성 여부 기준."""
    return {
        "total_active_participants": len(entries),
        "passed_count": sum(1 for e in entries if e["is_passed"] and _cohort(e["user_grade"]) == "NORMAL"),
        "vip_count": sum(1 for e in entries if e["is_passed"] and _cohort(e["user_grade"]) == "VIP"),
        "failed_count": sum(1 for e in entries if e["account_status"] in ("FAILED", "BANNED")),
        "withdrawn_count": 0,
        "passed_accounts": sum(1 for e in entries if e["account_status"] == "PASSED"),
    }
