"""IB(제휴) 프로그램 정책 테이블. 설명은 supabase/migrations/20261124020000_core_ib_program.sql."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import BigInteger, ForeignKey, Identity, Integer, Numeric, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class IbProfile(Base):
    __tablename__ = "ib_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("core.users.id", ondelete="CASCADE"), primary_key=True
    )
    level: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(server_default="ACTIVE")
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now())


class IbProfileHistory(Base):
    __tablename__ = "ib_profile_history"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    change_type: Mapped[str]
    old_level: Mapped[int | None] = mapped_column(Integer)
    new_level: Mapped[int | None] = mapped_column(Integer)
    old_status: Mapped[str | None]
    new_status: Mapped[str | None]
    reason: Mapped[str | None]
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class IbLevelRateSet(Base):
    __tablename__ = "ib_level_rate_sets"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    version: Mapped[int] = mapped_column(Integer)
    effective_from: Mapped[datetime]
    reason: Mapped[str | None]
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class IbLevelRate(Base):
    __tablename__ = "ib_level_rates"

    set_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("core.ib_level_rate_sets.id"), primary_key=True)
    level: Mapped[int] = mapped_column(Integer, primary_key=True)
    rate: Mapped[Decimal] = mapped_column(Numeric(7, 4))


class MarketingPolicyVersion(Base):
    __tablename__ = "marketing_policy_versions"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    version: Mapped[int] = mapped_column(Integer)
    rate: Mapped[Decimal] = mapped_column(Numeric(7, 4))
    effective_from: Mapped[datetime]
    reason: Mapped[str]
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class IbCommissionBatch(Base):
    __tablename__ = "ib_commission_batches"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    order_id: Mapped[str]
    buyer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    base_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    marketing_version_id: Mapped[int] = mapped_column(BigInteger)
    marketing_rate: Mapped[Decimal] = mapped_column(Numeric(7, 4))
    rate_set_id: Mapped[int] = mapped_column(BigInteger)
    budget: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    paid_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    retained_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    journal_entry_id: Mapped[int | None] = mapped_column(BigInteger)
    refunded_base: Mapped[Decimal] = mapped_column(Numeric(18, 2), server_default="0")
    clawed_back_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), server_default="0")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now())


class IbCommissionLine(Base):
    __tablename__ = "ib_commission_lines"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    batch_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("core.ib_commission_batches.id"))
    depth: Mapped[int] = mapped_column(Integer)
    member_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    is_ib: Mapped[bool]
    level: Mapped[int | None] = mapped_column(Integer)
    ib_status: Mapped[str | None]
    member_status: Mapped[str]
    level_rate: Mapped[Decimal | None] = mapped_column(Numeric(7, 4))
    prev_max_rate: Mapped[Decimal] = mapped_column(Numeric(7, 4))
    applied_rate: Mapped[Decimal] = mapped_column(Numeric(7, 4), server_default="0")
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), server_default="0")
    result: Mapped[str]
    clawed_back_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), server_default="0")
    wallet_tx_id: Mapped[int | None] = mapped_column(BigInteger)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class IbCommissionClawback(Base):
    __tablename__ = "ib_commission_clawbacks"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    batch_id: Mapped[int] = mapped_column(BigInteger)
    line_id: Mapped[int] = mapped_column(BigInteger)
    refund_ref: Mapped[str]
    refund_base: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    wallet_tx_id: Mapped[int | None] = mapped_column(BigInteger)
    journal_entry_id: Mapped[int | None] = mapped_column(BigInteger)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
