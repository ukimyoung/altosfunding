"""관리자 트레이딩 계좌 조회 (백오피스 트레이더 관리 > 계좌 관리).

챌린지·펀디드·데모·라이브 계좌를 tier로 나눠 본다. 발급 실패(환불) 계좌는 목록에서 뺀다
(전체구매/결제이력의 주문 상세에서 볼 수 있다).

잔고·평가금액·수익과 거래내역은 MT4 데이터 수집 기능이 들어오기 전까지
잔고 = 자본금, 수익 = 0, 거래내역 = 빈 목록으로 보여 준다.
"""

import uuid

from sqlalchemy import Select, String, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import AppError
from app.models import (
    Challenge,
    Product,
    TradingAccount,
    TradingAccountStatusHistory,
    User,
)
from app.services import challenge_order as orders
from app.services import mt4
from app.services import trading_query as q
from app.services.wallet import day_range

TIERS = ("CHALLENGE", "FUNDED", "DEMO", "LIVE")


def _name(user: User) -> str | None:
    return " ".join(p.strip() for p in (user.first_name, user.last_name) if p and p.strip()) or None


def admin_account_out(a: TradingAccount, product: Product | None, challenge: Challenge | None, user: User) -> dict:
    # 비밀번호는 발급이 끝난 계좌면 대회 시작 전에도 들어 있다 (account_out 참고).
    out = q.account_out(a, product, challenge, user)
    return {
        **out,
        "leverage": a.leverage,
        "session_id": a.challenge_id,
        "session_name": challenge.name if challenge else None,
        "start_at": a.start_at,
        "end_at": a.end_at,
        "challenge_mt4_login": a.mt4_login,
        "user_name": _name(user),
        "user_uid": user.uid,
        "user_grade": user.grade,
        "provision_error": a.provision_error,
        "issued_at": a.issued_at,
    }


# 사유를 보여 주는 상태 (관리자 조치)
REASON_STATUSES = ("INACTIVE", "BANNED")


def _with_reason(out: dict, a: TradingAccount, reasons: dict) -> dict:
    out["reason"] = reasons.get(a.id)
    return out


def _tier(value: str | None) -> str | None:
    if not value or value.upper() == "ALL":
        return None
    tier = value.upper()
    if tier not in TIERS:
        raise AppError(400, "invalid_tier", "tier는 CHALLENGE, FUNDED, DEMO, LIVE 중 하나입니다.")
    return tier


def _base() -> Select:
    return (
        select(TradingAccount, Product, Challenge, User)
        .join(Product, Product.product_id == TradingAccount.product_id)
        .join(User, User.id == TradingAccount.user_id)
        .outerjoin(Challenge, Challenge.challenge_id == TradingAccount.challenge_id)
        .where(TradingAccount.provision_status != "FAILED")
    )


async def list_accounts(
    session: AsyncSession, *, tier: str | None, status: str | None, user_id: str | None, keyword: str | None,
    type_code: str | None, start_date: str | None, end_date: str | None, page: int, size: int,
) -> tuple[list[dict], int]:
    query = _base()
    if t := _tier(tier):
        query = query.where(TradingAccount.tier == t)
    if status and status.upper() != "ALL":
        query = query.where(TradingAccount.status == status.upper())
    if user_id:
        try:
            query = query.where(TradingAccount.user_id == uuid.UUID(user_id))
        except ValueError as exc:
            raise AppError(400, "invalid_user_id", "회원 ID 형식이 올바르지 않습니다.") from exc
    if type_code and type_code.strip() and type_code.upper() != "ALL":
        # 상품코드(4자리) 또는 상품의 type_code
        query = query.where(or_(TradingAccount.product_id == type_code, TradingAccount.type_code == type_code))
    if keyword and keyword.strip():
        kw = f"%{keyword.strip()}%"
        query = query.where(
            or_(
                cast(TradingAccount.mt4_login, String).ilike(kw),
                func.concat(User.first_name, " ", User.last_name).ilike(kw),
                User.email.ilike(kw),
                User.uid.ilike(kw),
            )
        )
    # 기간: 계좌 생성일 기준 (한국 시간, 기존 서버와 같음)
    start, end = day_range(start_date, end_date)
    if start:
        query = query.where(TradingAccount.created_at >= start)
    if end:
        query = query.where(TradingAccount.created_at < end)

    total = await session.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = await session.execute(
        query.order_by(TradingAccount.created_at.desc(), TradingAccount.id).offset((page - 1) * size).limit(size)
    )
    rows = rows.tuples().all()
    reasons = await latest_reasons(session, [a.id for a, *_ in rows if a.status in REASON_STATUSES])
    return [_with_reason(admin_account_out(a, p, c, u), a, reasons) for a, p, c, u in rows], total


async def get_account(session: AsyncSession, identifier: str) -> dict:
    """계좌 UUID 또는 MT4 번호로 찾는다. 같은 번호가 여러 서버에 있으면 가장 최근 계좌."""
    value = identifier.strip()
    query = _base()
    try:
        query = query.where(TradingAccount.id == uuid.UUID(value))
    except ValueError:
        if not value.isdigit():
            raise AppError(404, "account_not_found", "계좌를 찾을 수 없습니다.") from None
        query = query.where(TradingAccount.mt4_login == int(value))
    row = (await session.execute(query.order_by(TradingAccount.created_at.desc()).limit(1))).first()
    if row is None:
        raise AppError(404, "account_not_found", "계좌를 찾을 수 없습니다.")
    a = row[0]
    reasons = await latest_reasons(session, [a.id]) if a.status in REASON_STATUSES else {}
    return _with_reason(admin_account_out(*row), a, reasons)


async def account_stats(session: AsyncSession, tier: str | None) -> dict:
    t = _tier(tier)
    query = select(
        func.count(),
        # 진행중 = 대회가 시작돼 거래 중인 계좌 (Core는 ACTIVE만 쓴다)
        func.count().filter(TradingAccount.status == "ACTIVE"),
        func.coalesce(func.sum(TradingAccount.capital), 0),
    ).where(TradingAccount.provision_status != "FAILED")
    if t:
        query = query.where(TradingAccount.tier == t)
    total, active, capital = (await session.execute(query)).one()
    return {
        "tier": t or "ALL",
        "total_accounts": total or 0,
        "in_progress_accounts": active or 0,
        "total_capital": q._f(capital),
    }


# ── 상태 변경: 비활성 · 활성 복귀 · 영구정지 ─────────────────
#
# 모든 tier 같은 규칙 (기존 서버와 같음):
#   비활성(FREEZE)    PENDING·ACTIVE → INACTIVE, 미결 포지션이 있으면 거절
#   활성 복귀(UNFREEZE) INACTIVE → 원래 상태 (대회 진행 중이면 ACTIVE, 시작 전이면 PENDING, 끝났으면 CLOSED, 데모는 ACTIVE)
#   영구정지(BAN)     BANNED·CANCELLED가 아니면 → BANNED, 사유 필수, 미결 포지션이 있으면 거절. 되돌릴 수 없다.
# DB 상태를 먼저 바꾸고, MT4 거래 잠금(ReadOnly)은 Worker 작업(mt4.set_read_only)이 맞춘다 (재시도 포함).
# 미결 포지션 확인만 요청 안에서 MT4를 바로 조회한다 (읽기 전용).

FREEZABLE = ("PENDING", "ACTIVE", "IN_PROGRESS")
NOT_BANNABLE = ("BANNED", "CANCELLED")


async def _lock_account(session: AsyncSession, identifier: str) -> TradingAccount:
    out = await get_account(session, identifier)
    account = await session.get(
        TradingAccount, uuid.UUID(out["account_id"]), with_for_update=True, populate_existing=True
    )
    if account is None:
        raise AppError(404, "account_not_found", "계좌를 찾을 수 없습니다.")
    return account


def _require_issued(account: TradingAccount) -> None:
    if account.provision_status != orders.DONE or account.mt4_login is None:
        raise AppError(400, "account_not_issued", "아직 MT4 계좌 발급이 끝나지 않은 계좌입니다.")


async def _assert_no_open_positions(account: TradingAccount) -> None:
    try:
        positions = await mt4.client_for(account.mt4_server).open_orders(account.mt4_login)
    except mt4.Mt4Error as exc:
        raise AppError(400, "mts_error", f"보유 포지션 조회 실패: {exc}") from exc
    if positions:
        raise AppError(
            400,
            "open_positions_exist",
            f"계좌에 진행 중인 포지션이 {len(positions)}개 있습니다. "
            "상태를 변경하려면 MTS 관리자 페이지에서 포지션을 모두 청산한 뒤 다시 시도하세요."
        )


async def _natural_status(session: AsyncSession, account: TradingAccount) -> str:
    """관리자 조치가 없었다면 지금 있어야 할 상태."""
    if not account.challenge_id:
        return "ACTIVE"
    challenge = await session.get(Challenge, account.challenge_id)
    if challenge is None or challenge.status in ("CLOSED", "CANCELLED"):
        return "CLOSED"
    return "ACTIVE" if challenge.status == "ACTIVE" else "PENDING"


async def _change(
    session: AsyncSession, account: TradingAccount, admin: User, action: str, to_status: str, reason: str | None
) -> None:
    session.add(
        TradingAccountStatusHistory(
            account_id=account.id, action=action, from_status=account.status, to_status=to_status,
            reason=(reason or "").strip() or None, changed_by=admin.id,
        )
    )
    account.status = to_status
    # 거래 가능 여부가 바뀌면 MT4 ReadOnly를 맞춘다. 작업은 실행 시점의 계좌 상태를 다시 보고 처리한다.
    read_only = to_status not in orders.TRADABLE_STATUSES
    await orders.enqueue_read_only(session, account, read_only)
    await session.flush()


def _invalid_status(account: TradingAccount, message: str) -> AppError:
    return AppError(400, "invalid_status", message)


async def freeze(session: AsyncSession, admin: User, identifier: str, reason: str | None = None) -> None:
    account = await _lock_account(session, identifier)
    _require_issued(account)
    if account.status not in FREEZABLE:
        raise _invalid_status(account, f"비활성 처리할 수 없는 상태입니다 ({account.status}).")
    await _assert_no_open_positions(account)
    await _change(session, account, admin, "FREEZE", "INACTIVE", reason)


async def unfreeze(session: AsyncSession, admin: User, identifier: str) -> str:
    account = await _lock_account(session, identifier)
    _require_issued(account)
    if account.status == "BANNED":
        raise _invalid_status(account, "영구정지된 계좌는 활성 복귀할 수 없습니다.")
    if account.status != "INACTIVE":
        raise _invalid_status(account, f"비활성 계좌만 활성 복귀할 수 있습니다 ({account.status}).")
    to_status = await _natural_status(session, account)
    await _change(session, account, admin, "UNFREEZE", to_status, None)
    return to_status


async def ban(session: AsyncSession, admin: User, identifier: str, reason: str) -> None:
    if not reason or not reason.strip():
        raise AppError(400, "reason_required", "영구정지 사유를 입력해주세요.")
    account = await _lock_account(session, identifier)
    _require_issued(account)
    if account.status in NOT_BANNABLE:
        raise _invalid_status(account, f"영구정지할 수 없는 상태입니다 ({account.status}).")
    await _assert_no_open_positions(account)
    await _change(session, account, admin, "BAN", "BANNED", reason)


async def latest_reasons(session: AsyncSession, account_ids: list[uuid.UUID]) -> dict[uuid.UUID, str | None]:
    if not account_ids:
        return {}
    rows = await session.execute(
        select(TradingAccountStatusHistory.account_id, TradingAccountStatusHistory.reason)
        .where(TradingAccountStatusHistory.account_id.in_(account_ids))
        .distinct(TradingAccountStatusHistory.account_id)
        .order_by(TradingAccountStatusHistory.account_id, TradingAccountStatusHistory.created_at.desc(),
                  TradingAccountStatusHistory.id.desc())
    )
    return dict(rows.tuples().all())
