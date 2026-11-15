"""로그인한 회원의 계정·보안 설정 (프로필, 비밀번호, 2FA, 로그인 이력)."""

import math
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Query, Request, Response
from sqlalchemy import func, select

from app.api.v1.auth import (
    REFRESH_COOKIE,
    TWO_FACTOR_COOKIE,
    Session,
    _delete_cookie,
    _locale,
)
from app.deps import CurrentUser
from app.errors import AppError
from app.models import LoginHistory, User
from app.schemas.auth import (
    BackupCodesResponse,
    LoginHistoryOut,
    LoginHistoryPage,
    MessageResponse,
    OkResponse,
    PasswordChangeRequest,
    PasswordForgotRequest,
    PasswordResetRequest,
    ProfileUpdateRequest,
    TwoFactorCodeRequest,
    TwoFactorSetupResponse,
    UserOut,
    WithdrawEmailRequest,
    WithdrawEmailResponse,
)
from app.services import password, signup, two_factor, user_admin
from app.services.email import EmailSender, get_email_sender
from app.services.recaptcha import verify_recaptcha

router = APIRouter(prefix="/auth", tags=["auth"])


async def _user_out(session, user: User) -> UserOut:
    return await user_admin.user_out(session, user, for_admin=False)


@router.get("/me", response_model=UserOut, summary="내 정보 조회")
async def me(user: CurrentUser, session: Session) -> UserOut:
    return await _user_out(session, user)


# ── 프로필 ──────────────────────────────────────────────────


@router.put("/profile", response_model=UserOut, summary="프로필 수정")
async def update_profile(body: ProfileUpdateRequest, user: CurrentUser, session: Session) -> UserOut:
    data = body.model_dump(exclude_unset=True)
    referrer_code = data.pop("referrer_code", None)
    for field, value in data.items():
        setattr(user, field, signup._clean(value))

    referrer_code = signup._clean(referrer_code)
    if referrer_code:
        referrer = await session.scalar(
            select(User).where(User.referral_code == referrer_code.upper(), User.status != "WITHDRAWN")
        )
        if referrer is None:
            raise AppError(400, "invalid_referrer_code", "존재하지 않는 초대 코드입니다.")
        if referrer.id == user.id:
            raise AppError(400, "cannot_refer_yourself", "본인의 초대 코드는 등록할 수 없습니다.")
        if user.referrer_id is None:
            user.referrer_id = referrer.id
        elif user.referrer_id != referrer.id:
            raise AppError(400, "referrer_already_set", "초대 코드는 한 번만 등록할 수 있습니다.")

    await session.commit()
    return await _user_out(session, user)


@router.patch(
    "/security/withdraw-email",
    response_model=WithdrawEmailResponse,
    summary="출금 시 이메일 인증 사용 여부 변경",
)
async def toggle_withdraw_email(
    body: WithdrawEmailRequest, user: CurrentUser, session: Session
) -> WithdrawEmailResponse:
    user.is_email_enabled = body.enabled
    await session.commit()
    return WithdrawEmailResponse(is_email_enabled=user.is_email_enabled)


@router.get("/login-history", response_model=LoginHistoryPage, summary="로그인 이력 조회")
async def login_history(
    user: CurrentUser,
    session: Session,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> LoginHistoryPage:
    total = await session.scalar(
        select(func.count()).select_from(LoginHistory).where(LoginHistory.user_id == user.id)
    ) or 0
    rows = await session.scalars(
        select(LoginHistory)
        .where(LoginHistory.user_id == user.id)
        .order_by(LoginHistory.created_at.desc(), LoginHistory.id.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    return LoginHistoryPage(
        items=[LoginHistoryOut.model_validate(r) for r in rows],
        total=total,
        page=page,
        size=size,
        pages=math.ceil(total / size) if total else 0,
    )


# ── 비밀번호 ────────────────────────────────────────────────


@router.put("/password", response_model=OkResponse, summary="비밀번호 변경")
async def change_password(
    body: PasswordChangeRequest,
    user: CurrentUser,
    session: Session,
    refresh_cookie: Annotated[str | None, Cookie(alias=REFRESH_COOKIE)] = None,
) -> OkResponse:
    """현재 비밀번호를 확인하고 바꾼다. 지금 기기를 뺀 다른 기기의 로그인은 끊는다."""
    await password.change_password(session, user, body.old_password, body.new_password, refresh_cookie)
    return OkResponse(message_key="auth.password_changed")


@router.post("/password/forgot", response_model=OkResponse, summary="비밀번호 재설정 링크 발송")
async def forgot_password(
    body: PasswordForgotRequest,
    request: Request,
    session: Session,
    sender: Annotated[EmailSender, Depends(get_email_sender)],
) -> OkResponse:
    """가입 여부와 관계없이 같은 응답을 준다. 실제 메일은 이메일 가입 회원에게만 간다."""
    await verify_recaptcha(body.recaptcha_token, request.client.host if request.client else None)
    await password.request_reset(session, sender, body.email, _locale(request))
    return OkResponse(message_key="auth.password_reset_sent")


@router.post("/password/reset", response_model=OkResponse, summary="토큰으로 비밀번호 재설정")
async def reset_password(body: PasswordResetRequest, session: Session) -> OkResponse:
    await password.reset_password(session, body.token, body.new_password)
    return OkResponse(message_key="auth.password_reset_success")


# ── 2FA ─────────────────────────────────────────────────────


@router.post("/2fa/setup", response_model=TwoFactorSetupResponse, summary="2FA 설정 시작")
async def setup_2fa(user: CurrentUser, session: Session) -> TwoFactorSetupResponse:
    """QR 코드 주소와 백업 코드 10개를 돌려준다. 백업 코드는 이 응답에서만 볼 수 있다."""
    return TwoFactorSetupResponse(**await two_factor.setup(session, user))


@router.post("/2fa/verify", response_model=MessageResponse, summary="2FA 코드 확인 후 켜기")
async def verify_2fa(body: TwoFactorCodeRequest, user: CurrentUser, session: Session) -> MessageResponse:
    await two_factor.enable(session, user, body.code)
    return MessageResponse(message="2FA enabled successfully")


@router.post("/2fa/disable", response_model=MessageResponse, summary="2FA 끄기")
async def disable_2fa(body: TwoFactorCodeRequest, user: CurrentUser, session: Session) -> MessageResponse:
    await two_factor.disable(session, user, body.code)
    return MessageResponse(message="2FA disabled")


@router.post(
    "/2fa/backup-codes/regenerate", response_model=BackupCodesResponse, summary="2FA 백업 코드 재발급"
)
async def regenerate_backup_codes(
    body: TwoFactorCodeRequest, user: CurrentUser, session: Session
) -> BackupCodesResponse:
    return BackupCodesResponse(backup_codes=await two_factor.regenerate_backup_codes(session, user, body.code))


# ── 탈퇴 ────────────────────────────────────────────────────


@router.post("/account/withdraw", response_model=OkResponse, summary="회원 탈퇴 (본인)")
async def withdraw_account(user: CurrentUser, session: Session, response: Response) -> OkResponse:
    """개인정보를 지우고 모든 기기의 로그인을 끊는다. 관리자 계정은 직접 탈퇴할 수 없다."""
    if user.role == "ADMIN":
        raise AppError(400, "admin_self_withdraw_forbidden", "Admin accounts cannot be withdrawn via this endpoint")
    await user_admin.withdraw(session, user, "회원 본인 탈퇴", user.id)
    await session.commit()
    _delete_cookie(response, REFRESH_COOKIE)
    _delete_cookie(response, TWO_FACTOR_COOKIE)
    return OkResponse(message_key="auth.account_withdrawn")
