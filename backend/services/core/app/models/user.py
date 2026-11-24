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
    totp_last_used_step: Mapped[int | None] = mapped_column(BigInteger)
    two_factor_failed_count: Mapped[int] = mapped_column(Integer, server_default="0")
    two_factor_locked_until: Mapped[datetime | None]
    is_email_enabled: Mapped[bool] = mapped_column(server_default="true")
    locale: Mapped[str] = mapped_column(server_default="en")

    referral_code: Mapped[str] = mapped_column(String, unique=True)
    # 추천인·수당 조직 상위는 core.member_relations (MemberRelation)에 있다.

    agreed_to_terms: Mapped[bool] = mapped_column(server_default="false")
    subscribed_newsletter: Mapped[bool] = mapped_column(server_default="false")
    newsletter_unsubscribed_at: Mapped[datetime | None]

    last_login_at: Mapped[datetime | None]
    last_login_ip: Mapped[str | None]
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


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("core.users.id", ondelete="CASCADE")
    )
    token_hash: Mapped[str] = mapped_column(String, unique=True)
    expires_at: Mapped[datetime]
    revoked_at: Mapped[datetime | None]
    ip_address: Mapped[str | None]
    user_agent: Mapped[str | None]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class LoginHistory(Base):
    __tablename__ = "login_history"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("core.users.id", ondelete="CASCADE")
    )
    ip_address: Mapped[str | None]
    user_agent: Mapped[str | None]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class UserBackupCode(Base):
    __tablename__ = "user_backup_codes"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("core.users.id", ondelete="CASCADE")
    )
    code_hash: Mapped[str]
    used_at: Mapped[datetime | None]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("core.users.id", ondelete="CASCADE")
    )
    token_hash: Mapped[str] = mapped_column(String, unique=True)
    expires_at: Mapped[datetime]
    used_at: Mapped[datetime | None]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class UserStatusHistory(Base):
    __tablename__ = "user_status_history"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("core.users.id"))
    from_status: Mapped[str]
    to_status: Mapped[str]
    reason: Mapped[str | None]
    changed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("core.users.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class MemberRelation(Base):
    """회원별 현재 조직 관계 1행. users에 행이 생기면 DB 트리거가 빈 행을 만든다."""

    __tablename__ = "member_relations"

    member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("core.users.id", ondelete="CASCADE"), primary_key=True
    )
    sponsor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("core.users.id", ondelete="SET NULL")
    )
    placement_parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("core.users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now())


class MemberRelationHistory(Base):
    __tablename__ = "member_relation_history"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    member_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("core.users.id", ondelete="CASCADE"))
    change_type: Mapped[str]
    old_sponsor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    new_sponsor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    old_placement_parent_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    new_placement_parent_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    reason: Mapped[str | None]
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
