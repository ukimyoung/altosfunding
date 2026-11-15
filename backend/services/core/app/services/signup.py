"""회원 가입: 이메일 인증코드 발송 → 코드 확인 → 가입."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.errors import AppError
from app.models import EmailVerification, User
from app.schemas.auth import RegisterRequest, UserOut, VerificationPurpose
from app.security import codes_match, generate_human_code, generate_numeric_code, hash_code, hash_password
from app.services.email import EmailSender


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

    now = _now()
    latest = await _latest_verification(session, email, purpose)
    cooldown = timedelta(seconds=settings.email_code_resend_cooldown_seconds)
    if latest and latest.created_at > now - cooldown:
        raise AppError(429, "rate_limit_exceeded", "잠시 후 다시 요청해 주세요.")

    code = generate_numeric_code()
    session.add(
        EmailVerification(
            email=email,
            purpose=purpose.value,
            code_hash=hash_code(code),
            expires_at=now + timedelta(minutes=settings.email_code_ttl_minutes),
        )
    )
    await session.commit()
    await sender.send_verification_code(email, code, purpose.value, locale)


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


async def register(session: AsyncSession, body: RegisterRequest) -> UserOut:
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
        uid=await _generate_unique(session, User.uid, 8, prefix="AF"),
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
        grade=user.grade,
        total_referrals=total_referrals,
        can_change_password=user.auth_provider == "LOCAL",
    )
