from datetime import datetime, time

from sqlalchemy import BigInteger, ForeignKey, Identity, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Holiday(Base):
    __tablename__ = "holidays"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    # 휴장 기간 [start_at, end_at) (UTC)
    start_at: Mapped[datetime]
    end_at: Mapped[datetime]
    name: Mapped[str]
    is_active: Mapped[bool] = mapped_column(server_default="true")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())


class ChallengeSchedule(Base):
    __tablename__ = "challenge_schedules"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    name_template: Mapped[str]
    product_id: Mapped[str] = mapped_column(ForeignKey("core.products.id"))
    group_size: Mapped[int | None]  # null = 정원 무제한
    interval_days: Mapped[int]
    interval_minutes: Mapped[int | None]
    duration_days: Mapped[int]
    duration_minutes: Mapped[int | None]
    start_time: Mapped[time] = mapped_column(server_default="22:00")
    end_time: Mapped[time] = mapped_column(server_default="21:00")
    exclude_holiday: Mapped[bool] = mapped_column(server_default="true")
    max_occurrences: Mapped[int | None]
    status: Mapped[str] = mapped_column(server_default="ACTIVE")
    created_count: Mapped[int] = mapped_column(server_default="0")
    last_created_at: Mapped[datetime | None]
    next_run_at: Mapped[datetime | None]
    description: Mapped[str | None]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())


class Challenge(Base):
    __tablename__ = "challenges"

    # DB 컬럼은 id, API에서는 기존 서버와 같이 challenge_id로 내보낸다.
    challenge_id: Mapped[str] = mapped_column("id", primary_key=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("core.products.id"))
    challenge_schedule_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("core.challenge_schedules.id"))
    name: Mapped[str]
    group_size: Mapped[int | None]  # null = 정원 무제한
    duration_days: Mapped[int | None]
    duration_minutes: Mapped[int | None]
    current_participants: Mapped[int] = mapped_column(server_default="0")
    status: Mapped[str] = mapped_column(server_default="PENDING")
    start_at: Mapped[datetime]
    end_at: Mapped[datetime]
    started_at: Mapped[datetime | None]
    closed_at: Mapped[datetime | None]
    cancel_reason: Mapped[str | None]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())
