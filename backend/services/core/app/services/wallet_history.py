"""입출금 요청 목록 (웹 거래 내역, 백오피스 승인 대기·처리 이력). 응답 형태는 기존 서버와 같다.

입금 요청과 출금 요청을 한 목록으로 합친다. 두 테이블은 번호 시퀀스를 같이 써서 id가 겹치지 않는다.
상태 표시: 입금 PENDING/APPROVED/REJECTED, 출금 REQUESTED/APPROVED/REJECTED → Pending / Completed / Failed
"""

import math
from datetime import datetime

from sqlalchemy import String, case, cast, func, literal, null, or_, select, union_all
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import DepositRequest, User, WithdrawalRequest
from app.services.wallet import as_float, day_range

EXTERNAL_WALLET = "External Wallet"


def _display_status(status_col):
    return case(
        (status_col.in_(("PENDING", "REQUESTED")), literal("Pending")),
        (status_col == "APPROVED", literal("Completed")),
        else_=literal("Failed"),
    )


def _requests_union():
    """입금·출금 요청을 같은 컬럼으로 맞춘 하위 쿼리."""
    deposits = select(
        DepositRequest.id.label("id"),
        literal("DEPOSIT_REQ").label("source"),
        DepositRequest.user_id.label("user_id"),
        literal("DEPOSIT").label("tx_type"),
        literal("IN").label("direction"),
        DepositRequest.amount.label("amount"),
        cast(literal(0), DepositRequest.amount.type).label("fee"),
        DepositRequest.status.label("status"),
        _display_status(DepositRequest.status).label("display_status"),
        DepositRequest.tx_hash.label("tx_hash"),
        DepositRequest.network.label("network"),
        cast(null(), String).label("wallet_address"),
        DepositRequest.reject_reason.label("reject_reason"),
        literal("입금 요청").label("description"),
        DepositRequest.processed_at.label("processed_at"),
        DepositRequest.created_at.label("created_at"),
    )
    withdrawals = select(
        WithdrawalRequest.id,
        literal("WITHDRAW_REQ"),
        WithdrawalRequest.user_id,
        literal("WITHDRAW"),
        literal("OUT"),
        WithdrawalRequest.amount,
        WithdrawalRequest.fee,
        WithdrawalRequest.status,
        _display_status(WithdrawalRequest.status),
        WithdrawalRequest.tx_hash,
        WithdrawalRequest.network,
        WithdrawalRequest.wallet_address,
        WithdrawalRequest.rejected_reason,
        literal("외부 출금 요청"),
        WithdrawalRequest.processed_at,
        WithdrawalRequest.created_at,
    )
    return union_all(deposits, withdrawals).subquery("reqs")


def _apply_dates(stmt, col, start: str | None, end: str | None):
    s, e = day_range(start, end)
    if s:
        stmt = stmt.where(col >= s)
    if e:
        stmt = stmt.where(col < e)
    return stmt


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _page(items: list, total: int, page: int, size: int) -> dict:
    return {"items": items, "total": total, "page": page, "size": size, "pages": math.ceil(total / size) if size else 0}


# ── 웹: 내 거래 내역 ────────────────────────────────────────


async def list_my_transactions(
    session: AsyncSession,
    user: User,
    *,
    category: str | None,
    status: str | None,
    start_date: str | None,
    end_date: str | None,
    page: int,
    size: int,
) -> dict:
    r = _requests_union()
    stmt = select(r).where(r.c.user_id == user.id)
    if category and category.upper() in ("DEPOSIT", "WITHDRAW"):
        stmt = stmt.where(r.c.tx_type == category.upper())
    if status and status in ("Pending", "Completed", "Failed"):
        stmt = stmt.where(r.c.display_status == status)
    stmt = _apply_dates(stmt, r.c.created_at, start_date, end_date)

    total = await session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = (await session.execute(stmt.order_by(r.c.created_at.desc(), r.c.id.desc()).offset((page - 1) * size).limit(size))).all()

    items = []
    for row in rows:
        is_in = row.direction == "IN"
        items.append(
            {
                "id": row.id,
                "date": _iso(row.created_at),
                "wallet_type": "INTEGRATED",
                "tx_type": row.tx_type,
                "label": EXTERNAL_WALLET,
                "display_tx_type": EXTERNAL_WALLET,
                "direction": row.direction,
                "reference_type": "deposit_request" if is_in else "withdrawal_request",
                "deposit": as_float(row.amount) if is_in else None,
                "withdraw": None if is_in else as_float(row.amount),
                "fee": None if is_in else as_float(row.fee),
                "address": row.wallet_address,
                "network": row.network,
                "txid": row.tx_hash,
                "status": row.status,
                "display_status": row.display_status,
                "description": row.description,
                "balance_after": None,
                "reject_reason": row.reject_reason,
            }
        )
    return _page(items, total, page, size)


# ── 백오피스: 승인 대기 / 처리 이력 / 요약 ──────────────────


def _admin_query(keyword: str | None, display_tx_type: str | None, start_date: str | None, end_date: str | None):
    r = _requests_union()
    nickname = func.trim(func.concat(func.coalesce(User.first_name, ""), " ", func.coalesce(User.last_name, "")))
    stmt = select(
        r,
        User.email.label("user_email"),
        User.uid.label("user_uid"),
        nickname.label("user_nickname"),
    ).join(User, User.id == r.c.user_id)
    if keyword and keyword.strip():
        kw = f"%{keyword.strip()}%"
        stmt = stmt.where(
            or_(User.email.ilike(kw), nickname.ilike(kw), User.uid.ilike(kw), r.c.tx_hash.ilike(kw), r.c.wallet_address.ilike(kw))
        )
    # 지금은 External Wallet(입금·출금)만 있다. Payout 등은 해당 기능을 옮길 때 합친다.
    if display_tx_type and display_tx_type.lower() != "all" and display_tx_type != EXTERNAL_WALLET:
        stmt = stmt.where(literal(False))
    stmt = _apply_dates(stmt, r.c.created_at, start_date, end_date)
    return stmt, r


def _admin_item(row) -> dict:
    return {
        "id": row.id,
        "source": row.source,
        "ref_id": row.id,
        "user_id": str(row.user_id),
        "user_uid": row.user_uid,
        "user_email": row.user_email,
        "user_nickname": row.user_nickname or row.user_email.split("@")[0],
        "display_tx_type": EXTERNAL_WALLET,
        "tx_type": row.tx_type,
        "direction": row.direction,
        "amount": as_float(row.amount),
        "balance_after": None,
        "source_account": None,
        "status": row.status,
        "display_status": row.display_status,
        "wallet_type": "INTEGRATED",
        "tx_hash": row.tx_hash,
        "network": row.network,
        "wallet_address": row.wallet_address,
        "description": row.description,
        "reject_reason": row.reject_reason,
        "fee": as_float(row.fee),
        "processed_at": _iso(row.processed_at),
        "created_at": _iso(row.created_at),
    }


async def list_admin_requests(
    session: AsyncSession,
    *,
    pending: bool,
    keyword: str | None,
    display_tx_type: str | None,
    display_status: str | None,
    direction: str | None,
    start_date: str | None,
    end_date: str | None,
    page: int,
    size: int,
) -> dict:
    stmt, r = _admin_query(keyword, display_tx_type, start_date, end_date)
    if pending:
        stmt = stmt.where(r.c.display_status == "Pending")
        order = (r.c.created_at.asc(), r.c.id.asc())  # 오래된 요청부터 처리
    else:
        stmt = stmt.where(r.c.display_status != "Pending")
        if display_status and display_status in ("Completed", "Failed"):
            stmt = stmt.where(r.c.display_status == display_status)
        if direction and direction.upper() in ("IN", "OUT"):
            stmt = stmt.where(r.c.direction == direction.upper())
        order = (r.c.created_at.desc(), r.c.id.desc())

    total = await session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = (await session.execute(stmt.order_by(*order).offset((page - 1) * size).limit(size))).all()
    return _page([_admin_item(row) for row in rows], total, page, size)


async def admin_summary(
    session: AsyncSession,
    *,
    keyword: str | None,
    display_tx_type: str | None,
    start_date: str | None,
    end_date: str | None,
) -> dict:
    stmt, r = _admin_query(keyword, display_tx_type, start_date, end_date)
    sub = stmt.subquery()
    is_pending = sub.c.display_status == "Pending"
    row = (
        await session.execute(
            select(
                func.count().filter(is_pending),
                func.count().filter(~is_pending),
                func.count().filter(is_pending, sub.c.tx_type == "DEPOSIT"),
                func.count().filter(is_pending, sub.c.tx_type == "WITHDRAW"),
            ).select_from(sub)
        )
    ).one()
    return {
        "pending_count": row[0],
        "history_count": row[1],
        "deposit_pending_count": row[2],
        "withdraw_pending_count": row[3],
    }


async def admin_totals(
    session: AsyncSession,
    *,
    keyword: str | None,
    display_tx_type: str | None,
    start_date: str | None,
    end_date: str | None,
) -> dict:
    """'입출금 내역' 상단 카드: 승인(APPROVED)된 입금·출금 금액 합계.

    별도 합계 테이블 없이 요청 테이블에서 바로 더한다. 검색 조건(검색어·유형·기간)은 목록과 같게 적용하고,
    상태 필터는 적용하지 않는다(카드는 항상 승인 완료 금액). 출금 금액은 수수료를 포함한 신청 금액이다.
    (status, created_at) include (amount) 인덱스로 회원 검색어가 없으면 테이블을 읽지 않고 합산한다.
    """
    zero = {"total_deposit_amount": 0.0, "total_withdraw_amount": 0.0}
    # 지금은 External Wallet(입금·출금)만 있다. Payout 등은 해당 기능을 옮길 때 합친다.
    if display_tx_type and display_tx_type.lower() != "all" and display_tx_type != EXTERNAL_WALLET:
        return zero

    kw = f"%{keyword.strip()}%" if keyword and keyword.strip() else None
    nickname = func.trim(func.concat(func.coalesce(User.first_name, ""), " ", func.coalesce(User.last_name, "")))

    async def _sum(model, address_col) -> float:
        stmt = select(func.coalesce(func.sum(model.amount), 0)).where(model.status == "APPROVED")
        if kw:
            conds = [User.email.ilike(kw), nickname.ilike(kw), User.uid.ilike(kw), model.tx_hash.ilike(kw)]
            if address_col is not None:
                conds.append(address_col.ilike(kw))
            stmt = stmt.join(User, User.id == model.user_id).where(or_(*conds))
        stmt = _apply_dates(stmt, model.created_at, start_date, end_date)
        return as_float(await session.scalar(stmt))

    return {
        "total_deposit_amount": await _sum(DepositRequest, None),
        "total_withdraw_amount": await _sum(WithdrawalRequest, WithdrawalRequest.wallet_address),
    }
