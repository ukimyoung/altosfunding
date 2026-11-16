"""지갑·원장·입출금 요청. 테이블 정의는 supabase/migrations/20261116050000_core_wallet_ledger.sql."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import BigInteger, ForeignKey, Identity, Numeric, Sequence, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base

Money = Numeric(18, 2)
REQUEST_ID_SEQ = Sequence("wallet_request_id_seq", schema="core")


class LedgerAccount(Base):
    __tablename__ = "ledger_accounts"

    code: Mapped[str] = mapped_column(primary_key=True)
    name: Mapped[str]
    account_type: Mapped[str]
    description: Mapped[str | None]
    is_active: Mapped[bool] = mapped_column(server_default="true")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    entry_type: Mapped[str]
    reference_type: Mapped[str | None]
    reference_id: Mapped[str | None]
    description: Mapped[str]
    is_reversal: Mapped[bool] = mapped_column(server_default="false")
    reversed_entry_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("core.journal_entries.id"))
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("core.users.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class JournalLine(Base):
    __tablename__ = "journal_lines"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    journal_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("core.journal_entries.id"))
    account_code: Mapped[str] = mapped_column(ForeignKey("core.ledger_accounts.code"))
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("core.users.id"))
    debit: Mapped[Decimal] = mapped_column(Money, server_default="0")
    credit: Mapped[Decimal] = mapped_column(Money, server_default="0")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class Wallet(Base):
    __tablename__ = "wallets"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("core.users.id"))
    wallet_type: Mapped[str] = mapped_column(server_default="INTEGRATED")
    balance_usdt: Mapped[Decimal] = mapped_column(Money, server_default="0")
    is_active: Mapped[bool] = mapped_column(server_default="true")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())


class WalletTransaction(Base):
    __tablename__ = "wallet_transactions"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    wallet_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("core.wallets.id"))
    tx_type: Mapped[str]
    direction: Mapped[str]
    amount: Mapped[Decimal] = mapped_column(Money)
    balance_before: Mapped[Decimal] = mapped_column(Money)
    balance_after: Mapped[Decimal] = mapped_column(Money)
    counterpart_wallet_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("core.wallets.id"))
    tx_hash: Mapped[str | None]
    reference_type: Mapped[str | None]
    reference_id: Mapped[str | None]
    journal_entry_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("core.journal_entries.id"))
    description: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class DepositRequest(Base):
    __tablename__ = "deposit_requests"

    id: Mapped[int] = mapped_column(BigInteger, REQUEST_ID_SEQ, primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("core.users.id"))
    amount: Mapped[Decimal] = mapped_column(Money)
    tx_hash: Mapped[str]
    network: Mapped[str | None]
    status: Mapped[str] = mapped_column(server_default="PENDING")
    reject_reason: Mapped[str | None]
    processed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("core.users.id"))
    processed_at: Mapped[datetime | None]
    wallet_tx_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("core.wallet_transactions.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())


class WithdrawalRequest(Base):
    __tablename__ = "withdrawal_requests"

    id: Mapped[int] = mapped_column(BigInteger, REQUEST_ID_SEQ, primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("core.users.id"))
    amount: Mapped[Decimal] = mapped_column(Money)
    fee: Mapped[Decimal] = mapped_column(Money, server_default="0")
    network: Mapped[str]
    wallet_address: Mapped[str]
    status: Mapped[str] = mapped_column(server_default="REQUESTED")
    tx_hash: Mapped[str | None]
    rejected_reason: Mapped[str | None]
    processed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("core.users.id"))
    processed_at: Mapped[datetime | None]
    hold_wallet_tx_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("core.wallet_transactions.id"))
    refund_wallet_tx_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("core.wallet_transactions.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())


class PlatformConfigHistory(Base):
    __tablename__ = "platform_config_history"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    scope: Mapped[str]
    key: Mapped[str]
    old_value: Mapped[object | None] = mapped_column(JSONB)
    new_value: Mapped[object] = mapped_column(JSONB)
    changed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("core.users.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
