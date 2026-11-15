import uuid
from datetime import datetime

from sqlalchemy import BigInteger, ForeignKey, Identity, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class AnnouncementCategory(Base):
    __tablename__ = "announcement_categories"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    name: Mapped[str] = mapped_column(unique=True)
    # 기본 언어(en)가 아닌 이름: {"ko": {"name": "점검"}}
    translations: Mapped[dict] = mapped_column(JSONB, server_default="{}")
    sort_order: Mapped[int] = mapped_column(server_default="0")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())


class Announcement(Base):
    __tablename__ = "announcements"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    category_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("core.announcement_categories.id"))
    title: Mapped[str]
    content: Mapped[str]
    # 기본 언어(en)가 아닌 제목·본문: {"ko": {"title": "...", "content": "..."}}
    translations: Mapped[dict] = mapped_column(JSONB, server_default="{}")
    status: Mapped[str] = mapped_column(server_default="PUBLISHED")
    is_pinned: Mapped[bool] = mapped_column(server_default="false")
    sort_order: Mapped[int] = mapped_column(server_default="0")
    category_sort_order: Mapped[int] = mapped_column(server_default="0")
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("core.users.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())
