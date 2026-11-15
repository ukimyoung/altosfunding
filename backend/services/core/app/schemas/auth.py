"""인증·회원 요청/응답 스키마. 필드 이름과 형태는 기존 서버(openapi.json)와 같게 유지한다."""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class VerificationPurpose(str, Enum):
    SIGNUP = "SIGNUP"
    WITHDRAW_REQUEST = "WITHDRAW_REQUEST"
    PASSWORD_RESET = "PASSWORD_RESET"


class EmailVerificationSendRequest(BaseModel):
    email: EmailStr
    purpose: VerificationPurpose = VerificationPurpose.SIGNUP
    recaptcha_token: str | None = None


class EmailVerifyRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    purpose: VerificationPurpose = VerificationPurpose.SIGNUP


class OkResponse(BaseModel):
    ok: bool = True
    message_key: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    agree_to_terms: bool = False
    subscribe_newsletter: bool = False
    referral_code: str | None = None
    auth_provider: str = "LOCAL"
    first_name: str | None = None
    last_name: str | None = None
    country: str | None = None
    city: str | None = None
    state_province: str | None = None
    address_line1: str | None = None
    address_line2: str | None = None
    zip_code: str | None = None
    phone: str | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    uid: str | None = None
    email: str
    role: str
    status: str
    is_active: bool
    kyc_status: str = "NONE"
    kyc_reject_reason: str | None = None
    kyc_submitted_at: datetime | None = None
    kyc_approved_at: datetime | None = None
    kyc_rejected_at: datetime | None = None
    auth_provider: str
    first_name: str | None = None
    last_name: str | None = None
    country: str | None = None
    city: str | None = None
    state_province: str | None = None
    address_line1: str | None = None
    address_line2: str | None = None
    zip_code: str | None = None
    phone: str | None = None
    admin_note: str | None = None
    avatar_url: str | None = None
    email_verified: bool = False
    is_2fa_enabled: bool = False
    is_email_enabled: bool = True
    created_at: datetime | None = None
    last_login_at: datetime | None = None
    challenge_account_count: int | None = 0
    funded_account_count: int | None = 0
    live_account_count: int | None = 0
    demo_account_count: int | None = 0
    total_assets: float | None = 0.0
    referral_code: str | None = None
    referrer_code: str | None = None
    agreed_to_terms: bool = False
    subscribed_newsletter: bool = False
    grade: str = "NORMAL"
    total_referrals: int = 0
    can_change_password: bool | None = None
