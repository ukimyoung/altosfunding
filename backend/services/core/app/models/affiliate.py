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
