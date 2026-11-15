import uuid
from datetime import datetime

from sqlalchemy import BigInteger, ForeignKey, Identity, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class ContactMessage(Base):
    __tablename__ = "contact_messages"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("core.users.id"))
    name: Mapped[str]
    email: Mapped[str]
    category: Mapped[str] = mapped_column(server_default="general")
    subject: Mapped[str]
    message: Mapped[str]
    locale: Mapped[str] = mapped_column(server_default="en")
    status: Mapped[str] = mapped_column(server_default="RECEIVED")
    reply_draft: Mapped[str | None]
    reply_body: Mapped[str | None]
    replied_at: Mapped[datetime | None]
    replied_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("core.users.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())
