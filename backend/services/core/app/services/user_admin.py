"""회원 상태 변경(정지·영구정지·활성화·탈퇴)과 관리자용 회원 관리."""

import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import AppError
from app.models import MemberRelation, User, UserStatusHistory, Wallet
from app.schemas.auth import UserOut
from app.security import hash_password
from app.services import member_relations, tokens
from app.services.signup import (
    _clean,
    _generate_unique,
    generate_uid,
    normalize_email,
    to_user_out,
)


def _now() -> datetime:
    return datetime.now(UTC)


def _record(session: AsyncSession, user: User, to_status: str, reason: str | None, changed_by: uuid.UUID | None) -> None:
    session.add(
        UserStatusHistory(
            user_id=user.id, from_status=user.status, to_status=to_status, reason=reason, changed_by=changed_by
        )
    )
    user.status = to_status


async def change_status(
    session: AsyncSession, user: User, to_status: str, reason: str | None, changed_by: uuid.UUID | None
) -> None:
    """ACTIVE / INACTIVE / BANNED 사이를 바꾼다. 막는 경우 모든 기기의 로그인을 끊는다."""
    if user.status == "WITHDRAWN":
        raise AppError(409, "account_already_withdrawn", "Account is already withdrawn")
    if user.status == to_status:
        return
    if user.role == "ADMIN" and to_status != "ACTIVE":
        raise AppError(400, "cannot_block_admin", "관리자 계정은 정지할 수 없습니다.")
    _record(session, user, to_status, reason, changed_by)
    if to_status != "ACTIVE":
        await tokens.revoke_all_for_user(session, user.id)


async def withdraw(session: AsyncSession, user: User, reason: str, changed_by: uuid.UUID | None) -> str:
    """탈퇴: 개인정보를 지우고 로그인을 막는다. 탈퇴 전 이메일을 돌려준다 (안내 메일용).

    같은 이메일로 다시 가입할 수 있도록 이메일은 익명 주소로 바꾼다.
    """
    if user.status == "WITHDRAWN":
        raise AppError(409, "account_already_withdrawn", "Account is already withdrawn")
    old_email = user.email
    _record(session, user, "WITHDRAWN", reason, changed_by)
    user.email = f"withdrawn_{secrets.token_hex(6)}@deleted.local"
    user.password_hash = None
    user.first_name = "Withdrawn"
    user.last_name = "User"
    for field in ("phone", "address_line1", "address_line2", "city", "state_province", "zip_code", "avatar_url"):
        setattr(user, field, None)
    user.is_2fa_enabled = False
    user.totp_secret_encrypted = None
    user.withdrawn_at = _now()
    if user.partner_member_id:
        # 같은 Member ID로 다시 활성화할 수 있게 연결을 풀고 기록만 남긴다.
        user.withdrawn_partner_member_id = user.partner_member_id
        user.partner_member_id = None
    await tokens.revoke_all_for_user(session, user.id)
    return old_email


# 총 자산 = 통합 지갑(INTEGRATED) 잔액. 챌린지·펀디드 계좌 잔액은 아직 Core에 없어 포함하지 않는다.
_wallet_balance = func.coalesce(Wallet.balance_usdt, 0)


async def _total_assets(session: AsyncSession, user_id: uuid.UUID) -> float:
    value = await session.scalar(
        select(Wallet.balance_usdt).where(Wallet.user_id == user_id, Wallet.wallet_type == "INTEGRATED")
    )
    return float(value or 0)


async def user_out(session: AsyncSession, user: User, *, for_admin: bool) -> UserOut:
    referrer_code = None
    sponsor_id = await member_relations.sponsor_id_of(session, user.id)
    if sponsor_id:
        referrer_code = await session.scalar(select(User.referral_code).where(User.id == sponsor_id))
    total_referrals = await member_relations.count_sponsored(session, user.id)
    out = to_user_out(
        user,
        referrer_code=referrer_code,
        total_referrals=total_referrals or 0,
        total_assets=await _total_assets(session, user.id),
    )
    if not for_admin:
        # 관리자 메모는 회원 본인에게 보여 주지 않는다.
        out.admin_note = None
    return out


async def list_users(
    session: AsyncSession,
    *,
    keyword: str | None,
    status: str | None,
    grade: str | None,
    kyc_status: str | None,
    is_active: bool | None,
    page: int,
    size: int,
) -> tuple[list[UserOut], int]:
    conditions = [User.status != "WITHDRAWN"] if status != "WITHDRAWN" else []
    if keyword and keyword.strip():
        like = f"%{keyword.strip()}%"
        conditions.append(
            or_(
                User.email.ilike(like),
                User.uid.ilike(like),
                User.first_name.ilike(like),
                User.last_name.ilike(like),
                User.phone.ilike(like),
                User.referral_code.ilike(like),
                User.partner_member_id.ilike(like),
            )
        )
    if status:
        conditions.append(User.status == status)
    if grade:
        conditions.append(User.grade == grade)
    if kyc_status:
        conditions.append(User.kyc_status == kyc_status)
    if is_active is not None:
        conditions.append((User.status == "ACTIVE") if is_active else (User.status != "ACTIVE"))

    total = await session.scalar(select(func.count()).select_from(User).where(*conditions)) or 0
    referrer = User.__table__.alias("referrer")
    referral_counts = (
        select(MemberRelation.sponsor_id, func.count().label("n"))
        .where(MemberRelation.sponsor_id.is_not(None))
        .group_by(MemberRelation.sponsor_id)
    ).subquery()
    rows = await session.execute(
        select(User, referrer.c.referral_code, func.coalesce(referral_counts.c.n, 0), _wallet_balance)
        .outerjoin(MemberRelation, MemberRelation.member_id == User.id)
        .outerjoin(referrer, referrer.c.id == MemberRelation.sponsor_id)
        .outerjoin(referral_counts, referral_counts.c.sponsor_id == User.id)
        .outerjoin(Wallet, (Wallet.user_id == User.id) & (Wallet.wallet_type == "INTEGRATED"))
        .where(*conditions)
        .order_by(User.created_at.desc(), User.id)
        .offset((page - 1) * size)
        .limit(size)
    )
    items = [
        to_user_out(u, referrer_code=code, total_referrals=n, total_assets=float(bal))
        for u, code, n, bal in rows.all()
    ]
    return items, total


async def summary(session: AsyncSession) -> dict:
    """회원 목록 상단 카드용 통계. 탈퇴 회원은 세지 않는다."""
    now = _now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    row = (
        await session.execute(
            select(
                func.count(),
                func.count().filter(User.status == "ACTIVE"),
                func.count().filter(User.status == "INACTIVE"),
                func.count().filter(User.status == "BANNED"),
                func.count().filter(User.grade == "VIP"),
                func.count().filter(User.grade == "NORMAL"),
                func.count().filter(User.created_at >= today_start - timedelta(days=1), User.created_at < today_start),
                func.count().filter(User.kyc_status == "APPROVED"),
                func.count().filter(User.kyc_status == "PENDING"),
                func.count().filter(User.kyc_status == "REJECTED"),
                func.count().filter(User.kyc_status == "NONE"),
            ).where(User.status != "WITHDRAWN", User.role == "USER")
        )
    ).one()
    return {
        "total_users": row[0],
        "active_users": row[1],
        "inactive_users": row[2],
        "banned_users": row[3],
        "vip_users": row[4],
        "normal_users": row[5],
        "yesterday_signups": row[6],
        "kyc": {"approved": row[7], "pending": row[8], "rejected": row[9], "unverified": row[10]},
    }


_PROFILE_FIELDS = (
    "first_name", "last_name", "country", "city", "state_province",
    "address_line1", "address_line2", "zip_code", "phone", "avatar_url", "admin_note",
)


def _apply_kyc_status(user: User, kyc_status: str) -> None:
    if user.kyc_status == kyc_status:
        return
    user.kyc_status = kyc_status
    now = _now()
    if kyc_status == "APPROVED":
        user.kyc_approved_at = now
        user.kyc_reject_reason = None
    elif kyc_status == "REJECTED":
        user.kyc_rejected_at = now
    elif kyc_status == "PENDING":
        user.kyc_submitted_at = now


async def create_user(session: AsyncSession, data: dict, admin: User) -> User:
    email = normalize_email(data["email"])
    role = data.get("role") or "USER"
    if role == "ADMIN" and data["status"] != "ACTIVE":
        raise AppError(400, "cannot_block_admin", "관리자 계정은 활성 상태로만 만들 수 있습니다.")
    exists = await session.scalar(select(User.id).where(User.email == email, User.status != "WITHDRAWN").limit(1))
    if exists:
        raise AppError(409, "email_already_exists", "이미 가입된 이메일입니다.")
    user = User(
        uid=await generate_uid(session),
        email=email,
        password_hash=hash_password(data["password"]),
        auth_provider="LOCAL",
        role=role,
        grade=data["grade"],
        status="ACTIVE",
        email_verified_at=_now(),
        referral_code=await _generate_unique(session, User.referral_code, 8),
        agreed_to_terms=True,
        **{f: _clean(data.get(f)) for f in _PROFILE_FIELDS if f in data},
    )
    session.add(user)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise AppError(409, "email_already_exists", "이미 가입된 이메일입니다.") from exc
    _apply_kyc_status(user, data["kyc_status"])
    if data["status"] != "ACTIVE":
        _record(session, user, data["status"], "관리자 생성 시 지정", admin.id)
    return user


async def update_user(session: AsyncSession, user: User, data: dict, admin: User) -> None:
    if user.status == "WITHDRAWN":
        raise AppError(409, "account_already_withdrawn", "Account is already withdrawn")
    role = data.get("role")
    if role and role != user.role:
        if user.id == admin.id:
            raise AppError(400, "cannot_change_own_role", "본인 계정의 Role은 변경할 수 없습니다.")
        if role == "ADMIN" and (data.get("status") or user.status) != "ACTIVE":
            raise AppError(400, "cannot_block_admin", "활성 상태의 회원만 관리자로 지정할 수 있습니다.")
    for field in _PROFILE_FIELDS:
        if field in data:
            setattr(user, field, _clean(data[field]))
    if role and role != user.role:
        user.role = role
        # 권한이 바뀌면 그 회원의 모든 기기 로그인을 끊어 새 권한으로 다시 로그인하게 한다.
        await tokens.revoke_all_for_user(session, user.id)
    if data.get("grade"):
        user.grade = data["grade"]
    if data.get("locale"):
        user.locale = data["locale"]
    subscribed = data.get("subscribed_newsletter")
    if subscribed is not None and subscribed != user.subscribed_newsletter:
        user.subscribed_newsletter = subscribed
        # 수신거부 링크를 눌렀을 때와 같게: 미수신으로 바꾸면 수신거부 시각을 남기고(수신거부 관리 목록 기간 검색),
        # 다시 수신으로 바꾸면 지운다.
        user.newsletter_unsubscribed_at = None if subscribed else _now()
    if data.get("kyc_status"):
        _apply_kyc_status(user, data["kyc_status"])
    if data.get("password"):
        await set_password(session, user, data["password"])
    if data.get("status"):
        await change_status(session, user, data["status"], "관리자 정보 수정", admin.id)
    referrer_code = _clean(data.get("referrer_code"))
    if referrer_code:
        referrer = await session.scalar(
            select(User).where(User.referral_code == referrer_code.upper(), User.status != "WITHDRAWN")
        )
        if referrer is None:
            raise AppError(400, "invalid_referrer_code", "존재하지 않는 초대 코드입니다.")
        if referrer.id == user.id:
            raise AppError(400, "cannot_refer_yourself", "본인의 초대 코드는 등록할 수 없습니다.")
        # 관리자가 회원 정보에서 추천인을 바꾸면 추천인만 바뀌고 수당 조직(placement)은 그대로다 (비어 있을 때만 채움).
        await member_relations.set_sponsor(
            session,
            user.id,
            referrer.id,
            change_type=member_relations.SPONSOR_CHANGE,
            actor_id=admin.id,
            reason="관리자 회원 정보 수정",
        )


async def set_password(session: AsyncSession, user: User, new_password: str) -> None:
    if user.auth_provider != "LOCAL":
        raise AppError(400, "oauth_account_password_change", "Google 가입 계정은 비밀번호를 설정할 수 없습니다.")
    user.password_hash = hash_password(new_password)
    await tokens.revoke_all_for_user(session, user.id)


async def status_history(session: AsyncSession, user_id: uuid.UUID, page: int, size: int) -> tuple[list, int]:
    where = UserStatusHistory.user_id == user_id
    total = await session.scalar(select(func.count()).select_from(UserStatusHistory).where(where)) or 0
    rows = await session.scalars(
        select(UserStatusHistory)
        .where(where)
        .order_by(UserStatusHistory.created_at.desc(), UserStatusHistory.id.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    return list(rows), total
