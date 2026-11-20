"""주문·계좌 조회와 매출 집계 (화면용)."""

import math
import uuid
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import AppError
from app.models import Challenge, ChallengeOrder, Product, TradingAccount, User
from app.security import decrypt_text
from app.services import challenge_order as orders
from app.services import mt4, payout_settings
from app.services.wallet import as_float, day_range

PAYMENT_METHOD_LABEL = "통합 지갑 (USDT)"
DEFAULT_TZ = "Asia/Seoul"


def pages(total: int, size: int) -> int:
    return math.ceil(total / size) if total else 0


def _f(value) -> float:
    return as_float(value) or 0.0


def zone(name: str | None) -> ZoneInfo:
    try:
        return ZoneInfo(name or DEFAULT_TZ)
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo(DEFAULT_TZ)


# ── 주문 ────────────────────────────────────────────────────


def order_account_out(a: TradingAccount) -> dict:
    return {
        "account_id": str(a.id),
        "mt4_login": a.mt4_login,
        "provision_status": a.provision_status,
        "status": a.status,
        "start_at": a.start_at,
        "end_at": a.end_at,
    }


def order_out(order: ChallengeOrder, accounts: list[TradingAccount], challenge_name: str | None = None) -> dict:
    return {
        "order_id": order.id,
        "challenge_id": order.challenge_id,
        "challenge_name": challenge_name,
        "product_id": order.product_id,
        "product_name": order.product_name,
        "type_code": order.type_code,
        "quantity": order.quantity,
        "unit_price": _f(order.unit_price),
        "original_price": _f(order.original_price),
        "discount_amount": _f(order.discount_amount),
        "total_price": _f(order.total_price),
        "issued_quantity": order.issued_quantity,
        "refunded_quantity": order.refunded_quantity,
        "refunded_amount": _f(order.refunded_amount),
        "status": order.status,
        "created_at": order.created_at,
        "completed_at": order.completed_at,
        "accounts": [order_account_out(a) for a in accounts],
    }


async def _challenge_names(session: AsyncSession, ids: set[str]) -> dict[str, str]:
    if not ids:
        return {}
    rows = await session.execute(select(Challenge.challenge_id, Challenge.name).where(Challenge.challenge_id.in_(ids)))
    return dict(rows.tuples().all())


def _status_filter(query: Select, status: str | None) -> Select:
    if not status or status.upper() == "ALL":
        return query
    value = status.upper()
    # 기존 서버 값 processing = 계좌 발급 중(PENDING)
    return query.where(ChallengeOrder.status == ("PENDING" if value == "PROCESSING" else value))


def _date_filter(query: Select, start_date: str | None, end_date: str | None) -> Select:
    start, end = day_range(start_date, end_date)
    if start:
        query = query.where(ChallengeOrder.created_at >= start)
    if end:
        query = query.where(ChallengeOrder.created_at < end)
    return query


async def my_orders(
    session: AsyncSession, user: User, *, status: str | None, search: str | None,
    start_date: str | None, end_date: str | None, page: int, size: int,
) -> tuple[list[dict], int]:
    query = select(ChallengeOrder).where(ChallengeOrder.user_id == user.id)
    query = _date_filter(_status_filter(query, status), start_date, end_date)
    if search and search.strip():
        kw = f"%{search.strip()}%"
        query = query.where(
            or_(
                ChallengeOrder.product_name.ilike(kw),
                ChallengeOrder.id.ilike(kw),
                ChallengeOrder.type_code == search.strip(),
            )
        )
    total = await session.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = list(
        await session.scalars(
            query.order_by(ChallengeOrder.created_at.desc(), ChallengeOrder.id).offset((page - 1) * size).limit(size)
        )
    )
    accounts = await orders.order_accounts(session, [o.id for o in rows])
    names = await _challenge_names(session, {o.challenge_id for o in rows})
    return [order_out(o, accounts.get(o.id, []), names.get(o.challenge_id)) for o in rows], total


async def my_order(session: AsyncSession, user: User, order_id: str) -> dict:
    order = await orders.get_my_order(session, user, order_id)
    accounts = await orders.order_accounts(session, [order.id])
    names = await _challenge_names(session, {order.challenge_id})
    return order_out(order, accounts.get(order.id, []), names.get(order.challenge_id))


def _nickname(user: User) -> str:
    return " ".join(p for p in (user.first_name, user.last_name) if p and p.strip()).strip()


def admin_order_item(order: ChallengeOrder, user: User) -> dict:
    return {
        "id": order.id,
        "uid": user.uid,
        "user_id": str(user.id),
        "user_email": user.email,
        "user_nickname": _nickname(user),
        "challenge_id": order.challenge_id,
        "product_id": order.product_id,
        "product_name": order.product_name,
        "quantity": order.quantity,
        "unit_price": _f(order.unit_price),
        "total_price": _f(order.total_price),
        "issued_quantity": order.issued_quantity,
        "refunded_quantity": order.refunded_quantity,
        "refunded_amount": _f(order.refunded_amount),
        "payment_method": PAYMENT_METHOD_LABEL,
        "status": order.status,
        "created_at": order.created_at,
        "completed_at": order.completed_at,
    }


async def admin_orders(
    session: AsyncSession, *, keyword: str | None, status: str | None, product_type: str | None,
    start_date: str | None, end_date: str | None, page: int, size: int,
) -> tuple[list[dict], int]:
    query = select(ChallengeOrder, User).join(User, User.id == ChallengeOrder.user_id)
    query = _date_filter(_status_filter(query, status), start_date, end_date)
    if product_type and product_type.strip() and product_type.upper() != "ALL":
        query = query.where(or_(ChallengeOrder.type_code == product_type, ChallengeOrder.product_id == product_type))
    if keyword and keyword.strip():
        kw = f"%{keyword.strip()}%"
        query = query.where(
            or_(
                User.email.ilike(kw),
                User.uid.ilike(kw),
                func.concat(User.first_name, " ", User.last_name).ilike(kw),
                ChallengeOrder.product_name.ilike(kw),
                ChallengeOrder.id.ilike(kw),
            )
        )
    total = await session.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = await session.execute(
        query.order_by(ChallengeOrder.created_at.desc(), ChallengeOrder.id).offset((page - 1) * size).limit(size)
    )
    return [admin_order_item(o, u) for o, u in rows.tuples().all()], total


async def admin_order(session: AsyncSession, order_id: str) -> dict:
    row = (
        await session.execute(
            select(ChallengeOrder, User).join(User, User.id == ChallengeOrder.user_id).where(ChallengeOrder.id == order_id)
        )
    ).first()
    if row is None:
        raise AppError(404, "order_not_found", "주문을 찾을 수 없습니다.")
    order, user = row
    accounts = (await orders.order_accounts(session, [order.id])).get(order.id, [])
    return {
        **admin_order_item(order, user),
        "accounts": [
            {
                **order_account_out(a),
                "mt4_server": a.mt4_server,
                "provision_error": a.provision_error,
                "issued_at": a.issued_at,
            }
            for a in accounts
        ],
    }


async def admin_order_summary(session: AsyncSession, now: datetime | None = None) -> dict:
    now = now or datetime.now(UTC)
    month_start = now.astimezone(zone(DEFAULT_TZ)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    row = (
        await session.execute(
            select(
                func.count(ChallengeOrder.id),
                func.coalesce(
                    func.sum(ChallengeOrder.total_price - ChallengeOrder.refunded_amount).filter(
                        ChallengeOrder.status == orders.COMPLETED
                    ),
                    0,
                ),
                func.count(ChallengeOrder.id).filter(
                    ChallengeOrder.status == orders.COMPLETED, ChallengeOrder.created_at >= month_start
                ),
                func.count(ChallengeOrder.id).filter(ChallengeOrder.refunded_quantity > 0),
            )
        )
    ).one()
    provisioning = await session.scalar(
        select(func.count()).where(TradingAccount.provision_status == orders.QUEUED)
    )
    return {
        "total_orders": row[0] or 0,
        "total_payment": _f(row[1]),
        "this_month_completed": row[2] or 0,
        "total_refunds": row[3] or 0,
        "provisioning_accounts": provisioning or 0,
    }


# ── 계좌 (사용자) ───────────────────────────────────────────


def money_out(a: TradingAccount) -> dict:
    """잔고·평가금액·수익. MT4에서 수집한 값이 있으면 그 값, 없으면 발급 완료 계좌는 자본금으로 본다."""
    issued = a.provision_status == orders.DONE
    capital = _f(a.capital)
    balance = _f(a.balance) if a.balance is not None else (capital if issued else 0.0)
    equity = _f(a.equity) if a.equity is not None else balance
    collected = a.balance is not None
    return {
        "balance": balance,
        "equity": equity,
        "total_profit": round(balance - capital, 2) if collected else 0.0,
        "floating_profit": round(equity - capital, 2) if collected else 0.0,
        "equity_updated_at": a.equity_updated_at,
    }


def account_out(a: TradingAccount, product: Product | None, challenge: Challenge | None, user: User) -> dict:
    # 발급이 끝난 계좌는 대회 시작 전(PENDING, 거래 잠금)에도 본인에게 비밀번호를 보여 준다 (발급 메일에도 담겨 나간다).
    revealed = a.provision_status == orders.DONE
    password = decrypt_text(a.password_encrypted) if revealed and a.password_encrypted else None
    return {
        "mt4_login": a.mt4_login,
        "account_id": str(a.id),
        "user_id": str(a.user_id),
        "product_id": a.product_id,
        "product_name": product.name if product else None,
        "status": a.status,
        "provision_status": a.provision_status,
        "tier": a.tier,
        "type_code": a.type_code,
        "is_read_only": a.is_read_only,
        "capital": _f(a.capital),
        **money_out(a),
        "failed_reason": a.provision_error if a.provision_status == "FAILED" else None,
        "reason": None,
        "created_at": a.created_at,
        "challenge_id": a.challenge_id,
        "challenge_name": challenge.name if challenge else None,
        "start_date": a.start_at,
        "end_date": a.end_at,
        "user_email": user.email,
        "mt4_server": mt4.server_name(a.mt4_server),
        "mt4_password": password,
        "order_id": a.order_id,
        # 데모 계좌는 회원이 고른 레버리지 (기존 서버의 leverage_override와 같은 뜻)
        "leverage_override": a.leverage if a.tier == "DEMO" else None,
    }


async def _account_rows(session: AsyncSession, query: Select) -> list[tuple[TradingAccount, Product, Challenge | None]]:
    rows = await session.execute(
        query.add_columns(Product, Challenge)
        .join(Product, Product.product_id == TradingAccount.product_id)
        .outerjoin(Challenge, Challenge.challenge_id == TradingAccount.challenge_id)
    )
    return [tuple(r) for r in rows.all()]


async def my_accounts(
    session: AsyncSession, user: User, *, tier: str | None, status: str | None, type_code: str | None,
    mt4_login: int | None, page: int, size: int,
) -> tuple[list[dict], int]:
    # 발급 실패(환불) 계좌는 목록에서 뺀다 (주문 내역에서 볼 수 있다).
    query = select(TradingAccount).where(TradingAccount.user_id == user.id, TradingAccount.provision_status != "FAILED")
    if tier:
        query = query.where(TradingAccount.tier == tier.upper())
    if status:
        query = query.where(TradingAccount.status == status.upper())
    if type_code:
        query = query.where(TradingAccount.type_code == type_code)
    if mt4_login is not None:
        query = query.where(TradingAccount.mt4_login == mt4_login)
    total = await session.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = await _account_rows(
        session, query.order_by(TradingAccount.created_at.desc(), TradingAccount.id).offset((page - 1) * size).limit(size)
    )
    return [account_out(a, p, c, user) for a, p, c in rows], total


async def my_account(session: AsyncSession, user: User, account_id: uuid.UUID) -> dict:
    rows = await _account_rows(
        session, select(TradingAccount).where(TradingAccount.id == account_id, TradingAccount.user_id == user.id)
    )
    if not rows:
        raise AppError(404, "account_not_found", "계좌를 찾을 수 없습니다.")
    a, p, c = rows[0]
    out = account_out(a, p, c, user)
    return {
        **out,
        "leverage": a.leverage,
        # 출금 가능 수익 = max(0, 잔고 − 자본금) (기존 서버와 같음)
        "available_balance": max(0.0, out["total_profit"]),
        "total_completed_payout": 0.0,
        "session_id": a.challenge_id,
        "session_name": c.name if c else None,
        "start_at": a.start_at,
        "end_at": a.end_at,
        "challenge_mt4_login": a.mt4_login,
        "user_name": _nickname(user) or None,
        "user_grade": user.grade,
    }


async def challenge_account_summary(session: AsyncSession, user: User) -> dict:
    base = (
        TradingAccount.user_id == user.id,
        TradingAccount.tier == "CHALLENGE",
        TradingAccount.provision_status != "FAILED",
    )
    row = (
        await session.execute(
            select(
                func.count(),
                # 진행 중 = 대회가 시작돼 거래 가능한 ACTIVE 계좌만 (대회 시작 전 PENDING·종료된 CLOSED 등은 제외)
                func.count().filter(TradingAccount.status == "ACTIVE"),
                func.count().filter(TradingAccount.status == "PASSED"),
                func.count().filter(TradingAccount.status == "FAILED"),
                func.count().filter(TradingAccount.provision_status == orders.QUEUED),
            ).where(*base)
        )
    ).one()
    by_product = await session.execute(
        select(TradingAccount.product_id, Product.name, func.count())
        .join(Product, Product.product_id == TradingAccount.product_id)
        .where(*base)
        .group_by(TradingAccount.product_id, Product.name)
        .order_by(TradingAccount.product_id)
    )
    return {
        "total_challenges": row[0],
        "active_challenges": row[1],
        "passed_challenges": row[2],
        "failed_challenges": row[3],
        "provisioning": row[4],
        "by_product": [{"product_id": pid, "product_name": name, "count": n} for pid, name, n in by_product.tuples()],
    }


# ── 매출 ────────────────────────────────────────────────────

PERIOD_UNIT = {"weekly": "week", "monthly": "month", "yearly": "year"}


def _bucket_label(value: datetime, period: str) -> str:
    if period == "weekly":
        return value.strftime("%Y-%m-%d")
    if period == "monthly":
        return value.strftime("%Y-%m")
    return value.strftime("%Y")


def _local_day_bounds(day: str | None, tz: ZoneInfo) -> datetime | None:
    if not day:
        return None
    for fmt in ("%Y-%m-%d", "%Y%m%d"):
        try:
            return datetime.strptime(day.strip(), fmt).replace(tzinfo=tz)
        except ValueError:
            continue
    return None


async def _keyword_user_ids(session: AsyncSession, keyword: str | None) -> list[uuid.UUID] | None:
    if not keyword or not keyword.strip():
        return None
    kw = f"%{keyword.strip()}%"
    ids = list(
        await session.scalars(
            select(User.id).where(
                or_(User.email.ilike(kw), func.concat(User.first_name, " ", User.last_name).ilike(kw))
            )
        )
    )
    if not ids:
        raise AppError(400, "user_not_found", f"{keyword.strip()}에 해당하는 회원을 찾을 수 없습니다.")
    return ids


def _require_period(period: str | None) -> str:
    if period not in PERIOD_UNIT:
        raise AppError(400, "period_required", "주별 / 월별 / 연별 중 하나를 선택해주세요.")
    return period


async def challenge_sales(
    session: AsyncSession, *, period: str | None, start_date: str | None, end_date: str | None,
    keyword: str | None, timezone: str | None,
) -> dict:
    """챌린지 매출: 처리가 끝난(COMPLETED) 주문의 발급 수량·금액(환불 제외)을 기간·상품별로 묶는다.

    열(columns)은 활성 챌린지 상품(가격순, Starter~Prime 등 DB에 있는 만큼)이고,
    조회 기간에 매출이 있는데 지금은 비활성인 상품도 열로 붙여 합계와 열 합이 맞게 한다.
    기준 시각은 주문 시각(created_at), 기간·주 경계는 X-Timezone(기본 한국 시간)."""
    period = _require_period(period)
    tz = zone(timezone)
    user_ids = await _keyword_user_ids(session, keyword)
    products = list(
        await session.scalars(
            select(Product)
            .where(Product.tier_type == "CHALLENGE", Product.is_active.is_(True))
            .order_by(Product.price_usdt, Product.product_id)
        )
    )
    columns = [{"product_id": p.product_id, "label": p.name, "price_usdt": _f(p.price_usdt)} for p in products]

    local = func.timezone(tz.key, ChallengeOrder.created_at)
    bucket = func.date_trunc(PERIOD_UNIT[period], local).label("bucket")
    filters = [ChallengeOrder.status == orders.COMPLETED]
    start = _local_day_bounds(start_date, tz)
    end = _local_day_bounds(end_date, tz)
    if start:
        filters.append(ChallengeOrder.created_at >= start)
    if end:
        filters.append(ChallengeOrder.created_at < end + timedelta(days=1))
    if user_ids is not None:
        filters.append(ChallengeOrder.user_id.in_(user_ids))
    rows = await session.execute(
        select(
            bucket,
            ChallengeOrder.product_id,
            func.coalesce(func.sum(ChallengeOrder.issued_quantity), 0),
            func.coalesce(func.sum(ChallengeOrder.total_price - ChallengeOrder.refunded_amount), 0),
        )
        .where(*filters)
        .group_by(bucket, ChallengeOrder.product_id)
        .order_by(bucket)
    )

    rows = list(rows.tuples())
    known = {c["product_id"] for c in columns}
    missing = {product_id for _, product_id, _, _ in rows if product_id not in known}
    if missing:
        extra = await session.scalars(
            select(Product).where(Product.product_id.in_(missing)).order_by(Product.price_usdt, Product.product_id)
        )
        columns += [{"product_id": p.product_id, "label": p.name, "price_usdt": _f(p.price_usdt)} for p in extra]

    def empty() -> dict:
        return {c["product_id"]: {"quantity": 0, "amount": 0.0} for c in columns}

    items: dict[datetime, dict] = {}
    summary = {"quantity": 0, "amount": 0.0, "by_product": empty()}
    for bucket_value, product_id, qty, amount in rows:
        item = items.setdefault(
            bucket_value,
            {"date": _bucket_label(bucket_value, period), "products": empty(), "subtotal": {"quantity": 0, "amount": 0.0}},
        )
        qty, amount = int(qty), _f(amount)
        cell = item["products"].setdefault(product_id, {"quantity": 0, "amount": 0.0})
        cell["quantity"] += qty
        cell["amount"] = round(cell["amount"] + amount, 2)
        item["subtotal"]["quantity"] += qty
        item["subtotal"]["amount"] = round(item["subtotal"]["amount"] + amount, 2)
        total_cell = summary["by_product"].setdefault(product_id, {"quantity": 0, "amount": 0.0})
        total_cell["quantity"] += qty
        total_cell["amount"] = round(total_cell["amount"] + amount, 2)
        summary["quantity"] += qty
        summary["amount"] = round(summary["amount"] + amount, 2)
    out = list(items.values())
    return {
        "period": period, "columns": columns, "items": out, "total": len(out), "page": 1,
        "size": max(len(out), 1), "pages": 1 if out else 0, "summary": summary,
    }


async def funded_sales(
    session: AsyncSession, *, period: str | None, start_date: str | None, end_date: str | None,
    keyword: str | None, timezone: str | None,
) -> dict:
    """펀디드 매출(수익 출금 요청 분배)은 펀디드·출금 기능을 옮긴 뒤 채운다. 지금은 빈 집계."""
    period = _require_period(period)
    await _keyword_user_ids(session, keyword)
    split = await payout_settings.get_profit_split(session)
    return {
        "period": period,
        "profit_split": {"trader_pct": split["trader_pct"], "company_pct": split["company_pct"]},
        "items": [], "total": 0, "page": 1, "size": 1, "pages": 0,
        "summary": {"request_count": 0, "request_amount": 0, "trader_amount": 0, "company_amount": 0},
    }
