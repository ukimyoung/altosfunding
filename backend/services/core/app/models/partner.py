from datetime import date, datetime

from sqlalchemy import func
from sqlalchemy.dialects.postgresql import JSONB
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
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())
