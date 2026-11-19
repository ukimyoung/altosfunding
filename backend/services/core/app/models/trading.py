"""챌린지 주문·트레이딩(MT4) 계좌·MT4 계좌번호 기록.

테이블 정의는 supabase/migrations/20261118040000_core_challenge_orders.sql.
"""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import BigInteger, ForeignKey, Numeric, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base

Money = Numeric(18, 2)


class ChallengeOrder(Base):
    __tablename__ = "challenge_orders"

    id: Mapped[str] = mapped_column(primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("core.users.id"))
    challenge_id: Mapped[str] = mapped_column(ForeignKey("core.challenges.id"))
    product_id: Mapped[str] = mapped_column(ForeignKey("core.products.id"))
    product_name: Mapped[str]
    type_code: Mapped[str | None]
    quantity: Mapped[int]
    original_unit_price: Mapped[Decimal] = mapped_column(Money)
    unit_price: Mapped[Decimal] = mapped_column(Money)
    original_price: Mapped[Decimal] = mapped_column(Money)
    discount_amount: Mapped[Decimal] = mapped_column(Money, server_default="0")
    total_price: Mapped[Decimal] = mapped_column(Money)
    coupon_code: Mapped[str | None]
    payment_method: Mapped[str] = mapped_column(server_default="WALLET")
    issued_quantity: Mapped[int] = mapped_column(server_default="0")
    refunded_quantity: Mapped[int] = mapped_column(server_default="0")
    refunded_amount: Mapped[Decimal] = mapped_column(Money, server_default="0")
    status: Mapped[str] = mapped_column(server_default="PENDING")
    wallet_tx_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("core.wallet_transactions.id"))
    journal_entry_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("core.journal_entries.id"))
    completed_at: Mapped[datetime | None]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())


class TradingAccount(Base):
    __tablename__ = "trading_accounts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("core.users.id"))
    product_id: Mapped[str] = mapped_column(ForeignKey("core.products.id"))
    challenge_id: Mapped[str | None] = mapped_column(ForeignKey("core.challenges.id"))
    order_id: Mapped[str | None] = mapped_column(ForeignKey("core.challenge_orders.id"))
    tier: Mapped[str]
    mt4_server: Mapped[str]
    mt4_group: Mapped[str]
    mt4_login: Mapped[int | None] = mapped_column(BigInteger)
    leverage: Mapped[int]
    capital: Mapped[Decimal] = mapped_column(Money)
    type_code: Mapped[str | None]
    unit_price: Mapped[Decimal] = mapped_column(Money, server_default="0")
    status: Mapped[str] = mapped_column(server_default="PENDING")
    is_read_only: Mapped[bool] = mapped_column(server_default="true")
    provision_status: Mapped[str] = mapped_column(server_default="QUEUED")
    provision_error: Mapped[str | None]
    mt4_create_attempted_at: Mapped[datetime | None]
    mt4_created_at: Mapped[datetime | None]
    capital_deposit_attempted_at: Mapped[datetime | None]
    capital_deposited_at: Mapped[datetime | None]
    capital_order_id: Mapped[int | None] = mapped_column(BigInteger)
    password_encrypted: Mapped[str | None]
    investor_password_encrypted: Mapped[str | None]
    start_at: Mapped[datetime | None]
    end_at: Mapped[datetime | None]
    refund_wallet_tx_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("core.wallet_transactions.id"))
    issued_at: Mapped[datetime | None]
    # MT4에서 수집한 최근 잔고·평가금액 (20261119030000). 수집 전이면 None.
    balance: Mapped[Decimal | None] = mapped_column(Money)
    equity: Mapped[Decimal | None] = mapped_column(Money)
    credit: Mapped[Decimal | None] = mapped_column(Money)
    margin: Mapped[Decimal | None] = mapped_column(Money)
    free_margin: Mapped[Decimal | None] = mapped_column(Money)
    margin_level: Mapped[Decimal | None] = mapped_column(Money)
    equity_updated_at: Mapped[datetime | None]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())


class Mt4AccountIssuedHistory(Base):
    __tablename__ = "mt4_account_issued_history"

    mt4_server: Mapped[str] = mapped_column(primary_key=True)
    mt4_login: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    product_id: Mapped[str | None] = mapped_column(ForeignKey("core.products.id"))
    account_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("core.trading_accounts.id"))
    status: Mapped[str]
    reason: Mapped[str | None]
    # SYSTEM: 발급 과정에서 자동 기록 / ADMIN: 관리자가 블랙리스트로 등록·전환 (20261118060000)
    source: Mapped[str] = mapped_column(server_default="SYSTEM")
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("core.users.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())


class TradingAccountStatusHistory(Base):
    """관리자가 바꾼 계좌 상태 이력 (20261119020000)."""

    __tablename__ = "trading_account_status_history"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("core.trading_accounts.id"))
    action: Mapped[str]
    from_status: Mapped[str]
    to_status: Mapped[str]
    reason: Mapped[str | None]
    changed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("core.users.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class TradingAccountTrade(Base):
    """MT4에서 수집한 주문 (거래·잔고 입출금). 미결 포지션은 is_open (20261119030000)."""

    __tablename__ = "trading_account_trades"

    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("core.trading_accounts.id"), primary_key=True
    )
    mt4_order: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    mt4_login: Mapped[int] = mapped_column(BigInteger)
    type: Mapped[str]
    action: Mapped[str]
    is_open: Mapped[bool] = mapped_column(server_default="false")
    symbol: Mapped[str | None]
    volume: Mapped[Decimal] = mapped_column(Numeric(18, 4), server_default="0")
    open_time: Mapped[datetime | None]
    open_price: Mapped[Decimal | None] = mapped_column(Numeric(20, 6))
    close_time: Mapped[datetime | None]
    close_price: Mapped[Decimal | None] = mapped_column(Numeric(20, 6))
    stop_loss: Mapped[Decimal | None] = mapped_column(Numeric(20, 6))
    take_profit: Mapped[Decimal | None] = mapped_column(Numeric(20, 6))
    profit: Mapped[Decimal] = mapped_column(Money, server_default="0")
    commission: Mapped[Decimal] = mapped_column(Money, server_default="0")
    swap: Mapped[Decimal] = mapped_column(Money, server_default="0")
    taxes: Mapped[Decimal] = mapped_column(Money, server_default="0")
    contract_size: Mapped[Decimal | None] = mapped_column(Numeric(18, 4))
    base_currency: Mapped[str | None]
    quote_currency: Mapped[str | None]
    comment: Mapped[str | None]
    reason: Mapped[str | None]
    raw: Mapped[dict | None] = mapped_column(JSONB)
    first_seen_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now())


class TradingAccountSync(Base):
    """계좌별 MT4 수집 상태 (커서·마지막 성공/실패) (20261119030000)."""

    __tablename__ = "trading_account_sync"

    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("core.trading_accounts.id"), primary_key=True
    )
    last_close_time: Mapped[datetime | None]
    last_synced_at: Mapped[datetime | None]
    last_trades_count: Mapped[int] = mapped_column(server_default="0")
    last_error: Mapped[str | None]
    last_error_at: Mapped[datetime | None]
    consecutive_failures: Mapped[int] = mapped_column(server_default="0")
    last_snapshot_at: Mapped[datetime | None]
    inactive_since: Mapped[datetime | None]
    final_synced_at: Mapped[datetime | None]
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now())


class TradingAccountEquitySnapshot(Base):
    """잔고·평가금액 이력 (20261119030000)."""

    __tablename__ = "trading_account_equity_snapshots"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("core.trading_accounts.id"))
    taken_at: Mapped[datetime] = mapped_column(server_default=func.now())
    balance: Mapped[Decimal] = mapped_column(Money)
    equity: Mapped[Decimal] = mapped_column(Money)
    credit: Mapped[Decimal | None] = mapped_column(Money)
    margin: Mapped[Decimal | None] = mapped_column(Money)
    free_margin: Mapped[Decimal | None] = mapped_column(Money)
    margin_level: Mapped[Decimal | None] = mapped_column(Money)


class ChallengeEvaluation(Base):
    """백오피스 Leaderboard '확인하기' 판정 결과 (20261120010000). 계좌별 마지막 줄이 현재 판정."""

    __tablename__ = "challenge_evaluations"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("core.trading_accounts.id"))
    challenge_id: Mapped[str] = mapped_column(ForeignKey("core.challenges.id"))
    ruleset_id: Mapped[str | None] = mapped_column(ForeignKey("core.rulesets.id"))
    result: Mapped[str]
    period_start: Mapped[datetime]
    period_end: Mapped[datetime]
    capital: Mapped[Decimal] = mapped_column(Money)
    equity: Mapped[Decimal] = mapped_column(Money)
    profit: Mapped[Decimal] = mapped_column(Money)
    profit_rate: Mapped[Decimal] = mapped_column(Numeric(12, 4))
    trades_count: Mapped[int] = mapped_column(server_default="0")
    open_positions: Mapped[int] = mapped_column(server_default="0")
    checks: Mapped[list] = mapped_column(JSONB, server_default="[]")
    rules_applied: Mapped[int] = mapped_column(server_default="0")
    evaluated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("core.users.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
