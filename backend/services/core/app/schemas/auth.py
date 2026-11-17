"""인증·회원 요청/응답 스키마. 필드 이름과 형태는 기존 서버(openapi.json)와 같게 유지한다."""

from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

LocaleLiteral = Literal["en", "ko"]


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
    locale: str = "en"
    grade: str = "NORMAL"
    total_referrals: int = 0
    can_change_password: bool | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    recaptcha_token: str | None = None


class RefreshTokenRequest(BaseModel):
    # 쿠키가 우선이고, 쿠키를 못 쓰는 클라이언트를 위해 body도 받는다.
    refresh_token: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"
    user_id: str
    role: str
    first_name: str | None = None
    last_name: str | None = None
    is_new_user: bool = False


class TwoFactorRequiredResponse(BaseModel):
    requires_2fa: bool = True
    user_id: str
    message: str


class TwoFactorLoginRequest(BaseModel):
    # 웹은 HttpOnly 쿠키(2fa_temp_token)를 쓰고, 백오피스는 body로 보낸다.
    temp_token: str | None = None
    code: str = Field(min_length=6, max_length=16)


class TwoFactorCodeRequest(BaseModel):
    code: str = Field(min_length=6, max_length=16)


class TwoFactorSetupResponse(BaseModel):
    secret: str
    qr_uri: str
    backup_codes: list[str]


class BackupCodesResponse(BaseModel):
    backup_codes: list[str]
    message: str = "기존 백업 코드는 모두 폐기되었습니다. 새 코드를 안전하게 보관하세요."


class MessageResponse(BaseModel):
    ok: bool = True
    message: str


class PasswordChangeRequest(BaseModel):
    old_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)


class PasswordForgotRequest(BaseModel):
    email: EmailStr
    recaptcha_token: str | None = None


class PasswordResetRequest(BaseModel):
    token: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)


class ProfileUpdateRequest(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    country: str | None = None
    city: str | None = None
    state_province: str | None = None
    address_line1: str | None = None
    address_line2: str | None = None
    zip_code: str | None = None
    phone: str | None = None
    avatar_url: str | None = None
    # 가입 때 초대 코드를 넣지 않은 회원이 나중에 한 번 등록할 수 있다.
    referrer_code: str | None = None


class WithdrawEmailRequest(BaseModel):
    enabled: bool


class WithdrawEmailResponse(BaseModel):
    ok: bool = True
    is_email_enabled: bool


class LoginHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ip_address: str | None = None
    user_agent: str | None = None
    created_at: datetime


class LoginHistoryPage(BaseModel):
    items: list[LoginHistoryOut]
    total: int
    page: int
    size: int
    pages: int


# ── 관리자 회원 관리 ────────────────────────────────────────

UserStatusLiteral = Literal["ACTIVE", "INACTIVE", "BANNED"]
UserGradeLiteral = Literal["NORMAL", "VIP"]
KycStatusLiteral = Literal["NONE", "PENDING", "APPROVED", "REJECTED"]


class AdminUserCreateRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    country: str | None = None
    state_province: str | None = None
    city: str | None = None
    zip_code: str | None = None
    address_line1: str | None = None
    address_line2: str | None = None
    admin_note: str | None = None
    role: Literal["USER"] = "USER"
    grade: UserGradeLiteral = "NORMAL"
    status: UserStatusLiteral = "ACTIVE"
    kyc_status: KycStatusLiteral = "NONE"


class AdminProfileUpdateRequest(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    country: str | None = None
    city: str | None = None
    state_province: str | None = None
    address_line1: str | None = None
    address_line2: str | None = None
    zip_code: str | None = None
    phone: str | None = None
    avatar_url: str | None = None
    referrer_code: str | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)
    status: UserStatusLiteral | None = None
    kyc_status: KycStatusLiteral | None = None
    grade: UserGradeLiteral | None = None
    admin_note: str | None = None
    locale: LocaleLiteral | None = None


class LocaleUpdateRequest(BaseModel):
    locale: LocaleLiteral


class SuspendRequest(BaseModel):
    reason: str = "Suspicious activity"


class BanRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)
    admin_note: str | None = None


class AdminPasswordResetRequest(BaseModel):
    new_password: str = Field(min_length=8, max_length=128)


class UserPage(BaseModel):
    items: list[UserOut]
    total: int
    page: int
    size: int
    pages: int


class StatusHistoryOut(BaseModel):
    id: int
    user_id: str
    from_status: str
    to_status: str
    reason: str | None = None
    changed_by: str | None = None
    created_at: datetime


class StatusHistoryPage(BaseModel):
    items: list[StatusHistoryOut]
    total: int
    page: int
    size: int
    pages: int
