"""챌린지 주문·트레이딩(MT4) 계좌·MT4 계좌번호 기록.

테이블 정의는 supabase/migrations/20261118040000_core_challenge_orders.sql.
"""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import BigInteger, ForeignKey, Numeric, func
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
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())


class Mt4Login(Base):
    __tablename__ = "mt4_logins"

    mt4_server: Mapped[str] = mapped_column(primary_key=True)
    mt4_login: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    product_id: Mapped[str | None] = mapped_column(ForeignKey("core.products.id"))
    account_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("core.trading_accounts.id"))
    status: Mapped[str]
    reason: Mapped[str | None]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())
