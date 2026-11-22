"""백오피스 대시보드 집계.

화면 한 장이 여러 관리 API를 따로 부르면 DB 연결(프로세스당 5개)을 한 화면이 다 쓰게 되므로,
대시보드에 필요한 숫자를 한 요청 안에서 한 세션으로 모아 돌려준다.

- summary: 시스템 상태 · 오늘 처리할 액션 · 기간 매출(전 기간 대비) · 대회 현황
- trends:  매출 추이(합계·상품별), 챌린지·펀디드 계좌 생성 수 추이

날짜 경계는 매출 현황과 같은 한국 시간(Asia/Seoul)이다.
"""

from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.errors import AppError
from app.models import Challenge, ChallengeOrder, Product, TradingAccount, User
from app.models.contact import ContactMessage
from app.models.job import Job, WorkerHeartbeat
from app.models.reward import RewardRecord, TradingBonusRecord
from app.models.trading import RuleViolation
from app.models.wallet import DepositRequest, WithdrawalRequest
from app.services import trading_query as q
from app.services.wallet import as_float

TZ = q.zone(None)

RANGES = ("today", "yesterday", "this_week", "this_month")
PASS_RATE_DAYS = 30
# 날짜를 고르지 않았을 때 보여줄 기본 구간 (주기별 칸 수)
DEFAULT_BUCKETS = {"daily": 7, "weekly": 8, "monthly": 6}
MAX_BUCKETS = 400


# ── 기간 ────────────────────────────────────────────────────


def _today(now: datetime) -> date:
    return now.astimezone(TZ).date()


def _month_start(d: date) -> date:
    return d.replace(day=1)


def _add_months(d: date, months: int) -> date:
    y, m = divmod(d.month - 1 + months, 12)
    year, month = d.year + y, m + 1
    # 말일 넘침 방지 (예: 3월 31일 - 1개월 → 2월 말일)
    for day in (d.day, 30, 29, 28):
        try:
            return date(year, month, day)
        except ValueError:
            continue
    raise ValueError(d)


def range_bounds(range_: str, now: datetime) -> tuple[date, date, date, date]:
    """선택 기간 [start, end]와 비교할 직전 기간 [prev_start, prev_end] (모두 KST 날짜, 끝 포함).

    이번 주·이번 달은 오늘까지만 센다. 비교 기간도 같은 길이(지난주 같은 요일까지, 지난달 같은 날까지)로 맞춘다.
    """
    today = _today(now)
    if range_ == "today":
        return today, today, today - timedelta(days=1), today - timedelta(days=1)
    if range_ == "yesterday":
        y = today - timedelta(days=1)
        return y, y, y - timedelta(days=1), y - timedelta(days=1)
    if range_ == "this_week":
        start = today - timedelta(days=today.weekday())
        return start, today, start - timedelta(days=7), today - timedelta(days=7)
    if range_ == "this_month":
        start = _month_start(today)
        prev_start = _add_months(start, -1)
        prev_end = min(_add_months(today, -1), start - timedelta(days=1))
        return start, today, prev_start, prev_end
    raise AppError(400, "invalid_range", "range는 today, yesterday, this_week, this_month 중 하나여야 합니다.")


def _utc_bounds(start: date, end: date) -> tuple[datetime, datetime]:
    """KST 날짜 [start, end] → UTC [시작 0시, 끝 다음날 0시)."""
    s = datetime(start.year, start.month, start.day, tzinfo=TZ)
    e = datetime(end.year, end.month, end.day, tzinfo=TZ) + timedelta(days=1)
    return s.astimezone(UTC), e.astimezone(UTC)


# ── summary ────────────────────────────────────────────────


async def _system(session: AsyncSession, now: datetime) -> dict:
    limit = timedelta(seconds=max(settings.worker_tick_seconds * 3, 90))
    workers = list(await session.scalars(select(WorkerHeartbeat).order_by(WorkerHeartbeat.last_seen_at.desc())))
    alive = [w for w in workers if now - w.last_seen_at <= limit]
    latest = (alive or workers or [None])[0]

    mt4: dict[str, str] = {}
    mt4_checked_at = None
    if latest is not None:
        last = (latest.last_tick or {}).get("mt4")
        if last:
            mt4_checked_at = last.get("at")
            if last.get("ok"):
                mt4 = {k: str(v) for k, v in (last.get("result") or {}).items()}
            else:
                mt4 = {"DEMO": "확인 실패", "LIVE": "확인 실패"}

    job_counts = dict(
        (await session.execute(select(Job.status, func.count()).group_by(Job.status))).tuples().all()
    )
    provisioning = await session.scalar(
        select(func.count()).select_from(TradingAccount).where(
            TradingAccount.provision_status.notin_(("DONE", "FAILED"))
        )
    )
    return {
        "worker_alive": bool(alive),
        "worker_last_seen_at": latest.last_seen_at.isoformat() if latest else None,
        "mt4": mt4,  # {"DEMO": "OK" | "실패 ..." | "미설정", "LIVE": ...}, 아직 점검 전이면 {}
        "mt4_checked_at": mt4_checked_at,
        "failed_jobs": job_counts.get("FAILED", 0),
        "pending_jobs": job_counts.get("PENDING", 0) + job_counts.get("RUNNING", 0),
        "provisioning_accounts": provisioning or 0,
    }


async def _actions(session: AsyncSession) -> dict:
    """기간과 상관없이 지금 처리해야 할 건수."""
    withdraw_count, withdraw_amount = (
        await session.execute(
            select(func.count(), func.coalesce(func.sum(WithdrawalRequest.amount), 0)).where(
                WithdrawalRequest.status == "REQUESTED"
            )
        )
    ).one()
    deposit_count = await session.scalar(
        select(func.count()).select_from(DepositRequest).where(DepositRequest.status == "PENDING")
    )
    contacts = await session.scalar(
        select(func.count()).select_from(ContactMessage).where(ContactMessage.status.in_(("RECEIVED", "PROCESSING")))
    )
    rewards = await session.scalar(
        select(func.count()).select_from(RewardRecord).where(RewardRecord.status == "PENDING")
    )
    bonuses = await session.scalar(
        select(func.count()).select_from(TradingBonusRecord).where(TradingBonusRecord.status == "PENDING")
    )
    kyc = await session.scalar(
        select(func.count()).select_from(User).where(
            User.kyc_status == "PENDING", User.role == "USER", User.status != "WITHDRAWN"
        )
    )
    violations = await session.scalar(
        select(func.count()).select_from(RuleViolation).where(RuleViolation.status == "OPEN")
    )
    return {
        "withdraw_pending_count": withdraw_count or 0,
        "withdraw_pending_amount": as_float(withdraw_amount) or 0.0,
        "deposit_pending_count": deposit_count or 0,
        "contacts_unanswered": contacts or 0,
        "rewards_pending_count": (rewards or 0) + (bonuses or 0),
        "kyc_pending": kyc or 0,
        "rule_violations_open": violations or 0,
    }


async def _challenge_revenue(session: AsyncSession, start: date, end: date) -> float:
    """매출 현황과 같은 기준: COMPLETED 주문, 주문 시각, 결제 − 환불."""
    s, e = _utc_bounds(start, end)
    value = await session.scalar(
        select(func.coalesce(func.sum(ChallengeOrder.total_price - ChallengeOrder.refunded_amount), 0)).where(
            ChallengeOrder.status == "COMPLETED", ChallengeOrder.created_at >= s, ChallengeOrder.created_at < e
        )
    )
    return round(as_float(value) or 0.0, 2)


def _change(cur: float, prev: float) -> float | None:
    """전 기간 대비 증감률(%). 전 기간이 0이면 계산하지 않는다."""
    if not prev:
        return None
    return round((cur - prev) / prev * 100, 1)


async def _revenue(session: AsyncSession, start: date, end: date, prev_start: date, prev_end: date) -> dict:
    cur = await _challenge_revenue(session, start, end)
    prev = await _challenge_revenue(session, prev_start, prev_end)
    return {
        "challenge": {"amount": cur, "prev_amount": prev, "change_pct": _change(cur, prev)},
        # 펀디드 정산(회사 몫)은 수익 출금·분배 기능을 옮긴 뒤 채운다. 화면은 '준비 중'으로 표시.
        "funded": {"ready": False, "amount": None, "prev_amount": None, "change_pct": None},
        "total": {"amount": cur, "prev_amount": prev, "change_pct": _change(cur, prev)},
    }


def _challenge_row(c: Challenge, product_name: str) -> dict:
    return {
        "challenge_id": c.challenge_id,
        "name": c.name,
        "product_id": c.product_id,
        "product_name": product_name,
        "participants": c.current_participants,
        "group_size": c.group_size,
        "start_at": c.start_at.isoformat(),
        "end_at": c.end_at.isoformat(),
    }


async def _account_results(session: AsyncSession, challenge_filter) -> dict:
    row = (
        await session.execute(
            select(
                func.count(),
                func.count().filter(TradingAccount.status == "PASSED"),
                func.count().filter(TradingAccount.status == "FAILED"),
            )
            .select_from(TradingAccount)
            .join(Challenge, Challenge.challenge_id == TradingAccount.challenge_id)
            .where(TradingAccount.tier == "CHALLENGE", TradingAccount.provision_status != "FAILED", *challenge_filter)
        )
    ).one()
    return {"participants": row[0] or 0, "passed": row[1] or 0, "failed": row[2] or 0}


async def _competitions(session: AsyncSession, start: date, end: date, now: datetime) -> dict:
    rows = (
        await session.execute(
            select(Challenge, Product.name)
            .join(Product, Product.product_id == Challenge.product_id)
            .where(Challenge.status.in_(("PENDING", "ACTIVE")))
            .order_by(Challenge.start_at, Product.price_usdt)
        )
    ).all()
    recruiting = [_challenge_row(c, name) for c, name in rows if c.status == "PENDING"]
    active = sorted(
        (_challenge_row(c, name) for c, name in rows if c.status == "ACTIVE"), key=lambda r: r["end_at"]
    )

    # 선택 기간에 끝난 대회 (Leaderboard와 같이 '종료일' 기준, 관리자 조기 종료면 closed_at)
    s, e = _utc_bounds(start, end)
    ended_at = func.coalesce(Challenge.closed_at, Challenge.end_at)
    ended_filter = (Challenge.status == "CLOSED", ended_at >= s, ended_at < e)
    ended_count = await session.scalar(select(func.count()).select_from(Challenge).where(*ended_filter))
    ended = {"competitions": ended_count or 0, **await _account_results(session, ended_filter)}

    # 합격률: 최근 30일 안에 끝난 대회 계좌의 PASSED ÷ (PASSED + FAILED)
    since = now - timedelta(days=PASS_RATE_DAYS)
    rate = await _account_results(session, (Challenge.status == "CLOSED", ended_at >= since, ended_at < now))
    judged = rate["passed"] + rate["failed"]
    return {
        "recruiting": recruiting,
        "active": active,
        "recruiting_participants": sum(r["participants"] for r in recruiting),
        "active_participants": sum(r["participants"] for r in active),
        "ended": ended,
        "pass_rate": {
            "days": PASS_RATE_DAYS,
            "passed": rate["passed"],
            "failed": rate["failed"],
            "rate": round(rate["passed"] / judged * 100, 1) if judged else None,
        },
    }


async def summary(session: AsyncSession, range_: str | None, now: datetime | None = None) -> dict:
    now = now or datetime.now(UTC)
    range_ = range_ or "today"
    start, end, prev_start, prev_end = range_bounds(range_, now)
    return {
        "range": range_,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "prev_start_date": prev_start.isoformat(),
        "prev_end_date": prev_end.isoformat(),
        "generated_at": now.isoformat(),
        "system": await _system(session, now),
        "actions": await _actions(session),
        "revenue": await _revenue(session, start, end, prev_start, prev_end),
        "competitions": await _competitions(session, start, end, now),
    }


# ── trends ─────────────────────────────────────────────────


def _bucket_start(d: date, period: str) -> date:
    if period == "weekly":
        return d - timedelta(days=d.weekday())
    if period == "monthly":
        return d.replace(day=1)
    return d


def _next_bucket(d: date, period: str) -> date:
    if period == "weekly":
        return d + timedelta(days=7)
    if period == "monthly":
        return _add_months(d, 1)
    return d + timedelta(days=1)


def _label(d: date, period: str) -> str:
    return d.strftime("%Y-%m") if period == "monthly" else d.isoformat()


def trend_window(period: str, start_date: str | None, end_date: str | None, now: datetime) -> tuple[date, date]:
    """조회 구간. 날짜를 안 주면 오늘까지 주기별 기본 칸 수(일 7 · 주 8 · 월 6)."""
    start = q._local_day_bounds(start_date, TZ)
    end = q._local_day_bounds(end_date, TZ)
    if (start_date and not start) or (end_date and not end):
        raise AppError(400, "invalid_date", "날짜는 YYYY-MM-DD 형식이어야 합니다.")
    end_d = end.date() if end else _today(now)
    if start:
        start_d = start.date()
    else:
        first = _bucket_start(end_d, period)
        for _ in range(DEFAULT_BUCKETS[period] - 1):
            first = _bucket_start(first - timedelta(days=1), period)
        start_d = first
    if start_d > end_d:
        raise AppError(400, "invalid_date_range", "시작일이 종료일보다 늦습니다.")
    return start_d, end_d


def _buckets(start: date, end: date, period: str) -> list[date]:
    out, cur = [], _bucket_start(start, period)
    while cur <= end:
        out.append(cur)
        if len(out) > MAX_BUCKETS:
            raise AppError(400, "range_too_long", "조회 구간이 너무 깁니다. 주별·월별로 보거나 구간을 줄여주세요.")
        cur = _next_bucket(cur, period)
    return out


async def _products(session: AsyncSession, tier: str, used: set[str]) -> list[dict]:
    """활성 상품(가격순) + 구간에 데이터가 있는 비활성 상품. 매출 현황 화면과 같은 열 구성."""
    rows = list(
        await session.scalars(
            select(Product)
            .where(Product.tier_type == tier, (Product.is_active.is_(True)) | (Product.product_id.in_(used or {""})))
            .order_by(Product.price_usdt, Product.product_id)
        )
    )
    return [{"product_id": p.product_id, "label": p.name} for p in rows]


def _series(buckets: list[date], period: str, products: list[dict], rows) -> dict:
    """rows: (bucket datetime/date, product_id, value) → 칸을 모두 채운 표."""
    index = {b: i for i, b in enumerate(buckets)}
    values = {p["product_id"]: [0.0] * len(buckets) for p in products}
    for bucket, product_id, value in rows:
        d = bucket.date() if isinstance(bucket, datetime) else bucket
        i = index.get(d)
        if i is None or product_id not in values:
            continue
        values[product_id][i] = round(values[product_id][i] + float(value or 0), 2)
    totals = [round(sum(values[p["product_id"]][i] for p in products), 2) for i in range(len(buckets))]
    return {
        "labels": [_label(b, period) for b in buckets],
        "products": [{**p, "values": values[p["product_id"]]} for p in products],
        "totals": totals,
        "sum": round(sum(totals), 2),
    }


async def _grouped(session: AsyncSession, period: str, time_col, product_col, value, filters, start, end):
    s, e = _utc_bounds(start, end)
    bucket = func.date_trunc(q.PERIOD_UNIT[period], func.timezone(TZ.key, time_col)).label("bucket")
    rows = await session.execute(
        select(bucket, product_col, value)
        .where(*filters, time_col >= s, time_col < e)
        .group_by(bucket, product_col)
    )
    return list(rows.tuples())


async def _revenue_trend(session, period, start, end, buckets) -> dict:
    rows = await _grouped(
        session, period, ChallengeOrder.created_at, ChallengeOrder.product_id,
        func.coalesce(func.sum(ChallengeOrder.total_price - ChallengeOrder.refunded_amount), 0),
        (ChallengeOrder.status == "COMPLETED",), start, end,
    )
    products = await _products(session, "CHALLENGE", {r[1] for r in rows if r[2]})
    return _series(buckets, period, products, rows)


async def _account_trend(session, tier, period, start, end, buckets) -> dict:
    rows = await _grouped(
        session, period, TradingAccount.created_at, TradingAccount.product_id, func.count(),
        (TradingAccount.tier == tier, TradingAccount.provision_status != "FAILED"), start, end,
    )
    products = await _products(session, tier, {r[1] for r in rows if r[2]})
    out = _series(buckets, period, products, rows)
    for p in out["products"]:
        p["values"] = [int(v) for v in p["values"]]
    out["totals"] = [int(v) for v in out["totals"]]
    out["sum"] = int(out["sum"])
    return out


TREND_METRICS = ("revenue", "accounts")


async def trends(
    session: AsyncSession, *, metric: str, period: str | None, start_date: str | None, end_date: str | None,
    now: datetime | None = None,
) -> dict:
    now = now or datetime.now(UTC)
    period = period or "daily"
    if period not in DEFAULT_BUCKETS:
        raise AppError(400, "invalid_period", "period는 daily, weekly, monthly 중 하나여야 합니다.")
    if metric not in TREND_METRICS:
        raise AppError(400, "invalid_metric", "metric은 revenue, accounts 중 하나여야 합니다.")
    start, end = trend_window(period, start_date, end_date, now)
    buckets = _buckets(start, end, period)
    out = {"metric": metric, "period": period, "start_date": start.isoformat(), "end_date": end.isoformat()}
    if metric == "revenue":
        out["revenue"] = await _revenue_trend(session, period, start, end, buckets)
    else:
        out["challenge"] = await _account_trend(session, "CHALLENGE", period, start, end, buckets)
        out["funded"] = await _account_trend(session, "FUNDED", period, start, end, buckets)
    return out
