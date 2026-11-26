import uuid
from datetime import date, datetime

from sqlalchemy import BigInteger, ForeignKey, Identity, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class PartnerMember(Base):
    """제휴사(10Power·xnsoft) 회원 원본. 제휴사 회원 조회 API 값을 member_id 기준으로 저장한다."""

    __tablename__ = "partner_members"

    member_id: Mapped[str] = mapped_column(primary_key=True)
    site: Mapped[str]
    name: Mapped[str]
    email: Mapped[str | None]
    phone: Mapped[str | None]
    sponsor_member_id: Mapped[str | None]
    status: Mapped[str]
    joined_at: Mapped[datetime]
    membership_expires_on: Mapped[date | None]
    membership_active: Mapped[bool] = mapped_column(server_default="false")
    partner_updated_at: Mapped[datetime]
    raw: Mapped[dict] = mapped_column(JSONB, server_default="{}")
    first_synced_at: Mapped[datetime] = mapped_column(server_default=func.now())
    last_synced_at: Mapped[datetime] = mapped_column(server_default=func.now())
    last_sync_run_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("core.partner_member_sync_runs.id")
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())


class PartnerMemberSyncRun(Base):
    """제휴사 회원 가져오기 1회차. QUEUED·RUNNING 회차는 한 번에 하나만 있다."""

    __tablename__ = "partner_member_sync_runs"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    mode: Mapped[str]
    status: Mapped[str] = mapped_column(server_default="QUEUED")
    requested_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("core.users.id"))
    since: Mapped[datetime | None]
    as_of: Mapped[datetime | None]
    pages: Mapped[int] = mapped_column(server_default="0")
    fetched: Mapped[int] = mapped_column(server_default="0")
    inserted: Mapped[int] = mapped_column(server_default="0")
    updated: Mapped[int] = mapped_column(server_default="0")
    unchanged: Mapped[int] = mapped_column(server_default="0")
    failed: Mapped[int] = mapped_column(server_default="0")
    deactivated: Mapped[int] = mapped_column(server_default="0")
    reactivated: Mapped[int] = mapped_column(server_default="0")
    last_cursor: Mapped[str | None]
    error: Mapped[str | None]
    failures: Mapped[list] = mapped_column(JSONB, server_default="[]")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    started_at: Mapped[datetime | None]
    finished_at: Mapped[datetime | None]
