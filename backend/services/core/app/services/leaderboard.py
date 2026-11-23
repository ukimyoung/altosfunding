"""백오피스 대회 > Leaderboard. 같은 날(한국 시간 종료일) 끝나는 대회 참가 계좌를 수익률 순으로 줄 세운다.

화면 왼쪽 위 날짜 = 대회 종료일 (한국 시간, 대회 목록 화면의 종료일 표시와 같은 기준).

수익률 = (평가금액 − 자본금) ÷ 자본금 × 100.
- 끝난 대회(종료 시각이 지남): 종료 시각 시점의 평가금액. 종료 시각 이전의 마지막 잔고 스냅샷과
  계좌의 최근 값(종료 시각 이전에 받은 것만) 중 더 늦은 값을 쓴다. 종료 후에 받은 값은 쓰지 않는다.
- 진행 중·시작 전 대회: 계좌의 최근 평가금액.
- 받은 값이 없으면 자본금(수익률 0)으로 둔다.

같은 수익률이면 수익금이 큰 순, 그다음 MT4 번호 순이다.

통과 여부는 관리자가 '확인하기'로 판정한 마지막 결과다 (challenge_evaluation 서비스).
판정하지 않은 계좌는 evaluation_result = null, is_passed = false.
"""

import uuid
from datetime import UTC, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Challenge,
    ChallengeEvaluation,
    Product,
    TradingAccount,
    TradingAccountEquitySnapshot,
    User,
)
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


def account_value(
    account: TradingAccount, challenge: Challenge, snap, now: datetime
) -> tuple[Decimal, Decimal | None, datetime | None, bool]:
    """수익률 계산에 쓸 (평가금액, 잔고, 받은 시각, 대회 종료 여부). snap은 종료 시각 이전 마지막 스냅샷."""
    capital = Decimal(account.capital or 0)
    end = cutoff(challenge)
    ended = end <= now
    equity = balance = taken_at = None
    if ended:
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
    return (Decimal(equity) if equity is not None else capital), balance, taken_at, ended


async def snapshot_before_end(session: AsyncSession, account_id: uuid.UUID):
    return (await _snapshots_before_end(session, [account_id])).get(account_id)


async def _latest_evaluations(session: AsyncSession, account_ids: list[uuid.UUID]) -> dict:
    if not account_ids:
        return {}
    ev = ChallengeEvaluation
    rows = await session.scalars(
        select(ev).where(ev.account_id.in_(account_ids))
        .distinct(ev.account_id).order_by(ev.account_id, ev.created_at.desc(), ev.id.desc())
    )
    return {r.account_id: r for r in rows}


async def _funded_accounts(session: AsyncSession, account_ids: list[uuid.UUID]) -> dict:
    """챌린지 계좌 id → 그 계좌로 만든 펀디드 계좌 (발급 실패 제외)."""
    if not account_ids:
        return {}
    rows = await session.scalars(
        select(TradingAccount).where(
            TradingAccount.source_account_id.in_(account_ids), TradingAccount.provision_status != "FAILED"
        )
    )
    return {r.source_account_id: r for r in rows}


def _sort_key(entry: dict):
    return (-entry["profit_rate"], -entry["profit"], entry["mt4_login"] or 0)


async def build(
    session: AsyncSession,
    date: str,
    *,
    product_id: str | None = None,
    now: datetime | None = None,
) -> tuple[list[Challenge], list[dict]]:
    """대회 목록과 등급 구분 없는 전체 순위."""
    now = now or datetime.now(UTC)
    challenges = await challenges_on(session, date, product_id)
    if not challenges:
        return [], []
    by_id = {c.challenge_id: c for c in challenges}

    rows = (
        await session.execute(
            select(TradingAccount, User, Product)
            .join(User, User.id == TradingAccount.user_id)
            .join(Product, Product.product_id == TradingAccount.product_id)
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

    evaluations = await _latest_evaluations(session, [a.id for a, *_ in rows])
    funded = await _funded_accounts(session, [a.id for a, *_ in rows])

    entries: list[dict] = []
    for account, user, product in rows:
        challenge = by_id[account.challenge_id]
        capital = Decimal(account.capital or 0)
        equity, balance, taken_at, ended = account_value(account, challenge, snapshots.get(account.id), now)
        profit = equity - capital
        rate = float(round(profit / capital * 100, 4)) if capital > 0 else 0.0
        evaluation = evaluations.get(account.id)
        f = funded.get(account.id)
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
            "evaluation_id": evaluation.id if evaluation else None,
            "evaluation_result": evaluation.result if evaluation else None,
            "evaluated_at": evaluation.created_at if evaluation else None,
            "is_passed": bool(evaluation and evaluation.result == "PASSED"),
            # 펀디드 계좌 (Leaderboard '펀디드계좌' 열: 발급된 계좌 또는 '펀디드 계좌 발급' 버튼)
            "funded_issue_method": product.funded_issue_method,
            "funded_account_id": str(f.id) if f else None,
            "funded_mt4_login": f.mt4_login if f else None,
            "funded_provision_status": f.provision_status if f else None,
            "funded_start_at": f.start_at if f else None,
        })

    entries.sort(key=_sort_key)
    for i, entry in enumerate(entries, start=1):
        entry["rank"] = i
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
    """Leaderboard 상단 카드. 승격 대상·VIP 달성자는 '확인하기'로 통과 판정된 계좌 수."""
    return {
        "total_active_participants": len(entries),
        "passed_count": sum(1 for e in entries if e["is_passed"] and _cohort(e["user_grade"]) == "NORMAL"),
        "vip_count": sum(1 for e in entries if e["is_passed"] and _cohort(e["user_grade"]) == "VIP"),
        "failed_count": sum(1 for e in entries if e["account_status"] in ("FAILED", "BANNED")),
        "withdrawn_count": 0,
        "passed_accounts": sum(1 for e in entries if e["account_status"] == "PASSED"),
    }
