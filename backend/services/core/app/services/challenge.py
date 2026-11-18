"""챌린지 회차 자동 생성과 상태 진행.

기존 서버(Celery check_schedules)와 같은 규칙을 따른다.
- 스케줄마다 모집 중(PENDING)인 회차는 하나만 둔다. 그 회차가 시작되면 다음 회차를 만든다.
- 다음 회차 시작 = 직전 회차 시작일 + interval_days 일의 start_time (UTC).
  interval_days가 0이면 직전 회차 종료일의 start_time (종료 뒤 바로 시작).
- 종료 = 시작일 + duration_days 일의 end_time (UTC).
- exclude_holiday가 켜져 있으면 주말(토·일)과 휴장일을 건너뛴다. 종료일도 영업일만 센다.
- 회차 번호({seq})는 스케줄의 created_count + 1.

기존 서버와 다른 점: 서버가 오래 멈춰 있다가 다시 돌면, 이미 끝났어야 할 회차를 만들었다가
바로 취소하는 대신 건너뛰고 아직 끝나지 않은 회차부터 만든다.
"""

import datetime as dt
from datetime import UTC, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import AppError
from app.models import Challenge, ChallengeSchedule, Holiday, Product, Ruleset
from app.security import generate_human_code

PENDING, ACTIVE, CLOSED, CANCELLED = "PENDING", "ACTIVE", "CLOSED", "CANCELLED"
EXPIRED_REASON = "시작 시각이 지나기 전에 시작되지 않아 자동 취소"
# 서버가 멈춰 있던 동안의 회차를 건너뛸 때 무한 반복을 막는다.
MAX_CATCH_UP = 1000


# ── 날짜 계산 ───────────────────────────────────────────────


def is_trading_day(day: dt.date, holidays: set[dt.date]) -> bool:
    return day.weekday() < 5 and day not in holidays


def next_trading_datetime(value: datetime, holidays: set[dt.date]) -> datetime:
    """value가 주말·휴장일이면 같은 시각으로 다음 영업일로 옮긴다."""
    while not is_trading_day(value.date(), holidays):
        value += timedelta(days=1)
    return value


def _at(day: dt.date, at: time) -> datetime:
    return datetime.combine(day, at, tzinfo=UTC)


def compute_end_at(schedule: ChallengeSchedule, start_at: datetime, holidays: set[dt.date]) -> datetime:
    if schedule.duration_minutes is not None:
        return start_at + timedelta(minutes=schedule.duration_minutes)
    day = start_at.date()
    remaining = schedule.duration_days
    while remaining > 0:
        day += timedelta(days=1)
        if not schedule.exclude_holiday or is_trading_day(day, holidays):
            remaining -= 1
    end_at = _at(day, schedule.end_time)
    # 시작과 같은 날 end_time이 더 이르면 하루 뒤로 (duration_days=0인 경우만 해당)
    while end_at <= start_at:
        end_at += timedelta(days=1)
        if schedule.exclude_holiday:
            end_at = next_trading_datetime(end_at, holidays)
    return end_at


def compute_next_start_at(
    schedule: ChallengeSchedule, last: Challenge | None, now: datetime, holidays: set[dt.date]
) -> datetime:
    if schedule.interval_minutes is not None:
        base = last.start_at if last else now
        start_at = base + timedelta(minutes=schedule.interval_minutes) if last else now
    elif last is None:
        # 첫 회차: 오늘 start_time. 이미 지났더라도 그대로 만들고 바로 시작한다 (기존 서버와 같음).
        start_at = _at(now.date(), schedule.start_time)
    elif schedule.interval_days == 0:
        start_at = _at(last.end_at.date(), schedule.start_time)
        if start_at < last.end_at:
            start_at += timedelta(days=1)
    else:
        start_at = _at(last.start_at.date() + timedelta(days=schedule.interval_days), schedule.start_time)
    if schedule.exclude_holiday:
        start_at = next_trading_datetime(start_at, holidays)
    return start_at.replace(second=0, microsecond=0)


def render_name(template: str, seq: int, start_at: datetime) -> str:
    return template.format(
        date=start_at.strftime("%Y-%m-%d"),
        month=start_at.strftime("%Y-%m"),
        day=start_at.strftime("%d"),
        seq=seq,
        weekday=start_at.strftime("%a"),
    )


async def active_holidays(session: AsyncSession) -> set[dt.date]:
    return set(await session.scalars(select(Holiday.date).where(Holiday.is_active.is_(True))))


# ── 회차 ────────────────────────────────────────────────────


async def _new_challenge_id(session: AsyncSession) -> str:
    for _ in range(10):
        challenge_id = f"CHAL_{generate_human_code(8)}"
        if not await session.get(Challenge, challenge_id):
            return challenge_id
    raise AppError(500, "id_generation_failed", "챌린지 ID를 만들지 못했습니다.")


async def get_challenge(session: AsyncSession, challenge_id: str, lock: bool = False) -> Challenge:
    challenge = await session.get(Challenge, challenge_id, with_for_update=lock)
    if challenge is None:
        raise AppError(404, "challenge_not_found", "challenge not found")
    return challenge


async def _require_product(session: AsyncSession, product_id: str) -> Product:
    product = await session.get(Product, product_id)
    if product is None:
        raise AppError(404, "product_not_found", "product not found")
    if product.tier_type != "CHALLENGE":
        raise AppError(400, "invalid_product_tier", "챌린지 상품만 회차를 만들 수 있습니다.")
    return product


async def create_challenge(session: AsyncSession, data: dict) -> Challenge:
    await _require_product(session, data["product_id"])
    if data.get("challenge_schedule_id") is not None:
        await get_schedule(session, data["challenge_schedule_id"])
    challenge_id = data.pop("challenge_id", None)
    if challenge_id:
        if await session.get(Challenge, challenge_id):
            raise AppError(409, "challenge_already_exists", "이미 있는 챌린지 ID입니다.")
    else:
        challenge_id = await _new_challenge_id(session)
    challenge = Challenge(challenge_id=challenge_id, status=PENDING, **data)
    session.add(challenge)
    await session.flush()
    return challenge


def _parse_day(value: str) -> dt.date:
    try:
        return dt.date.fromisoformat(value if "-" in value else f"{value[:4]}-{value[4:6]}-{value[6:]}")
    except ValueError as exc:
        raise AppError(400, "invalid_date", "날짜는 YYYYMMDD 또는 YYYY-MM-DD 형식이어야 합니다.") from exc


def _start_on(query: Select, day: str | None) -> Select:
    if not day:
        return query
    start = _at(_parse_day(day), time(0, 0))
    return query.where(Challenge.start_at >= start, Challenge.start_at < start + timedelta(days=1))


async def list_challenges(
    session: AsyncSession,
    *,
    status: str | None,
    date: str | None,
    product_id: str | None,
    schedule_id: int | None,
    page: int,
    size: int,
) -> tuple[list[Challenge], int]:
    query = _start_on(select(Challenge), date)
    if status:
        query = query.where(Challenge.status == status)
    if product_id:
        query = query.where(Challenge.product_id == product_id)
    if schedule_id is not None:
        query = query.where(Challenge.challenge_schedule_id == schedule_id)
    total = await session.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = await session.scalars(
        query.order_by(Challenge.start_at.desc(), Challenge.challenge_id).offset((page - 1) * size).limit(size)
    )
    return list(rows), total


def start_challenge(challenge: Challenge, now: datetime) -> None:
    if challenge.status != PENDING:
        raise AppError(409, "invalid_challenge_status", f"{challenge.status} 상태의 회차는 시작할 수 없습니다.")
    challenge.status = ACTIVE
    challenge.started_at = now


def close_challenge(challenge: Challenge, now: datetime, cancel_reason: str | None = None) -> None:
    if cancel_reason:
        if challenge.status not in (PENDING, ACTIVE):
            raise AppError(409, "invalid_challenge_status", f"{challenge.status} 상태의 회차는 취소할 수 없습니다.")
        challenge.status = CANCELLED
        challenge.cancel_reason = cancel_reason
    else:
        if challenge.status != ACTIVE:
            raise AppError(409, "invalid_challenge_status", "진행 중(ACTIVE)인 회차만 종료할 수 있습니다.")
        challenge.status = CLOSED
    challenge.closed_at = now


async def active_dates(session: AsyncSession) -> list[str]:
    day = func.to_char(func.timezone("UTC", Challenge.start_at), "YYYYMMDD")
    rows = await session.scalars(
        select(day).where(Challenge.status != CANCELLED).group_by(day).order_by(day.desc())
    )
    return list(rows)


def _tier_code(product: Product) -> str:
    if product.type_code:
        return product.type_code
    return str(int(product.capital) // 1000)


async def grouped(
    session: AsyncSession, *, status: str | None, date: str | None, page: int, size: int
) -> tuple[list[dict], int]:
    """같은 기간·상태의 회차를 한 줄로 묶고, 상품 등급별 참가자 수를 더한다 (백오피스 대회 목록)."""
    keys = select(Challenge.start_at, Challenge.end_at, Challenge.status)
    keys = _start_on(keys, date)
    if status:
        keys = keys.where(Challenge.status == status)
    keys = keys.group_by(Challenge.start_at, Challenge.end_at, Challenge.status)
    total = await session.scalar(select(func.count()).select_from(keys.subquery())) or 0
    groups = (
        await session.execute(
            keys.order_by(Challenge.start_at.desc(), Challenge.status).offset((page - 1) * size).limit(size)
        )
    ).all()
    items = []
    for start_at, end_at, group_status in groups:
        rows = await session.execute(
            select(Product, func.sum(Challenge.current_participants))
            .join(Product, Product.product_id == Challenge.product_id)
            .where(Challenge.start_at == start_at, Challenge.end_at == end_at, Challenge.status == group_status)
            .group_by(Product.product_id)
        )
        participants: dict[str, int] = {}
        for product, count in rows.all():
            code = _tier_code(product)
            participants[code] = participants.get(code, 0) + int(count or 0)
        items.append({"start_at": start_at, "end_at": end_at, "status": group_status, "participants": participants})
    return items, total


async def summary(session: AsyncSession) -> dict:
    """사용자 웹 챌린지 목록. 모집 중·진행 중인 회차를 시작 순으로 보여준다."""
    rows = (
        await session.execute(
            select(Challenge, Product)
            .join(Product, Product.product_id == Challenge.product_id)
            .where(Challenge.status.in_((PENDING, ACTIVE)), Product.is_active.is_(True))
            .order_by(Challenge.start_at, Challenge.challenge_id)
        )
    ).all()
    challenges = [
        {
            "status": c.status,
            "challenge_id": c.challenge_id,
            "challenge_name": c.name,
            "product_id": p.product_id,
            "description": p.description,
            "capital": float(p.capital),
            "price_usdt": float(p.price_usdt),
            "discount_price_usdt": None if p.discount_price_usdt is None else float(p.discount_price_usdt),
            "type_code": p.type_code,
            "is_most_popular": p.is_most_popular,
            "current_participants": c.current_participants,
            "group_size": c.group_size,
            "start_at": c.start_at,
        }
        for c, p in rows
    ]
    # 계좌 기능이 들어오기 전까지는 진행 중 회차의 참가자 수 합계로 대신한다.
    total_active = sum(c["current_participants"] for c in challenges if c["status"] == ACTIVE)
    return {"challenges": challenges, "total_active_accounts": total_active}


def _offer_rules(ruleset: Ruleset | None, capital: Decimal) -> dict | None:
    if ruleset is None:
        return None

    def amount(pct: Decimal | None) -> float | None:
        return None if pct is None else float((capital * pct / 100).quantize(Decimal("0.01")))

    def amount_or_pct(amt: Decimal | None, pct: Decimal | None) -> float | None:
        # 룰셋에 금액($)이 정해져 있으면 그 값을, 없으면 비율로 계산한 값을 쓴다.
        return float(amt) if amt is not None else amount(pct)

    return {
        "ruleset_id": ruleset.id,
        "ruleset_name": ruleset.name,
        "profit_target_pct": None if ruleset.profit_target_pct is None else float(ruleset.profit_target_pct),
        "profit_target_amt": amount_or_pct(ruleset.profit_target_amt, ruleset.profit_target_pct),
        "max_drawdown_pct": float(ruleset.max_dd_normal_pct),
        "max_drawdown_amt": amount_or_pct(ruleset.max_dd_normal_amt, ruleset.max_dd_normal_pct),
        "daily_loss_limit_pct": float(ruleset.daily_loss_limit_pct),
        "daily_loss_limit_amt": amount_or_pct(ruleset.daily_loss_limit_amt, ruleset.daily_loss_limit_pct),
        "dd_calc_method": ruleset.dd_calc_method,
        "min_trading_days": ruleset.min_trading_days,
        "pass_condition_type": ruleset.pass_condition_type,
        "pass_condition_pct": None if ruleset.pass_condition_pct is None else float(ruleset.pass_condition_pct),
        "pass_condition_amt": None if ruleset.pass_condition_amt is None else float(ruleset.pass_condition_amt),
        "max_mini_contracts": ruleset.max_mini_contracts,
        "max_micro_contracts": ruleset.max_micro_contracts,
        "consistency_pct": None if ruleset.consistency_pct is None else float(ruleset.consistency_pct),
    }


async def offers(session: AsyncSession) -> list[dict]:
    """사용자 웹 Start New Challenge 카드. 판매 중인 챌린지 상품과 지금 신청할 수 있는 회차.

    - 상품: 활성 챌린지 상품, 자본금 순.
    - 펀디드 단계: 이 챌린지 상품을 연관 챌린지 상품(related_id)으로 지정한 활성 펀디드 상품.
      없으면 next_product_id 상품.
    - 신청 회차: 모집 중(PENDING)이고 정원이 남은 회차 중 가장 먼저 시작하는 것.
    """
    products = list(
        await session.scalars(
            select(Product)
            .where(Product.tier_type == "CHALLENGE", Product.is_active.is_(True))
            .order_by(Product.capital, Product.product_id)
        )
    )
    if not products:
        return []
    funded_products = list(
        await session.scalars(
            select(Product)
            .where(Product.tier_type == "FUNDED", Product.is_active.is_(True))
            .order_by(Product.product_id)
        )
    )
    funded_by_id = {p.product_id: p for p in funded_products}
    funded_by_related = {p.related_id: p for p in funded_products if p.related_id}

    ruleset_ids = {p.ruleset_id for p in [*products, *funded_products] if p.ruleset_id}
    rulesets = {
        r.id: r for r in await session.scalars(select(Ruleset).where(Ruleset.id.in_(ruleset_ids)))
    } if ruleset_ids else {}

    rounds: dict[str, Challenge] = {}
    for c in await session.scalars(
        select(Challenge)
        .where(
            Challenge.product_id.in_([p.product_id for p in products]),
            Challenge.status == PENDING,
            or_(Challenge.group_size.is_(None), Challenge.current_participants < Challenge.group_size),
        )
        .order_by(Challenge.start_at, Challenge.challenge_id)
    ):
        rounds.setdefault(c.product_id, c)

    items = []
    for p in products:
        funded = funded_by_related.get(p.product_id)
        if funded is None and p.next_product_id:
            funded = funded_by_id.get(p.next_product_id)
        c = rounds.get(p.product_id)
        price = p.discount_price_usdt if p.discount_price_usdt is not None else p.price_usdt
        items.append(
            {
                "product_id": p.product_id,
                "name": p.name,
                "description": p.description,
                "capital": float(p.capital),
                "price_usdt": float(p.price_usdt),
                "discount_price_usdt": None if p.discount_price_usdt is None else float(p.discount_price_usdt),
                "final_price_usdt": float(price),
                "is_most_popular": p.is_most_popular,
                "leverage": p.leverage,
                "duration_days": p.duration_days,
                "rules": _offer_rules(rulesets.get(p.ruleset_id), p.capital),
                "funded": None
                if funded is None
                else {
                    "product_id": funded.product_id,
                    "name": funded.name,
                    "capital": float(funded.capital),
                    "leverage": funded.leverage,
                    "payout_ratio": float(funded.payout_ratio),
                    "rules": _offer_rules(rulesets.get(funded.ruleset_id), funded.capital),
                },
                "open_challenge": None
                if c is None
                else {
                    "challenge_id": c.challenge_id,
                    "challenge_name": c.name,
                    "start_at": c.start_at,
                    "end_at": c.end_at,
                    "current_participants": c.current_participants,
                    "group_size": c.group_size,
                },
            }
        )
    return items


# ── 스케줄 ──────────────────────────────────────────────────


async def get_schedule(session: AsyncSession, schedule_id: int, lock: bool = False) -> ChallengeSchedule:
    schedule = await session.get(ChallengeSchedule, schedule_id, with_for_update=lock)
    if schedule is None:
        raise AppError(404, "schedule_not_found", "schedule not found")
    return schedule


def _check_schedule(schedule: ChallengeSchedule) -> None:
    if schedule.duration_days == 0 and schedule.duration_minutes is None:
        raise AppError(400, "invalid_duration", "duration_days는 1 이상이어야 합니다.")
    try:
        render_name(schedule.name_template, 1, datetime.now(UTC))
    except (KeyError, IndexError, ValueError) as exc:
        raise AppError(400, "invalid_name_template", "name_template 형식이 올바르지 않습니다.") from exc


async def create_schedule(session: AsyncSession, data: dict) -> ChallengeSchedule:
    await _require_product(session, data["product_id"])
    schedule = ChallengeSchedule(**data)
    _check_schedule(schedule)
    session.add(schedule)
    await session.flush()
    return schedule


async def update_schedule(session: AsyncSession, schedule: ChallengeSchedule, data: dict) -> None:
    nullable = {"max_occurrences", "next_run_at", "description", "interval_minutes", "duration_minutes", "group_size"}
    if data.get("product_id"):
        await _require_product(session, data["product_id"])
    if data.get("status") == "COMPLETED":
        raise AppError(400, "invalid_schedule_status", "COMPLETED는 직접 지정할 수 없습니다.")
    for field, value in data.items():
        if value is None and field not in nullable:
            continue
        setattr(schedule, field, value)
    _check_schedule(schedule)
    # 최대 회차를 늘리면 완료된 스케줄을 다시 돌릴 수 있게 한다.
    if schedule.status == "COMPLETED" and (
        schedule.max_occurrences is None or schedule.created_count < schedule.max_occurrences
    ):
        schedule.status = "ACTIVE"


async def list_schedules(
    session: AsyncSession, *, status: str | None, product_id: str | None, page: int, size: int
) -> tuple[list[ChallengeSchedule], int]:
    query = select(ChallengeSchedule)
    if status:
        query = query.where(ChallengeSchedule.status == status)
    if product_id:
        query = query.where(ChallengeSchedule.product_id == product_id)
    total = await session.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = await session.scalars(query.order_by(ChallengeSchedule.id.desc()).offset((page - 1) * size).limit(size))
    return list(rows), total


async def run_schedule(
    session: AsyncSession, schedule: ChallengeSchedule, now: datetime, holidays: set[dt.date]
) -> tuple[Challenge | None, str | None]:
    """스케줄의 다음 회차를 하나 만든다. 만들지 않았으면 (None, 이유)를 돌려준다."""
    if schedule.status == "COMPLETED" or (
        schedule.max_occurrences is not None and schedule.created_count >= schedule.max_occurrences
    ):
        schedule.status = "COMPLETED"
        return None, "max_occurrences_reached"

    pending = await session.scalar(
        select(Challenge.challenge_id)
        .where(Challenge.challenge_schedule_id == schedule.id, Challenge.status == PENDING)
        .limit(1)
    )
    if pending:
        return None, "pending_exists"

    last = await session.scalar(
        select(Challenge)
        .where(Challenge.challenge_schedule_id == schedule.id)
        .order_by(Challenge.start_at.desc())
        .limit(1)
    )
    start_at = compute_next_start_at(schedule, last, now, holidays)
    end_at = compute_end_at(schedule, start_at, holidays)
    # 이미 끝났어야 할 회차는 건너뛴다.
    for _ in range(MAX_CATCH_UP):
        if end_at > now:
            break
        skipped = Challenge(challenge_id="", product_id=schedule.product_id, name="", start_at=start_at, end_at=end_at)
        start_at = compute_next_start_at(schedule, skipped, now, holidays)
        end_at = compute_end_at(schedule, start_at, holidays)

    seq = schedule.created_count + 1
    challenge = Challenge(
        challenge_id=await _new_challenge_id(session),
        product_id=schedule.product_id,
        challenge_schedule_id=schedule.id,
        name=render_name(schedule.name_template, seq, start_at),
        group_size=schedule.group_size,
        status=PENDING,
        start_at=start_at,
        end_at=end_at,
        duration_days=schedule.duration_days,
        duration_minutes=schedule.duration_minutes,
    )
    session.add(challenge)
    schedule.created_count = seq
    schedule.last_created_at = now
    # 이 회차가 시작되면 다음 회차를 만든다.
    schedule.next_run_at = start_at
    if schedule.max_occurrences is not None and seq >= schedule.max_occurrences:
        schedule.status = "COMPLETED"
    await session.flush()
    return challenge, None


async def advance_challenges(session: AsyncSession, now: datetime) -> dict[str, int]:
    """시작·종료 시각이 된 회차의 상태를 바꾼다."""
    counts = {"started": 0, "closed": 0, "cancelled": 0}
    due = await session.scalars(
        select(Challenge)
        .where(
            or_(
                (Challenge.status == PENDING) & (Challenge.start_at <= now),
                (Challenge.status == ACTIVE) & (Challenge.end_at <= now),
            )
        )
        .order_by(Challenge.start_at)
        .with_for_update(skip_locked=True)
    )
    for challenge in due:
        if challenge.status == PENDING and challenge.end_at <= now:
            close_challenge(challenge, now, EXPIRED_REASON)
            counts["cancelled"] += 1
        elif challenge.status == PENDING:
            start_challenge(challenge, now)
            counts["started"] += 1
        else:
            close_challenge(challenge, now)
            counts["closed"] += 1
    await session.flush()
    return counts


async def run_due_jobs(session: AsyncSession, now: datetime | None = None) -> dict[str, int]:
    """주기 작업 한 번: 회차 상태를 진행시키고, 때가 된 스케줄의 다음 회차를 만든다."""
    now = now or datetime.now(UTC)
    counts = await advance_challenges(session, now)
    holidays = await active_holidays(session)
    schedules = await session.scalars(
        select(ChallengeSchedule)
        .where(
            ChallengeSchedule.status == "ACTIVE",
            or_(ChallengeSchedule.next_run_at.is_(None), ChallengeSchedule.next_run_at <= now),
        )
        .order_by(ChallengeSchedule.id)
        .with_for_update(skip_locked=True)
    )
    created = 0
    for schedule in list(schedules):
        challenge, _ = await run_schedule(session, schedule, now, holidays)
        if challenge is None:
            continue
        created += 1
        # 첫 회차처럼 시작 시각이 이미 지났으면 바로 시작한다.
        if challenge.start_at <= now:
            start_challenge(challenge, now)
            counts["started"] += 1
            next_challenge, _ = await run_schedule(session, schedule, now, holidays)
            created += 1 if next_challenge else 0
    return {"created": created, **counts}


# ── 휴장일 ──────────────────────────────────────────────────


async def list_holidays(session: AsyncSession, year: int | None) -> list[Holiday]:
    query = select(Holiday)
    if year:
        query = query.where(Holiday.date >= dt.date(year, 1, 1), Holiday.date <= dt.date(year, 12, 31))
    return list(await session.scalars(query.order_by(Holiday.date)))


async def create_holiday(session: AsyncSession, data: dict) -> Holiday:
    if await session.scalar(select(Holiday.id).where(Holiday.date == data["date"])):
        raise AppError(409, "holiday_already_exists", "이미 등록된 날짜입니다.")
    holiday = Holiday(**data)
    session.add(holiday)
    await session.flush()
    return holiday


async def get_holiday(session: AsyncSession, holiday_id: int) -> Holiday:
    holiday = await session.get(Holiday, holiday_id)
    if holiday is None:
        raise AppError(404, "holiday_not_found", "holiday not found")
    return holiday
