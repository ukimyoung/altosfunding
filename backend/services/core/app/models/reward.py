"""추천인 리워드·트레이딩 보너스. 테이블 정의는 supabase/migrations/20261119040000_core_rewards.sql."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import BigInteger, ForeignKey, Identity, Numeric, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base

Money = Numeric(18, 2)


class RewardRecord(Base):
    __tablename__ = "reward_records"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("core.users.id"))
    type: Mapped[str] = mapped_column(server_default="REFERRAL_BONUS")
    amount: Mapped[Decimal] = mapped_column(Money)
    currency: Mapped[str] = mapped_column(server_default="USDT")
    status: Mapped[str] = mapped_column(server_default="PENDING")
    source_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("core.users.id"))
    source_type: Mapped[str | None]
    source_id: Mapped[str | None]
    description: Mapped[str | None]
    approved_at: Mapped[datetime | None]
    approved_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("core.users.id"))
    rejected_at: Mapped[datetime | None]
    rejected_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("core.users.id"))
    rejection_reason: Mapped[str | None]
    wallet_tx_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("core.wallet_transactions.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now())


class TradingBonusRecord(Base):
    __tablename__ = "trading_bonus_records"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("core.users.id"))
    payout_request_id: Mapped[int] = mapped_column(BigInteger)
    mt4_login: Mapped[int | None] = mapped_column(BigInteger)
    trader_profit: Mapped[Decimal | None] = mapped_column(Money)
    profit_split_pct: Mapped[Decimal | None] = mapped_column(Numeric(9, 4))
    company_share: Mapped[Decimal] = mapped_column(Money)
    bonus_rate: Mapped[Decimal] = mapped_column(Numeric(9, 6))
    bonus_amount: Mapped[Decimal] = mapped_column(Money)
    status: Mapped[str] = mapped_column(server_default="PENDING")
    approved_at: Mapped[datetime | None]
    approved_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("core.users.id"))
    rejected_at: Mapped[datetime | None]
    rejected_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("core.users.id"))
    rejection_reason: Mapped[str | None]
    wallet_tx_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("core.wallet_transactions.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now())
