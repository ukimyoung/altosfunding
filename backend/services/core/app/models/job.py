from datetime import datetime

from sqlalchemy import BigInteger, ForeignKey, Identity, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    kind: Mapped[str]
    payload: Mapped[dict] = mapped_column(JSONB, server_default="{}")
    status: Mapped[str] = mapped_column(server_default="PENDING")
    priority: Mapped[int] = mapped_column(server_default="0")
    attempts: Mapped[int] = mapped_column(server_default="0")
    max_attempts: Mapped[int] = mapped_column(server_default="5")
    run_at: Mapped[datetime] = mapped_column(server_default=func.now())
    dedupe_key: Mapped[str | None]
    ref_type: Mapped[str | None]
    ref_id: Mapped[str | None]
    locked_by: Mapped[str | None]
    locked_at: Mapped[datetime | None]
    last_error: Mapped[str | None]
    result: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())
    finished_at: Mapped[datetime | None]


class JobAttempt(Base):
    __tablename__ = "job_attempts"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    job_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("core.jobs.id"))
    attempt: Mapped[int]
    worker_id: Mapped[str | None]
    status: Mapped[str]
    error: Mapped[str | None]
    started_at: Mapped[datetime] = mapped_column(server_default=func.now())
    finished_at: Mapped[datetime | None]


class WorkerHeartbeat(Base):
    __tablename__ = "worker_heartbeats"

    worker_id: Mapped[str] = mapped_column(primary_key=True)
    started_at: Mapped[datetime] = mapped_column(server_default=func.now())
    last_seen_at: Mapped[datetime] = mapped_column(server_default=func.now())
    last_tick: Mapped[dict | None] = mapped_column(JSONB)
