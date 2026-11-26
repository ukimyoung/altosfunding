"""제휴사(10Power·xnsoft) 회원 계정: Member ID 판별, 첫 로그인 활성화, 이메일 변경.

- 로그인 입력값에 `@`가 있으면 이메일(일반 계정), 없으면 제휴사 Member ID로 본다.
- 제휴 회원은 member_id 하나마다 Altos 계정이 따로 있다. 같은 이메일을 쓰는 다른 계정에 연결하지 않는다.
- Altos 계정은 회원이 처음 로그인할 때, 제휴사 등록 이메일로 받은 코드를 확인하고 비밀번호를 정하면 만든다.
- 제휴사 status·구독 여부로 로그인을 막지 않는다. 단 deleted(제휴사에서 삭제)는 활성화하지 않는다.
"""

import re
from datetime import UTC, datetime

from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import AppError
from app.models import PartnerMember, User
from app.schemas.auth import PartnerActivationCompleteRequest, VerificationPurpose
from app.security import hash_password
from app.services import signup
from app.services.email import EmailSender

DELETED = "deleted"


def _now() -> datetime:
    return datetime.now(UTC)


def is_member_id(identifier: str) -> bool:
    return "@" not in identifier


def mask_email(email: str) -> str:
    """k***@gmail.com 처럼 앞 한 글자만 보여 준다."""
    name, _, domain = email.partition("@")
    return f"{name[:1]}***@{domain}"


def partner_phone(phone: str | None) -> str | None:
    """제휴사(한국) 전화번호를 Altos 저장 형식(+821012345678)으로 바꾼다.

    제휴사는 회원이 입력한 형식 그대로(01012345678, 010-1234-5678) 주므로, 0으로 시작하는 국내 번호만
    +82로 바꾼다. 이미 +로 시작하거나 알 수 없는 형식은 그대로 둔다.
    """
    value = signup._clean(phone)
    if not value:
        return value
    digits = re.sub(r"[\s\-()]", "", value)
    if re.fullmatch(r"0\d{8,10}", digits):
        return f"+82{digits[1:]}"
    return value


def partner_subject(member_id: str) -> str:
    return f"partner:{member_id}"


async def find_partner(session: AsyncSession, member_id: str) -> PartnerMember | None:
    """Member ID는 대소문자를 구분하지 않는다."""
    value = member_id.strip()
    if not value:
        return None
    return await session.scalar(
        select(PartnerMember).where(func.lower(PartnerMember.member_id) == value.lower())
    )


async def account_of(session: AsyncSession, partner: PartnerMember) -> User | None:
    return await session.scalar(select(User).where(User.partner_member_id == partner.member_id))


async def find_standard_user(session: AsyncSession, email: str) -> User | None:
    """이메일 로그인·비밀번호 찾기·Google 로그인이 찾는 일반 계정 (제휴 계정 제외)."""
    return await session.scalar(
        select(User).where(
            User.email == signup.normalize_email(email),
            User.partner_member_id.is_(None),
            User.status != "WITHDRAWN",
        )
    )


async def has_partner_account_with_email(session: AsyncSession, email: str) -> bool:
    found = await session.scalar(
        select(User.id)
        .where(
            User.email == signup.normalize_email(email),
            User.partner_member_id.is_not(None),
            User.status != "WITHDRAWN",
        )
        .limit(1)
    )
    return found is not None


def ensure_activatable(partner: PartnerMember) -> None:
    """계정이 아직 없는 제휴 회원이 활성화할 수 있는지 본다."""
    if partner.status == DELETED:
        raise AppError(409, "account_deactivated", "Account is deactivated")
    if not partner.email:
        raise AppError(409, "partner_email_required", "이메일 등록이 필요합니다.")


def activation_required_error(partner: PartnerMember) -> AppError:
    assert partner.email
    return AppError(
        409,
        "partner_activation_required",
        "처음 로그인하는 제휴사 회원입니다. 계정 활성화가 필요합니다.",
        data={"member_id": partner.member_id, "masked_email": mask_email(partner.email)},
    )


async def _activatable_partner(session: AsyncSession, member_id: str) -> PartnerMember:
    partner = await find_partner(session, member_id)
    if partner is None:
        raise AppError(404, "not_found", "user not found")
    if await account_of(session, partner) is not None:
        raise AppError(409, "partner_already_activated", "이미 활성화된 계정입니다. 로그인해 주세요.")
    ensure_activatable(partner)
    return partner


async def send_activation_code(
    session: AsyncSession, sender: EmailSender, member_id: str, locale: str
) -> tuple[PartnerMember, int]:
    """제휴사 등록 이메일로 활성화 코드를 보낸다. (회원, 유효 시간(분))을 돌려준다."""
    partner = await _activatable_partner(session, member_id)
    assert partner.email
    expiry = await signup._issue_code(
        session,
        sender,
        partner.email,
        VerificationPurpose.PARTNER_ACTIVATION,
        locale,
        subject_key=partner_subject(partner.member_id),
        extra_variables={"member_id": partner.member_id},
    )
    return partner, expiry


async def complete_activation(
    session: AsyncSession, body: PartnerActivationCompleteRequest, locale: str
) -> User:
    """코드를 확인하고 Altos 계정을 만든다. 커밋까지 한다 (로그인 토큰 발급은 호출한 쪽에서)."""
    if not body.agree_to_terms:
        raise AppError(400, "tos_not_accepted", "이용약관에 동의해야 가입할 수 있습니다.")

    partner = await find_partner(session, body.member_id)
    if partner is None:
        raise AppError(404, "not_found", "user not found")
    # 같은 Member ID로 동시에 활성화하는 요청을 한 줄로 세운다.
    await session.execute(
        text("select pg_advisory_xact_lock(hashtext(:key))"), {"key": partner_subject(partner.member_id)}
    )
    partner = await _activatable_partner(session, partner.member_id)
    assert partner.email

    verification = await signup._latest_verification(
        session, partner.email, VerificationPurpose.PARTNER_ACTIVATION, partner_subject(partner.member_id)
    )
    await signup.consume_code(session, verification, body.code)
    assert verification is not None

    user = User(
        uid=await signup.generate_uid(session),
        # 코드를 받은 주소 (그 사이 제휴사 이메일이 바뀌었어도 확인된 주소를 쓴다)
        email=verification.email,
        password_hash=hash_password(body.password),
        auth_provider="PARTNER",
        partner_member_id=partner.member_id,
        first_name=signup._clean(partner.name),
        phone=partner_phone(partner.phone),
        email_verified_at=_now(),
        referral_code=await signup._generate_unique(session, User.referral_code, 8),
        agreed_to_terms=True,
        subscribed_newsletter=body.subscribe_newsletter,
        locale=locale,
    )
    session.add(user)
    try:
        await session.flush()
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise AppError(409, "partner_already_activated", "이미 활성화된 계정입니다. 로그인해 주세요.") from exc
    await session.refresh(user)
    return user


# ── 이메일 변경 (제휴 회원만) ─────────────────────────────────


def _ensure_partner_user(user: User) -> None:
    if user.partner_member_id is None:
        raise AppError(403, "email_change_not_allowed", "이메일은 제휴사 회원만 변경할 수 있습니다.")


async def send_email_change_code(
    session: AsyncSession, sender: EmailSender, user: User, new_email: str, locale: str
) -> int:
    """새 이메일로 인증코드를 보낸다. 다른 계정이 쓰는 이메일이어도 된다 (제휴 계정은 이메일 고유 규칙 밖)."""
    _ensure_partner_user(user)
    new_email = signup.normalize_email(new_email)
    if new_email == user.email:
        raise AppError(400, "same_email", "현재 이메일과 같습니다.")
    return await signup._issue_code(
        session, sender, new_email, VerificationPurpose.EMAIL_CHANGE, locale, subject_key=signup.user_subject(user)
    )


async def change_email(session: AsyncSession, user: User, new_email: str, code: str) -> str:
    """코드를 확인하고 이메일을 바꾼다. 이전 이메일을 돌려준다."""
    _ensure_partner_user(user)
    new_email = signup.normalize_email(new_email)
    verification = await signup._latest_verification(
        session, new_email, VerificationPurpose.EMAIL_CHANGE, signup.user_subject(user)
    )
    if verification is not None and verification.email != new_email:
        # 코드를 받은 뒤 다른 주소를 넣은 경우
        raise AppError(400, "verification_code_expired", "인증코드가 없거나 만료되었습니다. 코드를 다시 받아 주세요.")
    await signup.consume_code(session, verification, code)
    old_email = user.email
    user.email = new_email
    user.email_verified_at = _now()
    await session.commit()
    return old_email
