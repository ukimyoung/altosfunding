"""지갑(Total Asset)·복식부기 원장·입출금 요청.

기존 서버(wallet/service.py)와 같은 흐름이다.
- 입금: 회원이 USDT를 회사 주소로 보내고 TX hash를 입력 → PENDING → 관리자 승인 시 지갑 잔고 증가 / 반려
- 출금: 회원 신청 시 지갑에서 바로 차감(묶음) → REQUESTED → 관리자가 송금 후 TX hash 입력해 승인 / 반려 시 되돌림

잔고를 바꾸는 함수는 모두 이 모듈에 있다. 잔고가 바뀔 때마다 wallet_transactions 1건과 분개(journal_entries + lines)를
같은 DB 트랜잭션에서 만든다. 분개 방향은 마이그레이션(20261116050000_core_wallet_ledger.sql) 머리말 참고.
"""

import re
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import AppError
from app.models import (
    DepositRequest,
    JournalEntry,
    JournalLine,
    PlatformConfig,
    User,
    Wallet,
    WalletTransaction,
    WithdrawalRequest,
)
from app.services import signup, two_factor

CENT = Decimal("0.01")
INTEGRATED = "INTEGRATED"

CASH = "ASSET:CASH"
USER_WALLET = "LIABILITY:USER_WALLET"
WITHDRAWAL_PENDING = "LIABILITY:WITHDRAWAL_PENDING"
WITHDRAWAL_FEE = "REVENUE:WITHDRAWAL_FEE"

# 날짜 필터(YYYYMMDD / YYYY-MM-DD)는 화면 표시와 같은 한국 시간 기준 하루로 본다.
KST = ZoneInfo("Asia/Seoul")

DEFAULT_MIN_DEPOSIT = Decimal("10")
DEFAULT_MIN_WITHDRAWAL = Decimal("10")


def _now() -> datetime:
    return datetime.now(UTC)


def money(value: object, label: str = "금액") -> Decimal:
    """USDT 금액을 Decimal로. 소수 셋째 자리 이하가 있으면 거절한다."""
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise AppError(422, "invalid_amount", f"{label}이 올바르지 않습니다.") from exc
    if not amount.is_finite() or amount <= 0:
        raise AppError(422, "invalid_amount", f"{label}은 0보다 커야 합니다.")
    if amount != amount.quantize(CENT):
        raise AppError(422, "invalid_amount", f"{label}은 소수점 둘째 자리까지 입력할 수 있습니다.")
    if amount >= Decimal("10000000000"):
        raise AppError(422, "invalid_amount", f"{label}이 너무 큽니다.")
    return amount


def as_float(value: Decimal | None) -> float | None:
    return None if value is None else float(value.quantize(CENT, ROUND_HALF_UP))


# ── 운영 설정 ───────────────────────────────────────────────


def normalize_network(name: str) -> str:
    """'TRC-20', 'trc20 ' → 'TRC20' (웹 화면과 같은 규칙)."""
    return re.sub(r"[\s-]", "", name or "").upper()


async def _config(session: AsyncSession, scope: str, key: str, default: object) -> object:
    value = await session.scalar(
        select(PlatformConfig.value).where(PlatformConfig.scope == scope, PlatformConfig.key == key)
    )
    return default if value is None else value


async def get_network_fees(session: AsyncSession) -> list[dict]:
    """PAYOUT.network_fees: [{name, desc, fee, is_active}]"""
    raw = await _config(session, "PAYOUT", "network_fees", [])
    if not isinstance(raw, list):
        return []
    items = []
    for item in raw:
        if not isinstance(item, dict) or not str(item.get("name") or "").strip():
            continue
        items.append(
            {
                "name": str(item["name"]).strip(),
                "desc": str(item.get("desc") or "").strip(),
                "fee": float(item.get("fee") or 0),
                "is_active": bool(item.get("is_active", True)),
            }
        )
    return items


async def find_active_network(session: AsyncSession, network: str) -> dict:
    key = normalize_network(network)
    for item in await get_network_fees(session):
        if item["is_active"] and normalize_network(item["name"]) == key:
            return item
    raise AppError(400, "unsupported_network", "지원하지 않거나 사용 중지된 네트워크입니다.")


async def _min_amount(session: AsyncSession, key: str, default: Decimal) -> Decimal:
    value = await _config(session, "WALLET", key, None)
    try:
        return Decimal(str(value)) if value is not None else default
    except InvalidOperation:
        return default


# ── 원장 공통 ───────────────────────────────────────────────


@dataclass
class Line:
    account: str
    debit: Decimal = Decimal(0)
    credit: Decimal = Decimal(0)
    user_id: uuid.UUID | None = None


async def _post_journal(
    session: AsyncSession,
    *,
    entry_type: str,
    description: str,
    lines: list[Line],
    reference_type: str,
    reference_id: int | str,
    created_by: uuid.UUID | None = None,
) -> JournalEntry:
    lines = [ln for ln in lines if ln.debit > 0 or ln.credit > 0]
    if len(lines) < 2:
        raise ValueError("분개는 2줄 이상이어야 합니다.")
    if sum(ln.debit for ln in lines) != sum(ln.credit for ln in lines):
        raise ValueError("차변 합계와 대변 합계가 다릅니다.")
    entry = JournalEntry(
        entry_type=entry_type,
        description=description,
        reference_type=reference_type,
        reference_id=str(reference_id),
        created_by=created_by,
    )
    session.add(entry)
    await session.flush()
    for ln in lines:
        session.add(
            JournalLine(
                journal_id=entry.id, account_code=ln.account, debit=ln.debit, credit=ln.credit, user_id=ln.user_id
            )
        )
    return entry


async def get_wallet(session: AsyncSession, user_id: uuid.UUID, *, lock: bool = False) -> Wallet:
    """회원의 통합 지갑. 없으면 만든다 (가입 시 만들지 않고 처음 쓸 때 만든다)."""
    stmt = select(Wallet).where(Wallet.user_id == user_id, Wallet.wallet_type == INTEGRATED)
    if lock:
        stmt = stmt.with_for_update()
    wallet = await session.scalar(stmt)
    if wallet is None:
        await session.execute(
            pg_insert(Wallet)
            .values(user_id=user_id, wallet_type=INTEGRATED)
            .on_conflict_do_nothing(index_elements=["user_id", "wallet_type"])
        )
        wallet = await session.scalar(stmt)
    assert wallet is not None
    return wallet


async def _change_balance(
    session: AsyncSession,
    wallet: Wallet,
    *,
    tx_type: str,
    direction: str,
    amount: Decimal,
    description: str,
    journal: JournalEntry,
    reference_type: str,
    reference_id: int,
    tx_hash: str | None = None,
) -> WalletTransaction:
    """잔고를 바꾸고 이력을 남긴다. wallet은 with_for_update로 잠근 상태여야 한다."""
    before = wallet.balance_usdt
    if direction == "IN":
        after = before + amount
    else:
        if before < amount:
            raise AppError(400, "insufficient_balance", "잔고가 부족합니다.")
        after = before - amount
    wallet.balance_usdt = after
    tx = WalletTransaction(
        wallet_id=wallet.id,
        tx_type=tx_type,
        direction=direction,
        amount=amount,
        balance_before=before,
        balance_after=after,
        tx_hash=tx_hash,
        reference_type=reference_type,
        reference_id=str(reference_id),
        journal_entry_id=journal.id,
        description=description,
    )
    session.add(tx)
    await session.flush()
    return tx


# ── 입금 ────────────────────────────────────────────────────


async def request_deposit(
    session: AsyncSession, user: User, amount: object, tx_hash: str, network: str | None
) -> DepositRequest:
    value = money(amount, "입금 금액")
    minimum = await _min_amount(session, "min_deposit_amount", DEFAULT_MIN_DEPOSIT)
    if value < minimum:
        raise AppError(400, "amount_below_minimum", f"최소 입금 금액은 {minimum:g} USDT입니다.")
    tx_hash = (tx_hash or "").strip()
    if not tx_hash:
        raise AppError(422, "tx_hash_required", "TxID(TX hash)를 입력해 주세요.")
    if len(tx_hash) > 200 or re.search(r"\s", tx_hash):
        raise AppError(422, "invalid_tx_hash", "TxID(TX hash) 형식이 올바르지 않습니다.")
    network_name = (await find_active_network(session, network))["name"] if network else None

    duplicate = await session.scalar(
        select(func.count()).where(
            func.lower(DepositRequest.tx_hash) == tx_hash.lower(), DepositRequest.status != "REJECTED"
        )
    )
    if duplicate:
        raise AppError(409, "duplicate_tx_hash", "이미 입금 요청된 TxID입니다.")

    req = DepositRequest(user_id=user.id, amount=value, tx_hash=tx_hash, network=network_name, status="PENDING")
    session.add(req)
    try:
        await session.commit()
    except IntegrityError as exc:  # 같은 hash로 동시에 요청한 경우
        await session.rollback()
        raise AppError(409, "duplicate_tx_hash", "이미 입금 요청된 TxID입니다.") from exc
    await session.refresh(req)
    return req


async def _lock_request(session: AsyncSession, model, request_id: int):
    req = await session.scalar(select(model).where(model.id == request_id).with_for_update())
    if req is None:
        raise AppError(404, "request_not_found", "요청을 찾을 수 없습니다.")
    return req


async def approve_deposit(session: AsyncSession, admin: User, request_id: int) -> DepositRequest:
    req: DepositRequest = await _lock_request(session, DepositRequest, request_id)
    if req.status != "PENDING":
        raise AppError(409, "invalid_status", f"이미 처리된 요청입니다 ({req.status}).")

    wallet = await get_wallet(session, req.user_id, lock=True)
    journal = await _post_journal(
        session,
        entry_type="DEPOSIT_APPROVED",
        description=f"입금 승인 — {req.amount} USDT ({req.network or '-'})",
        lines=[Line(CASH, debit=req.amount), Line(USER_WALLET, credit=req.amount, user_id=req.user_id)],
        reference_type="deposit_request",
        reference_id=req.id,
        created_by=admin.id,
    )
    tx = await _change_balance(
        session, wallet, tx_type="DEPOSIT", direction="IN", amount=req.amount,
        description=f"입금 승인 (요청 #{req.id})", journal=journal,
        reference_type="deposit_request", reference_id=req.id, tx_hash=req.tx_hash,
    )
    req.status = "APPROVED"
    req.processed_by = admin.id
    req.processed_at = _now()
    req.wallet_tx_id = tx.id
    await session.commit()
    return req


async def reject_deposit(session: AsyncSession, admin: User, request_id: int, reason: str) -> DepositRequest:
    reason = (reason or "").strip()
    if not reason:
        raise AppError(422, "reason_required", "반려 사유를 입력해 주세요.")
    req: DepositRequest = await _lock_request(session, DepositRequest, request_id)
    if req.status != "PENDING":
        raise AppError(409, "invalid_status", f"이미 처리된 요청입니다 ({req.status}).")
    req.status = "REJECTED"
    req.reject_reason = reason
    req.processed_by = admin.id
    req.processed_at = _now()
    await session.commit()
    return req


# ── 출금 ────────────────────────────────────────────────────

_EVM = re.compile(r"^0x[0-9a-fA-F]{40}$")
_TRON = re.compile(r"^T[1-9A-HJ-NP-Za-km-z]{33}$")
_SOL = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{32,44}$")
_APT = re.compile(r"^0x[0-9a-fA-F]{1,64}$")


def validate_address(network: str, address: str) -> str:
    address = (address or "").strip()
    if not address:
        raise AppError(422, "address_required", "출금 지갑 주소를 입력해 주세요.")
    key = normalize_network(network)
    pattern = {
        "ETH": _EVM, "ERC20": _EVM, "BSC": _EVM, "BEP20": _EVM, "POL": _EVM, "POLYGON": _EVM,
        "TRC20": _TRON, "TRON": _TRON, "SOL": _SOL, "APT": _APT,
    }.get(key)
    if (pattern and not pattern.match(address)) or len(address) > 200 or re.search(r"\s", address):
        raise AppError(422, "invalid_address", f"{network} 네트워크 지갑 주소 형식이 올바르지 않습니다.")
    return address


async def request_withdrawal(
    session: AsyncSession,
    user: User,
    *,
    amount: object,
    network: str,
    wallet_address: str,
    verification_code: str | None,
    totp_code: str | None,
) -> WithdrawalRequest:
    if user.kyc_status != "APPROVED":
        raise AppError(403, "kyc_required", "출금하려면 KYC 인증을 먼저 완료해 주세요.")

    value = money(amount, "출금 금액")
    net = await find_active_network(session, network)
    fee = Decimal(str(net["fee"])).quantize(CENT, ROUND_HALF_UP)
    address = validate_address(net["name"], wallet_address)
    minimum = await _min_amount(session, "min_withdrawal_amount", DEFAULT_MIN_WITHDRAWAL)
    if value < minimum:
        raise AppError(400, "amount_below_minimum", f"최소 출금 금액은 {minimum:g} USDT입니다.")
    if value <= fee:
        raise AppError(400, "amount_not_above_fee", "출금 금액은 네트워크 수수료보다 커야 합니다.")

    # 보안 인증 (기존 서버와 같음): 2FA를 켰으면 OTP, 출금 이메일 인증을 켰으면 이메일 코드.
    # OTP를 먼저 본다 — OTP가 틀렸을 때 이메일 코드를 써 버리지 않도록.
    if user.is_2fa_enabled:
        if not (totp_code or "").strip():
            raise AppError(400, "totp_required", "2FA(OTP) 코드가 필요합니다.")
        await two_factor.verify_code(session, user, totp_code.strip())
    if user.is_email_enabled:
        if not (verification_code or "").strip():
            raise AppError(400, "verification_code_required", "이메일 인증 코드가 필요합니다.")
        await signup.consume_withdraw_code(session, user, verification_code.strip())

    wallet = await get_wallet(session, user.id, lock=True)
    if wallet.balance_usdt < value:
        raise AppError(400, "insufficient_balance", "잔고가 부족합니다.")

    req = WithdrawalRequest(
        user_id=user.id, amount=value, fee=fee, network=net["name"], wallet_address=address, status="REQUESTED"
    )
    session.add(req)
    await session.flush()
    journal = await _post_journal(
        session,
        entry_type="WITHDRAWAL_REQUESTED",
        description=f"출금 신청 — {value} USDT ({net['name']})",
        lines=[Line(USER_WALLET, debit=value, user_id=user.id), Line(WITHDRAWAL_PENDING, credit=value)],
        reference_type="withdrawal_request",
        reference_id=req.id,
    )
    tx = await _change_balance(
        session, wallet, tx_type="WITHDRAW", direction="OUT", amount=value,
        description=f"출금 신청 (요청 #{req.id}) → {address}", journal=journal,
        reference_type="withdrawal_request", reference_id=req.id,
    )
    req.hold_wallet_tx_id = tx.id
    await session.commit()
    await session.refresh(req)
    return req


async def approve_withdrawal(session: AsyncSession, admin: User, request_id: int, tx_hash: str) -> WithdrawalRequest:
    tx_hash = (tx_hash or "").strip()
    if not tx_hash:
        raise AppError(422, "tx_hash_required", "송금한 TX hash를 입력해 주세요.")
    if len(tx_hash) > 200 or re.search(r"\s", tx_hash):
        raise AppError(422, "invalid_tx_hash", "TX hash 형식이 올바르지 않습니다.")
    req: WithdrawalRequest = await _lock_request(session, WithdrawalRequest, request_id)
    if req.status != "REQUESTED":
        raise AppError(409, "invalid_status", f"이미 처리된 요청입니다 ({req.status}).")

    await _post_journal(
        session,
        entry_type="WITHDRAWAL_APPROVED",
        description=f"출금 송금 완료 — {req.amount} USDT (수수료 {req.fee})",
        lines=[
            Line(WITHDRAWAL_PENDING, debit=req.amount),
            Line(CASH, credit=req.amount - req.fee),
            Line(WITHDRAWAL_FEE, credit=req.fee),
        ],
        reference_type="withdrawal_request",
        reference_id=req.id,
        created_by=admin.id,
    )
    req.status = "APPROVED"
    req.tx_hash = tx_hash
    req.processed_by = admin.id
    req.processed_at = _now()
    await session.commit()
    return req


async def reject_withdrawal(session: AsyncSession, admin: User, request_id: int, note: str) -> WithdrawalRequest:
    note = (note or "").strip()
    if not note:
        raise AppError(422, "reason_required", "반려 사유를 입력해 주세요.")
    req: WithdrawalRequest = await _lock_request(session, WithdrawalRequest, request_id)
    if req.status != "REQUESTED":
        raise AppError(409, "invalid_status", f"이미 처리된 요청입니다 ({req.status}).")

    wallet = await get_wallet(session, req.user_id, lock=True)
    journal = await _post_journal(
        session,
        entry_type="WITHDRAWAL_REJECTED",
        description=f"출금 반려 — {req.amount} USDT 지갑으로 되돌림",
        lines=[Line(WITHDRAWAL_PENDING, debit=req.amount), Line(USER_WALLET, credit=req.amount, user_id=req.user_id)],
        reference_type="withdrawal_request",
        reference_id=req.id,
        created_by=admin.id,
    )
    tx = await _change_balance(
        session, wallet, tx_type="WITHDRAW_REFUND", direction="IN", amount=req.amount,
        description=f"출금 반려로 되돌림 (요청 #{req.id})", journal=journal,
        reference_type="withdrawal_request", reference_id=req.id,
    )
    req.status = "REJECTED"
    req.rejected_reason = note
    req.processed_by = admin.id
    req.processed_at = _now()
    req.refund_wallet_tx_id = tx.id
    await session.commit()
    return req


# ── 날짜 필터 ───────────────────────────────────────────────


def parse_day(value: str | None) -> datetime | None:
    """'20261116' 또는 '2026-11-16' → 그날 0시(KST). 형식이 틀리면 None (필터 무시, 기존 서버와 같음)."""
    if not value:
        return None
    for fmt in ("%Y%m%d", "%Y-%m-%d"):
        try:
            return datetime.strptime(value.strip(), fmt).replace(tzinfo=KST)
        except ValueError:
            continue
    return None


def day_range(start: str | None, end: str | None) -> tuple[datetime | None, datetime | None]:
    """[시작일 0시, 종료일 다음날 0시) KST."""
    s = parse_day(start)
    e = parse_day(end)
    return s, (e + timedelta(days=1) if e else None)
