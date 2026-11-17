import uuid
from datetime import datetime

from sqlalchemy import BigInteger, ForeignKey, Identity, LargeBinary, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, TEXT, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base

_UUID = UUID(as_uuid=True)


class ManualEmailDraft(Base):
    __tablename__ = "manual_email_drafts"

    id: Mapped[uuid.UUID] = mapped_column(_UUID, primary_key=True, server_default=func.gen_random_uuid())
    status: Mapped[str] = mapped_column(server_default="draft")
    target_mode: Mapped[str]
    filter: Mapped[dict | None] = mapped_column(JSONB)
    manual_entries: Mapped[list[str] | None] = mapped_column(ARRAY(TEXT))
    import_id: Mapped[uuid.UUID | None] = mapped_column(_UUID)
    import_entries: Mapped[list[str] | None] = mapped_column(ARRAY(TEXT))
    import_filename: Mapped[str | None]
    is_marketing: Mapped[bool] = mapped_column(server_default="true")
    is_urgent: Mapped[bool] = mapped_column(server_default="false")
    content_locales: Mapped[dict] = mapped_column(JSONB)
    preview_locale: Mapped[str] = mapped_column(server_default="en")
    sample_user_name: Mapped[str] = mapped_column(server_default="John Doe")
    send_at: Mapped[datetime | None]
    job_id: Mapped[uuid.UUID | None] = mapped_column(_UUID)
    expires_at: Mapped[datetime]
    created_by: Mapped[uuid.UUID | None] = mapped_column(_UUID, ForeignKey("core.users.id"))
    updated_by: Mapped[uuid.UUID | None] = mapped_column(_UUID, ForeignKey("core.users.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())


class ManualEmailJob(Base):
    __tablename__ = "manual_email_jobs"

    id: Mapped[uuid.UUID] = mapped_column(_UUID, primary_key=True, server_default=func.gen_random_uuid())
    draft_id: Mapped[uuid.UUID] = mapped_column(_UUID, ForeignKey("core.manual_email_drafts.id"))
    status: Mapped[str] = mapped_column(server_default="queued")
    target_mode: Mapped[str]
    is_marketing: Mapped[bool]
    is_urgent: Mapped[bool]
    subject: Mapped[str]
    send_at: Mapped[datetime | None]
    recipient_total: Mapped[int] = mapped_column(server_default="0")
    sent_count: Mapped[int] = mapped_column(server_default="0")
    failed_count: Mapped[int] = mapped_column(server_default="0")
    skipped_count: Mapped[int] = mapped_column(server_default="0")
    started_at: Mapped[datetime | None]
    completed_at: Mapped[datetime | None]
    created_by: Mapped[uuid.UUID | None] = mapped_column(_UUID, ForeignKey("core.users.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class ManualEmailRecipient(Base):
    __tablename__ = "manual_email_recipients"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    job_id: Mapped[uuid.UUID] = mapped_column(_UUID, ForeignKey("core.manual_email_jobs.id"))
    email: Mapped[str]
    user_id: Mapped[uuid.UUID | None] = mapped_column(_UUID, ForeignKey("core.users.id"))
    locale: Mapped[str | None]
    status: Mapped[str] = mapped_column(server_default="pending")
    skip_reason: Mapped[str | None]
    error_message: Mapped[str | None]
    sent_at: Mapped[datetime | None]


class UploadedFile(Base):
    __tablename__ = "uploaded_files"

    id: Mapped[uuid.UUID] = mapped_column(_UUID, primary_key=True, server_default=func.gen_random_uuid())
    ref_domain: Mapped[str | None]
    ref_id: Mapped[str | None]
    original_filename: Mapped[str]
    content_type: Mapped[str]
    size_bytes: Mapped[int]
    data: Mapped[bytes] = mapped_column(LargeBinary)
    created_by: Mapped[uuid.UUID | None] = mapped_column(_UUID, ForeignKey("core.users.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
