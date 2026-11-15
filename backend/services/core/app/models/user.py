import uuid
from datetime import datetime

from sqlalchemy import BigInteger, ForeignKey, Identity, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    uid: Mapped[str] = mapped_column(String, unique=True)
    email: Mapped[str] = mapped_column(String)
    password_hash: Mapped[str | None]
    auth_provider: Mapped[str] = mapped_column(server_default="LOCAL")
    role: Mapped[str] = mapped_column(server_default="USER")
    status: Mapped[str] = mapped_column(server_default="ACTIVE")
    grade: Mapped[str] = mapped_column(server_default="NORMAL")

    first_name: Mapped[str | None]
    last_name: Mapped[str | None]
    country: Mapped[str | None]
    city: Mapped[str | None]
    state_province: Mapped[str | None]
    address_line1: Mapped[str | None]
    address_line2: Mapped[str | None]
    zip_code: Mapped[str | None]
    phone: Mapped[str | None]
    avatar_url: Mapped[str | None]
    admin_note: Mapped[str | None]

    email_verified_at: Mapped[datetime | None]

    kyc_status: Mapped[str] = mapped_column(server_default="NONE")
    kyc_reject_reason: Mapped[str | None]
    kyc_submitted_at: Mapped[datetime | None]
    kyc_approved_at: Mapped[datetime | None]
    kyc_rejected_at: Mapped[datetime | None]

    is_2fa_enabled: Mapped[bool] = mapped_column(server_default="false")
    totp_secret_encrypted: Mapped[str | None]
    is_email_enabled: Mapped[bool] = mapped_column(server_default="true")

    referral_code: Mapped[str] = mapped_column(String, unique=True)
    referrer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("core.users.id", ondelete="SET NULL")
    )

    agreed_to_terms: Mapped[bool] = mapped_column(server_default="false")
    subscribed_newsletter: Mapped[bool] = mapped_column(server_default="false")

    last_login_at: Mapped[datetime | None]
    withdrawn_at: Mapped[datetime | None]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now())


class EmailVerification(Base):
    __tablename__ = "email_verifications"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    email: Mapped[str]
    purpose: Mapped[str]
    code_hash: Mapped[str]
    attempts: Mapped[int] = mapped_column(Integer, server_default="0")
    expires_at: Mapped[datetime]
    verified_at: Mapped[datetime | None]
    consumed_at: Mapped[datetime | None]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
