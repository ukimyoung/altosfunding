"""제휴 회원 사전 가입 (백오피스 '트레이더 관리 > 제휴사 회원'의 '회원사전가입').

관리자가 고른 제휴 회원(core.partner_members)의 Altos 계정을 미리 만든다 (자동 실행 없음).
- 만든 계정은 비밀번호가 없고 activated_at이 비어 있다(활성화 전). 로그인하면 계정 활성화 화면으로 안내하고,
  활성화하면 이 계정을 채운다 (partner_account.complete_activation).
- 옮기는 값: member_id → partner_member_id, email → email, name → first_name, phone → phone(+82 형식).
  나머지(UID·추천 코드)는 새로 만들고, 약관 동의·뉴스레터·메일 인증은 회원이 활성화할 때 채운다.
- 제외: 이미 계정이 있는 회원, 이메일 없는 회원, 탈퇴한 계정이 있는 회원.
- 제휴사 status=deleted 회원은 만들고 바로 INACTIVE로 둔다 (사유 PARTNER_DELETED → 제휴사에서 복구되면 가져오기가 되돌린다).
- 환영 메일은 보내지 않는다 (활성화할 때 보낸다).
"""

import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import PartnerMember, User
from app.services import partner_account, partner_sync, signup, user_admin

MAX_MEMBERS = 1000


@dataclass
class PreRegisterResult:
    created: list[str] = field(default_factory=list)
    # 만들었지만 제휴사 status=deleted라 비활성으로 둔 회원
    created_inactive: list[str] = field(default_factory=list)
    skipped: list[dict] = field(default_factory=list)  # [{member_id, reason}]


def _skip(result: PreRegisterResult, member_id: str, reason: str) -> None:
    result.skipped.append({"member_id": member_id, "reason": reason})


async def pre_register(session: AsyncSession, member_ids: list[str], admin_id: uuid.UUID) -> PreRegisterResult:
    """고른 회원들의 계정을 미리 만든다. 한 트랜잭션으로 커밋한다."""
    result = PreRegisterResult()
    seen: set[str] = set()
    now = datetime.now(UTC)
    for raw_id in member_ids:
        member_id = (raw_id or "").strip()
        if not member_id or member_id.lower() in seen:
            continue
        seen.add(member_id.lower())

        partner = await partner_account.find_partner(session, member_id)
        if partner is None:
            _skip(result, member_id, "not_found")
            continue
        # 같은 Member ID로 동시에 활성화하는 요청과 한 줄로 세운다.
        await session.execute(
            text("select pg_advisory_xact_lock(hashtext(:key))"),
            {"key": partner_account.partner_subject(partner.member_id)},
        )
        if await partner_account.account_of(session, partner) is not None:
            _skip(result, partner.member_id, "already_exists")
            continue
        if not partner.email:
            _skip(result, partner.member_id, "no_email")
            continue
        withdrawn = await session.scalar(
            select(func.count())
            .select_from(User)
            .where(User.withdrawn_partner_member_id == partner.member_id)
        )
        if withdrawn:
            _skip(result, partner.member_id, "withdrawn")
            continue

        user = _new_user(partner, now, admin_id)
        user.uid = await signup.generate_uid(session)
        user.referral_code = await signup._generate_unique(session, User.referral_code, 8)
        session.add(user)
        await session.flush()
        if partner.status == partner_account.DELETED:
            await user_admin.change_status(session, user, "INACTIVE", partner_sync.REASON_DELETED, admin_id)
            result.created_inactive.append(partner.member_id)
        else:
            result.created.append(partner.member_id)
    await session.commit()
    return result


def _new_user(partner: PartnerMember, now: datetime, admin_id: uuid.UUID) -> User:
    assert partner.email
    return User(
        email=partner.email,
        password_hash=None,
        auth_provider="PARTNER",
        partner_member_id=partner.member_id,
        first_name=signup._clean(partner.name),
        phone=partner_account.partner_phone(partner.phone),
        email_verified_at=None,
        agreed_to_terms=False,
        subscribed_newsletter=False,
        locale="ko",
        activated_at=None,
        pre_registered_at=now,
        pre_registered_by=admin_id,
    )
