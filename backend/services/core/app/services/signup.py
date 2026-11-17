"""회원 가입: 이메일 인증코드 발송 → 코드 확인 → 가입."""

import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.errors import AppError
from app.models import EmailVerification, User
from app.schemas.auth import RegisterRequest, UserOut, VerificationPurpose
from app.security import (
    codes_match,
    generate_human_code,
    generate_numeric_code,
    hash_code,
    hash_password,
)
from app.services import email_template, email_templates
from app.services.email import EmailSender, EmailSendError


def _now() -> datetime:
    return datetime.now(UTC)


def normalize_email(email: str) -> str:
    return email.strip().lower()


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


async def _find_active_user_by_email(session: AsyncSession, email: str) -> User | None:
    return await session.scalar(
        select(User).where(User.email == email, User.status != "WITHDRAWN")
    )


async def _latest_verification(
    session: AsyncSession, email: str, purpose: VerificationPurpose
) -> EmailVerification | None:
    return await session.scalar(
        select(EmailVerification)
        .where(
            EmailVerification.email == email,
            EmailVerification.purpose == purpose.value,
            EmailVerification.consumed_at.is_(None),
        )
        .order_by(EmailVerification.created_at.desc(), EmailVerification.id.desc())
        .limit(1)
        .with_for_update()
    )


async def _issue_code(
    session: AsyncSession, sender: EmailSender, email: str, purpose: VerificationPurpose, locale: str
) -> None:
    """6자리 코드를 만들어 저장하고 메일로 보낸다. 메일 발송에 실패하면 코드를 지워 바로 다시 요청할 수 있게 한다."""
    now = _now()
    latest = await _latest_verification(session, email, purpose)
    cooldown = timedelta(seconds=settings.email_code_resend_cooldown_seconds)
    if latest and latest.created_at > now - cooldown:
        raise AppError(429, "rate_limit_exceeded", "잠시 후 다시 요청해 주세요.")

    code = generate_numeric_code()
    if purpose is VerificationPurpose.WITHDRAW_REQUEST:
        ttl_seconds = settings.withdraw_code_ttl_seconds
    else:
        ttl_seconds = settings.email_code_ttl_minutes * 60
    verification = EmailVerification(
        email=email,
        purpose=purpose.value,
        code_hash=hash_code(code),
        expires_at=now + timedelta(seconds=ttl_seconds),
    )
    session.add(verification)
    await session.commit()
    template_id = email_templates.VERIFICATION_TEMPLATE_IDS[purpose.value]
    variables = {"verification_code": code, "expiry_minutes": max(1, -(-ttl_seconds // 60))}
    mail = await email_template.render(session, template_id, locale, variables)
    try:
        if mail is None:  # 인증 메일은 항상 만들어지지만, 만약을 위해 실패로 처리한다.
            raise EmailSendError(f"템플릿 없음: {template_id}")
        await sender.send(email, mail, template_id, {"code": code, "purpose": purpose.value, "locale": locale})
    except EmailSendError as exc:
        await session.delete(verification)
        await session.commit()
        raise AppError(502, "email_send_failed", "인증 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.") from exc


async def send_verification_code(
    session: AsyncSession,
    sender: EmailSender,
    email: str,
    purpose: VerificationPurpose,
    locale: str,
) -> None:
    email = normalize_email(email)

    if purpose is not VerificationPurpose.SIGNUP:
        # 출금·비밀번호 재설정용 코드는 해당 기능을 만들 때 연결한다.
        raise AppError(400, "unsupported_purpose", "지원하지 않는 인증 목적입니다.")

    if await _find_active_user_by_email(session, email):
        raise AppError(409, "email_already_exists", "이미 가입된 이메일입니다.")

    await _issue_code(session, sender, email, purpose, locale)


async def send_withdraw_code(
    session: AsyncSession, sender: EmailSender, user: User, email: str, locale: str
) -> None:
    """출금 신청용 이메일 인증코드. 로그인한 회원 본인 이메일로만 보낸다."""
    if normalize_email(email) != user.email:
        raise AppError(400, "email_mismatch", "본인 이메일로만 인증코드를 받을 수 있습니다.")

    await _issue_code(session, sender, user.email, VerificationPurpose.WITHDRAW_REQUEST, locale)


async def consume_withdraw_code(session: AsyncSession, user: User, code: str) -> None:
    """출금 신청 시 받은 이메일 코드를 확인하고 바로 사용 처리한다 (한 번만 쓸 수 있음). 커밋은 호출한 쪽에서 한다."""
    verification = await _latest_verification(session, user.email, VerificationPurpose.WITHDRAW_REQUEST)
    if verification is None or verification.expires_at <= _now():
        raise AppError(400, "verification_code_expired", "인증코드가 없거나 만료되었습니다. 코드를 다시 받아 주세요.")
    if verification.attempts >= settings.email_code_max_attempts:
        raise AppError(429, "verification_too_many_attempts", "입력 횟수를 초과했습니다. 코드를 다시 받아 주세요.")
    if not codes_match(code, verification.code_hash):
        verification.attempts += 1
        await session.commit()
        raise AppError(400, "invalid_verification_code", "인증코드가 올바르지 않습니다.")
    verification.verified_at = verification.consumed_at = _now()


async def verify_code(
    session: AsyncSession, email: str, code: str, purpose: VerificationPurpose
) -> None:
    email = normalize_email(email)
    verification = await _latest_verification(session, email, purpose)

    if verification is None or verification.expires_at <= _now():
        raise AppError(400, "verification_code_expired", "인증코드가 없거나 만료되었습니다. 코드를 다시 받아 주세요.")

    if verification.verified_at is not None:
        return

    if verification.attempts >= settings.email_code_max_attempts:
        raise AppError(429, "verification_too_many_attempts", "입력 횟수를 초과했습니다. 코드를 다시 받아 주세요.")

    if not codes_match(code, verification.code_hash):
        verification.attempts += 1
        await session.commit()
        raise AppError(400, "invalid_verification_code", "인증코드가 올바르지 않습니다.")

    verification.verified_at = _now()
    await session.commit()


async def _generate_unique(session: AsyncSession, column, length: int, prefix: str = "") -> str:
    for _ in range(10):
        candidate = prefix + generate_human_code(length)
        exists = await session.scalar(select(func.count()).where(column == candidate))
        if not exists:
            return candidate
    raise AppError(500, "code_generation_failed", "잠시 후 다시 시도해 주세요.")


def _random_uid() -> str:
    # 첫 자리는 1~9로 해서 항상 10자리 숫자가 되게 한다.
    return str(secrets.randbelow(9) + 1) + "".join(str(secrets.randbelow(10)) for _ in range(9))


async def generate_uid(session: AsyncSession) -> str:
    """회원 Account ID: 임의의 10자리 숫자. 이미 쓰는 번호면 다시 뽑는다 (탈퇴 회원 번호 포함)."""
    for _ in range(20):
        candidate = _random_uid()
        if not await session.scalar(select(func.count()).where(User.uid == candidate)):
            return candidate
    raise AppError(500, "code_generation_failed", "잠시 후 다시 시도해 주세요.")


async def register(session: AsyncSession, body: RegisterRequest, locale: str = "en") -> UserOut:
    email = normalize_email(body.email)

    if body.auth_provider != "LOCAL":
        # Google 가입은 Google 로그인 기능과 함께 연결한다.
        raise AppError(400, "unsupported_auth_provider", "지원하지 않는 가입 방식입니다.")

    if not body.agree_to_terms:
        raise AppError(400, "tos_not_accepted", "이용약관에 동의해야 가입할 수 있습니다.")

    if await _find_active_user_by_email(session, email):
        raise AppError(409, "email_already_exists", "이미 가입된 이메일입니다.")

    verification = await _latest_verification(session, email, VerificationPurpose.SIGNUP)
    valid_since = _now() - timedelta(minutes=settings.signup_verification_valid_minutes)
    if (
        verification is None
        or verification.verified_at is None
        or verification.verified_at < valid_since
    ):
        raise AppError(400, "email_not_verified", "이메일 인증을 먼저 완료해 주세요.")

    referrer: User | None = None
    referral_code = _clean(body.referral_code)
    if referral_code:
        referrer = await session.scalar(
            select(User).where(
                User.referral_code == referral_code.upper(), User.status != "WITHDRAWN"
            )
        )
        if referrer is None:
            raise AppError(400, "invalid_referrer_code", "존재하지 않는 초대 코드입니다.")

    now = _now()
    user = User(
        uid=await generate_uid(session),
        email=email,
        password_hash=hash_password(body.password),
        auth_provider="LOCAL",
        first_name=_clean(body.first_name),
        last_name=_clean(body.last_name),
        country=_clean(body.country),
        city=_clean(body.city),
        state_province=_clean(body.state_province),
        address_line1=_clean(body.address_line1),
        address_line2=_clean(body.address_line2),
        zip_code=_clean(body.zip_code),
        phone=_clean(body.phone),
        email_verified_at=verification.verified_at,
        referral_code=await _generate_unique(session, User.referral_code, 8),
        referrer_id=referrer.id if referrer else None,
        agreed_to_terms=True,
        subscribed_newsletter=body.subscribe_newsletter,
        locale=locale,
    )
    session.add(user)
    verification.consumed_at = now

    try:
        await session.commit()
    except IntegrityError as exc:
        # 같은 이메일로 동시에 가입 요청이 들어온 경우
        await session.rollback()
        raise AppError(409, "email_already_exists", "이미 가입된 이메일입니다.") from exc

    await session.refresh(user)
    return to_user_out(user, referrer_code=referrer.referral_code if referrer else None)


def to_user_out(user: User, referrer_code: str | None = None, total_referrals: int = 0) -> UserOut:
    return UserOut(
        id=str(user.id),
        uid=user.uid,
        email=user.email,
        role=user.role,
        status=user.status,
        is_active=user.status == "ACTIVE",
        kyc_status=user.kyc_status,
        kyc_reject_reason=user.kyc_reject_reason,
        kyc_submitted_at=user.kyc_submitted_at,
        kyc_approved_at=user.kyc_approved_at,
        kyc_rejected_at=user.kyc_rejected_at,
        auth_provider=user.auth_provider,
        first_name=user.first_name,
        last_name=user.last_name,
        country=user.country,
        city=user.city,
        state_province=user.state_province,
        address_line1=user.address_line1,
        address_line2=user.address_line2,
        zip_code=user.zip_code,
        phone=user.phone,
        admin_note=user.admin_note,
        avatar_url=user.avatar_url,
        email_verified=user.email_verified_at is not None,
        is_2fa_enabled=user.is_2fa_enabled,
        is_email_enabled=user.is_email_enabled,
        created_at=user.created_at,
        last_login_at=user.last_login_at,
        referral_code=user.referral_code,
        referrer_code=referrer_code,
        agreed_to_terms=user.agreed_to_terms,
        subscribed_newsletter=user.subscribed_newsletter,
        locale=user.locale,
        grade=user.grade,
        total_referrals=total_referrals,
        can_change_password=user.auth_provider == "LOCAL",
    )
