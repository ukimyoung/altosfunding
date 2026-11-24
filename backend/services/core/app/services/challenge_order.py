"""챌린지 티켓 구매 (주문·결제·계좌 발급 결과 반영·환불).

- 결제(purchase): Core API 요청 안에서 끝난다. 지갑 차감·주문·발급 대기 계좌·작업 큐 등록을 한 트랜잭션으로 하고 바로 응답한다.
  MT4 호출은 하지 않는다. 계좌 발급은 Worker 작업(app.jobs.mt4)이 한다.
- 발급 완료(mark_issued)·자동 환불(refund_account): Worker 작업이 부른다.

분개 (마이그레이션 20261118040000_core_challenge_orders.sql 머리말 참고)
- 결제:      차) LIABILITY:USER_WALLET   / 대) LIABILITY:ORDER_PENDING
- 발급 완료:  차) LIABILITY:ORDER_PENDING / 대) REVENUE:CHALLENGE_SALES   (계좌 1개 단가)
- 발급 실패:  차) LIABILITY:ORDER_PENDING / 대) LIABILITY:USER_WALLET     (역분개, 지갑으로 되돌림)

쿠폰은 아직 없다. 주문에 coupon_code·discount_amount 자리만 있고, 결제 요청에 쿠폰을 넣으면 거절한다.
"""

import logging
import uuid
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.errors import AppError
from app.models import Challenge, ChallengeOrder, Mt4AccountIssuedHistory, Product, TradingAccount, User
from app.security import generate_human_code
from app.services import ib_commission, jobs, mt4, reward_admin
from app.services.wallet import USER_WALLET, Line, _change_balance, _post_journal, get_wallet

logger = logging.getLogger(__name__)

ORDER_PENDING = "LIABILITY:ORDER_PENDING"
CHALLENGE_SALES = "REVENUE:CHALLENGE_SALES"

MAX_QUANTITY = 10

# 주문 상태
PENDING, COMPLETED, REFUNDED, FAILED = "PENDING", "COMPLETED", "REFUNDED", "FAILED"
# 계좌 발급 상태
QUEUED, DONE = "QUEUED", "DONE"

PROVISION_JOB = "mt4.provision_challenge_account"
READ_ONLY_JOB = "mt4.set_read_only"
# 전량 청산 + 읽기 전용 (룰 위반·대회 종료·펀디드 하루 정지)
CLOSE_ALL_JOB = "mt4.close_all_and_lock"
ISSUED_MAIL_JOB = "notify.challenge_account_issued"
# 룰 위반으로 FAILED 처리 안내 (account_violated), 챌린지 최종 결과 안내 (challenge_passed / challenge_failed)
VIOLATION_MAIL_JOB = "notify.account_violated"
RESULT_MAIL_JOB = "notify.challenge_result"
# 30초부터 두 배씩 기다리며 8번 → 처음 시도부터 약 1시간 동안 재시도한 뒤 환불한다.
PROVISION_MAX_ATTEMPTS = 8

# 거래할 수 있는 계좌 상태. 이 밖의 상태는 MT4에서 읽기 전용(ReadOnly)으로 잠근다.
TRADABLE_STATUSES = ("ACTIVE", "IN_PROGRESS")


def _now() -> datetime:
    return datetime.now(UTC)


def unit_price_of(product: Product) -> Decimal:
    return product.discount_price_usdt if product.discount_price_usdt is not None else product.price_usdt


async def _new_order_id(session: AsyncSession, now: datetime) -> str:
    for _ in range(10):
        order_id = f"ORD-{now:%Y%m%d}-{generate_human_code(4)}"
        if await session.get(ChallengeOrder, order_id) is None:
            return order_id
    raise AppError(500, "id_generation_failed", "주문 번호를 만들지 못했습니다.")


# ── 결제 ────────────────────────────────────────────────────


async def purchase(
    session: AsyncSession, user: User, challenge_id: str, quantity: int, coupon_code: str | None = None
) -> ChallengeOrder:
    """모집 중인 대회에 참가 신청하고 통합 지갑으로 결제한다. 커밋까지 한다."""
    if coupon_code and coupon_code.strip():
        raise AppError(400, "coupon_not_supported", "쿠폰은 아직 사용할 수 없습니다.")
    if not 1 <= quantity <= MAX_QUANTITY:
        raise AppError(422, "invalid_quantity", f"한 번에 1~{MAX_QUANTITY}개까지 구매할 수 있습니다.")

    now = _now()
    challenge = await session.get(Challenge, challenge_id, with_for_update=True)
    if challenge is None:
        raise AppError(404, "challenge_not_found", "challenge not found")
    if challenge.status != "PENDING":
        raise AppError(400, "challenge_not_open", "모집 중인 대회가 아닙니다.")
    if challenge.start_at <= now:
        raise AppError(400, "challenge_already_started", "이미 시작된 대회입니다.")
    product = await session.get(Product, challenge.product_id)
    if product is None or not product.is_active or product.tier_type != "CHALLENGE":
        raise AppError(400, "product_not_available", "판매 중인 상품이 아닙니다.")
    if challenge.group_size is not None and challenge.current_participants + quantity > challenge.group_size:
        remaining = max(challenge.group_size - challenge.current_participants, 0)
        raise AppError(409, "challenge_full", f"대회 정원이 부족합니다 (남은 자리 {remaining}개).")

    unit = unit_price_of(product)
    total = unit * quantity
    original_total = product.price_usdt * quantity
    # IB 커미션: 결제 시각 기준 경로·비율로 미리 계산하고, 구매자·IB 지갑을 정해진 순서로 잠근다.
    commission = await ib_commission.plan(session, user.id, total, now)
    await ib_commission.lock_wallets(session, [user.id, *(commission.payee_ids if commission else [])])
    wallet = await get_wallet(session, user.id, lock=True)
    if wallet.balance_usdt < total:
        raise AppError(400, "insufficient_balance", f"Total Asset 잔고가 부족합니다 (필요 금액: {total} USDT).")

    order = ChallengeOrder(
        id=await _new_order_id(session, now),
        user_id=user.id,
        challenge_id=challenge.challenge_id,
        product_id=product.product_id,
        product_name=product.name,
        type_code=product.type_code,
        quantity=quantity,
        original_unit_price=product.price_usdt,
        unit_price=unit,
        original_price=original_total,
        discount_amount=max(original_total - total, Decimal(0)),
        total_price=total,
        status=PENDING,
    )
    session.add(order)
    await session.flush()

    if total > 0:
        journal = await _post_journal(
            session,
            entry_type="CHALLENGE_PURCHASE",
            description=f"챌린지 구매 — {product.name} × {quantity} ({total} USDT)",
            lines=[Line(USER_WALLET, debit=total, user_id=user.id), Line(ORDER_PENDING, credit=total)],
            reference_type="challenge_order",
            reference_id=order.id,
            created_by=user.id,
        )
        tx = await _change_balance(
            session, wallet, tx_type="CHALLENGE_PURCHASE", direction="OUT", amount=total,
            description=f"챌린지 구매 {product.name} × {quantity} (주문 {order.id})", journal=journal,
            reference_type="challenge_order", reference_id=order.id,
        )
        order.wallet_tx_id, order.journal_entry_id = tx.id, journal.id
    if commission is not None:
        await ib_commission.apply(session, commission, order)

    challenge.current_participants += quantity
    server = mt4.SERVER_OF_TIER[product.tier_type]
    accounts = [
        TradingAccount(
            user_id=user.id,
            product_id=product.product_id,
            challenge_id=challenge.challenge_id,
            order_id=order.id,
            tier=product.tier_type,
            mt4_server=server,
            mt4_group=product.mt4_group,
            leverage=product.leverage,
            capital=product.capital,
            type_code=product.type_code,
            unit_price=unit,
            status="PENDING",
            is_read_only=True,
            provision_status=QUEUED,
            start_at=challenge.start_at,
            end_at=challenge.end_at,
        )
        for _ in range(quantity)
    ]
    session.add_all(accounts)
    await session.flush()
    for account in accounts:
        await jobs.enqueue(
            session, PROVISION_JOB, {"account_id": str(account.id)},
            max_attempts=PROVISION_MAX_ATTEMPTS, dedupe_key=f"provision:{account.id}",
            ref_type="trading_account", ref_id=str(account.id), priority=10,
        )
    await session.commit()
    return order


# ── 발급 결과 ───────────────────────────────────────────────


def _finish_if_done(order: ChallengeOrder, now: datetime) -> None:
    if order.issued_quantity + order.refunded_quantity < order.quantity:
        return
    order.status = COMPLETED if order.issued_quantity > 0 else REFUNDED
    order.completed_at = now


def should_be_read_only(account: TradingAccount, now: datetime | None = None) -> bool:
    """MT4에서 읽기 전용이어야 하는가: 거래 가능 상태가 아니거나, 펀디드 하루 정지(trading_halted_until) 중."""
    if account.status not in TRADABLE_STATUSES:
        return True
    halted = account.trading_halted_until
    return halted is not None and halted > (now or _now())


async def enqueue_close_all(session: AsyncSession, account: TradingAccount, reason: str) -> None:
    """미결 포지션·대기 주문을 모두 청산하고 읽기 전용으로 잠그는 작업 (Worker가 MT4 호출)."""
    await jobs.enqueue(
        session, CLOSE_ALL_JOB, {"account_id": str(account.id), "reason": reason[:200]},
        dedupe_key=f"closeall:{account.id}", ref_type="trading_account", ref_id=str(account.id), priority=8,
        max_attempts=8,
    )


async def enqueue_read_only(session: AsyncSession, account: TradingAccount, read_only: bool) -> None:
    await jobs.enqueue(
        session, READ_ONLY_JOB, {"account_id": str(account.id), "read_only": read_only},
        dedupe_key=f"readonly:{account.id}:{int(read_only)}",
        ref_type="trading_account", ref_id=str(account.id), priority=5,
    )


async def mark_issued(session: AsyncSession, account: TradingAccount) -> None:
    """MT4 계좌 생성·자본금 입금이 끝난 계좌를 발급 완료로 바꾼다 (Worker 작업 안에서)."""
    now = _now()
    if account.challenge_id is None:
        # 데모 계좌: 대회 없이 바로 거래한다 (MT4에도 읽기 전용이 아닌 상태로 만든다). 발급 메일은 보내지 않는다.
        account.provision_status, account.issued_at, account.provision_error = DONE, now, None
        account.status = "ACTIVE"
        return
    # 대회 시작 처리와 겹치지 않게 대회 행을 잠근다 (시작 처리는 FOR UPDATE).
    challenge = await session.scalar(
        select(Challenge).where(Challenge.challenge_id == account.challenge_id).with_for_update(read=True)
    )
    order = await session.get(ChallengeOrder, account.order_id, with_for_update=True)
    account.provision_status, account.issued_at, account.provision_error = DONE, now, None
    if challenge is not None and challenge.status == "ACTIVE":
        # 발급이 늦어 그 사이 대회가 시작됐으면 바로 거래를 풀어 준다.
        account.status = "ACTIVE"
        await enqueue_read_only(session, account, False)
    elif challenge is not None and challenge.status in ("CLOSED", "CANCELLED"):
        account.status = "CLOSED"
    else:
        account.status = "PENDING"

    if order is not None:
        if account.unit_price > 0:
            await _post_journal(
                session,
                entry_type="CHALLENGE_ACCOUNT_ISSUED",
                description=f"챌린지 계좌 발급 — MT4 {account.mt4_login} ({account.unit_price} USDT)",
                lines=[Line(ORDER_PENDING, debit=account.unit_price), Line(CHALLENGE_SALES, credit=account.unit_price)],
                reference_type="challenge_order",
                reference_id=order.id,
            )
        order.issued_quantity += 1
        _finish_if_done(order, now)
        await reward_admin.on_order_completed(session, order)
    await jobs.enqueue(
        session, ISSUED_MAIL_JOB, {"account_id": str(account.id)},
        dedupe_key=f"mail:account_issued:{account.id}", ref_type="trading_account", ref_id=str(account.id),
    )


async def refund_account(session: AsyncSession, account: TradingAccount, reason: str) -> bool:
    """발급하지 못한 계좌 1개를 환불한다. 이미 끝난 계좌면 아무것도 하지 않고 False."""
    if account.provision_status != QUEUED:
        return False
    now = _now()
    order = await session.get(ChallengeOrder, account.order_id, with_for_update=True) if account.order_id else None
    account.provision_status, account.status = "FAILED", "CANCELLED"
    account.provision_error = reason[:2000]

    if account.mt4_login is not None:
        row = await session.get(Mt4AccountIssuedHistory, (account.mt4_server, account.mt4_login), with_for_update=True)
        maybe_created = account.mt4_created_at is not None or account.mt4_create_attempted_at is not None
        if row is not None:
            if maybe_created:
                row.status, row.reason = "ORPHANED", f"발급 실패로 정리 필요: {reason[:200]}"
            elif row.status == "RESERVED":
                row.status, row.reason = "BLACKLISTED", "발급 실패로 쓰지 않은 번호"

    if order is not None:
        if account.unit_price > 0:
            wallet = await get_wallet(session, account.user_id, lock=True)
            journal = await _post_journal(
                session,
                entry_type="CHALLENGE_REFUND",
                description=f"챌린지 계좌 발급 실패 환불 — {account.unit_price} USDT",
                lines=[
                    Line(ORDER_PENDING, debit=account.unit_price),
                    Line(USER_WALLET, credit=account.unit_price, user_id=account.user_id),
                ],
                reference_type="challenge_order",
                reference_id=order.id,
                reversed_entry_id=order.journal_entry_id,
            )
            tx = await _change_balance(
                session, wallet, tx_type="CHALLENGE_REFUND", direction="IN", amount=account.unit_price,
                description=f"챌린지 계좌 발급 실패 환불 (주문 {order.id})", journal=journal,
                reference_type="challenge_order", reference_id=order.id,
            )
            account.refund_wallet_tx_id = tx.id
            await ib_commission.refund(session, order, account.unit_price, f"trading_account:{account.id}")
        order.refunded_quantity += 1
        order.refunded_amount += account.unit_price
        _finish_if_done(order, now)
        await reward_admin.on_order_completed(session, order)
    if account.challenge_id:
        await session.execute(
            update(Challenge)
            .where(Challenge.challenge_id == account.challenge_id)
            .values(current_participants=func.greatest(Challenge.current_participants - 1, 0))
        )
    logger.warning("챌린지 계좌 발급 실패 → 환불: account=%s order=%s (%s)", account.id, account.order_id, reason[:200])
    return True


# ── 대회 상태 변경 → 계좌 ──────────────────────────────────


async def on_challenge_status_changed(session: AsyncSession, challenge: Challenge) -> int:
    """대회가 시작되면 발급된 계좌의 거래를 풀고, 끝나거나 취소되면 잠근다. 바꾼 계좌 수를 돌려준다.

    MT4 호출은 작업 큐에 넣어 Worker가 한다. 아직 발급 중인 계좌는 발급이 끝날 때 대회 상태를 보고 맞춘다.
    """
    if challenge.status == "ACTIVE":
        from_statuses, to_status, read_only = ("PENDING",), "ACTIVE", False
    elif challenge.status in ("CLOSED", "CANCELLED"):
        from_statuses, to_status, read_only = ("PENDING", *TRADABLE_STATUSES), "CLOSED", True
    else:
        return 0
    accounts = list(
        await session.scalars(
            select(TradingAccount)
            .where(
                TradingAccount.challenge_id == challenge.challenge_id,
                TradingAccount.provision_status == DONE,
                TradingAccount.status.in_(from_statuses),
            )
            .with_for_update()
        )
    )
    for account in accounts:
        was_tradable = account.status in TRADABLE_STATUSES
        account.status = to_status
        if read_only and was_tradable and settings.risk_enforce:
            # 대회 종료·취소: 남은 포지션을 모두 청산하고 잠근다 (최종 판정은 종료 10분 뒤 Worker가 한다).
            await enqueue_close_all(session, account, f"challenge {challenge.status.lower()}")
        elif account.is_read_only != read_only:
            await enqueue_read_only(session, account, read_only)
    return len(accounts)


# ── 조회 ────────────────────────────────────────────────────


async def get_my_order(session: AsyncSession, user: User, order_id: str) -> ChallengeOrder:
    order = await session.get(ChallengeOrder, order_id)
    if order is None or order.user_id != user.id:
        raise AppError(404, "order_not_found", "주문을 찾을 수 없습니다.")
    return order


async def order_accounts(session: AsyncSession, order_ids: list[str]) -> dict[str, list[TradingAccount]]:
    if not order_ids:
        return {}
    rows = await session.scalars(
        select(TradingAccount)
        .where(TradingAccount.order_id.in_(order_ids))
        .order_by(TradingAccount.created_at, TradingAccount.mt4_login.asc().nulls_last(), TradingAccount.id)
    )
    result: dict[str, list[TradingAccount]] = {}
    for account in rows:
        result.setdefault(account.order_id, []).append(account)
    return result


def new_uuid(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except ValueError as exc:
        raise AppError(404, "account_not_found", "계좌를 찾을 수 없습니다.") from exc
