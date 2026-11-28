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
    PARTNER_ACTIVATION = "PARTNER_ACTIVATION"
    EMAIL_CHANGE = "EMAIL_CHANGE"


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
    # 제휴사 회원 계정이면 true와 Member ID (Edit Profile에서 이메일을 바꿀 수 있다)
    is_partner_member: bool = False
    partner_member_id: str | None = None
    # 사전 가입으로 만들어졌고 아직 활성화하지 않은 제휴 계정 (백오피스 '비활성' 라벨)
    is_partner_pending: bool = False


class LoginRequest(BaseModel):
    # 이메일 또는 제휴사 Member ID. `@`가 있으면 이메일로 본다.
    email: str = Field(min_length=1, max_length=254)
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
    # 이메일 또는 제휴사 Member ID
    email: str = Field(min_length=1, max_length=254)
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
UserRoleLiteral = Literal["USER", "ADMIN"]
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
    role: UserRoleLiteral = "USER"
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
    role: UserRoleLiteral | None = None
    admin_note: str | None = None
    locale: LocaleLiteral | None = None
    # 마케팅(뉴스레터) 메일 수신 동의. 수신거부 링크·백오피스 수신거부 관리와 같은 값을 쓴다.
    subscribed_newsletter: bool | None = None


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


class PartnerActivationSendRequest(BaseModel):
    member_id: str = Field(min_length=1, max_length=100)
    recaptcha_token: str | None = None


class PartnerActivationSendResponse(BaseModel):
    member_id: str
    masked_email: str
    expiry_minutes: int


class PartnerActivationCompleteRequest(BaseModel):
    member_id: str = Field(min_length=1, max_length=100)
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    password: str = Field(min_length=8, max_length=128)
    agree_to_terms: bool = False
    subscribe_newsletter: bool = False


class EmailChangeSendRequest(BaseModel):
    new_email: EmailStr


class EmailChangeRequest(BaseModel):
    new_email: EmailStr
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
