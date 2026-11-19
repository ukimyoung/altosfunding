"""추천인 리워드·트레이딩 보너스 (생성·관리자 승인/반려·통계). 경로와 응답 형태는 기존 서버와 같다.

- 추천인 리워드: 피추천인의 첫 챌린지 주문이 완료되면(on_order_completed) 정책 조건이 FIRST_PURCHASE일 때
  추천인 앞으로 PENDING 1건을 만든다. 펀디드 승급 시 지급(FUNDED_UPGRADE)은 하지 않는다.
- 트레이딩 보너스: 수익 정산(payout) 신청 시 만든다. 수익 정산은 아직 Core에 없어서 목록은 비어 있다.
- 승인하면 받는 사람의 통합 지갑에 입금한다.
    추천인 리워드:   차) EXPENSE:REFERRAL_REWARD / 대) LIABILITY:USER_WALLET
    트레이딩 보너스: 차) EXPENSE:TRADING_BONUS   / 대) LIABILITY:USER_WALLET
"""

import logging
import math
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import and_, exists, func, or_, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.errors import AppError
from app.models import ChallengeOrder, RewardRecord, TradingBonusRecord, User
from app.services import reward_policy
from app.services.wallet import USER_WALLET, Line, _change_balance, _post_journal, as_float, get_wallet

logger = logging.getLogger(__name__)

REFERRAL_BONUS = "REFERRAL_BONUS"
REFERRAL_EXPENSE = "EXPENSE:REFERRAL_REWARD"
TRADING_BONUS_EXPENSE = "EXPENSE:TRADING_BONUS"
PENDING, APPROVED, REJECTED = "PENDING", "APPROVED", "REJECTED"
AWAITING_PURCHASE = "AWAITING_PURCHASE"
STATUSES = (PENDING, APPROVED, REJECTED)


def _now() -> datetime:
    return datetime.now(UTC)


def _name(user: User | None) -> str | None:
    if user is None:
        return None
    return f"{user.first_name or ''} {user.last_name or ''}".strip() or None


def _page(items: list, total: int, page: int, size: int) -> dict:
    return {"items": items, "total": total, "page": page, "size": size, "pages": math.ceil(total / size) if total else 0}


def _like(keyword: str) -> str:
    escaped = keyword.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


# ── 생성 ───────────────────────────────────────────────────


async def on_order_completed(session: AsyncSession, order: ChallengeOrder) -> RewardRecord | None:
    """챌린지 주문이 완료(계좌 1개 이상 발급)됐을 때 부른다. 첫 구매면 추천인 리워드를 대기로 만든다.

    같은 트랜잭션 안에서 부르며, 커밋은 부른 쪽이 한다. 피추천인 1명당 1건(부분 유니크 인덱스)이라
    동시에 두 주문이 끝나도 한 건만 생긴다.
    """
    if order.status != "COMPLETED" or order.issued_quantity <= 0:
        return None
    buyer = await session.get(User, order.user_id)
    if buyer is None or buyer.referrer_id is None:
        return None
    policy = await reward_policy.get_policy(session)
    if policy.referral_reward_condition != "FIRST_PURCHASE":
        return None
    amount = Decimal(str(policy.referral_reward_amount)).quantize(Decimal("0.01"))
    if amount <= 0:
        return None
    result = await session.execute(
        pg_insert(RewardRecord)
        .values(
            user_id=buyer.referrer_id,
            source_user_id=buyer.id,
            type=REFERRAL_BONUS,
            amount=amount,
            currency="USDT",
            status=PENDING,
            source_type="challenge_order",
            source_id=order.id,
            description=f"Referral Bonus (First Purchase by {buyer.email})",
        )
        .on_conflict_do_nothing(index_elements=["source_user_id"], index_where=text("type = 'REFERRAL_BONUS'"))  # 바인드 파라미터 금지 (PR #69 교훈)
        .returning(RewardRecord.id)
    )
    reward_id = result.scalar_one_or_none()
    if reward_id is None:
        return None
    logger.info("추천인 리워드 대기 생성: reward=%s referrer=%s referee=%s", reward_id, buyer.referrer_id, buyer.id)
    return await session.get(RewardRecord, reward_id)


# ── 추천인 리워드 (관리자) ────────────────────────────────────


async def referral_stats(session: AsyncSession) -> dict:
    async def _sum(status: str) -> float:
        value = await session.scalar(
            select(func.coalesce(func.sum(RewardRecord.amount), 0)).where(
                RewardRecord.type == REFERRAL_BONUS, RewardRecord.status == status
            )
        )
        return float(value or 0)

    approved = await _sum(APPROVED)
    active = await session.scalar(
        select(func.count()).select_from(User).where(User.referrer_id.is_not(None), User.status == "ACTIVE")
    )
    return {
        "total_accumulated": approved,
        "total_approved": approved,
        "total_pending": await _sum(PENDING),
        "active_referrals": active or 0,
    }


def _referral_query(status: str | None, keyword: str | None):
    """추천 관계(피추천인 기준) + 추천인 리워드. 첫 구매 전 관계도 포함한다."""
    referee = aliased(User, name="referee")
    referrer = aliased(User, name="referrer")
    stmt = (
        select(referee, referrer, RewardRecord)
        .join(referrer, referee.referrer_id == referrer.id)
        .outerjoin(
            RewardRecord,
            and_(
                RewardRecord.source_user_id == referee.id,
                RewardRecord.user_id == referrer.id,
                RewardRecord.type == REFERRAL_BONUS,
            ),
        )
    )
    if status:
        normalized = status.upper()
        if normalized == AWAITING_PURCHASE:
            stmt = stmt.where(RewardRecord.id.is_(None))
        elif normalized == PENDING:
            # 기존 서버와 같이 '대기'에는 구매 전 추천도 함께 보인다.
            stmt = stmt.where(or_(RewardRecord.id.is_(None), RewardRecord.status == PENDING))
        elif normalized in STATUSES:
            stmt = stmt.where(RewardRecord.status == normalized)
        else:
            raise AppError(422, "invalid_status", "상태는 PENDING, APPROVED, REJECTED, AWAITING_PURCHASE 중 하나여야 합니다.")
    keyword = (keyword or "").strip()
    if keyword:
        pattern = _like(keyword)
        stmt = stmt.where(
            or_(
                referee.email.ilike(pattern),
                referee.first_name.ilike(pattern),
                referee.last_name.ilike(pattern),
                referrer.email.ilike(pattern),
                referrer.first_name.ilike(pattern),
                referrer.last_name.ilike(pattern),
                referrer.referral_code.ilike(pattern),
            )
        )
    return stmt, referee


def _reward_out(reward: RewardRecord | None, referee: User, referrer: User) -> dict:
    base = {
        "user_id": str(referrer.id),
        "user_name": _name(referrer),
        "user_email": referrer.email,
        "referral_code": referrer.referral_code,
        "source_user_id": str(referee.id),
        "source_user_name": _name(referee),
        "source_user_email": referee.email,
    }
    if reward is None:
        return {
            "id": 0,
            **base,
            "type": REFERRAL_BONUS,
            "amount": 0.0,
            "currency": "USDT",
            "status": AWAITING_PURCHASE,
            "description": f"Referral registered (awaiting first purchase by {referee.email})",
            "approved_at": None,
            "approved_by": None,
            "rejected_at": None,
            "rejected_by": None,
            "rejection_reason": None,
            "created_at": referee.created_at,
            "updated_at": referee.created_at,
        }
    return {
        "id": reward.id,
        **base,
        "type": reward.type,
        "amount": as_float(reward.amount),
        "currency": reward.currency,
        "status": reward.status,
        "description": reward.description,
        "approved_at": reward.approved_at,
        "approved_by": str(reward.approved_by) if reward.approved_by else None,
        "rejected_at": reward.rejected_at,
        "rejected_by": str(reward.rejected_by) if reward.rejected_by else None,
        "rejection_reason": reward.rejection_reason,
        "created_at": reward.created_at,
        "updated_at": reward.updated_at,
    }


async def list_referral_rewards(
    session: AsyncSession, *, status: str | None, keyword: str | None, page: int, size: int
) -> dict:
    stmt, referee = _referral_query(status, keyword)
    total = await session.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = await session.execute(stmt.order_by(referee.created_at.desc(), referee.id).offset((page - 1) * size).limit(size))
    items = [_reward_out(rw, re, rr) for re, rr, rw in rows.all()]
    return _page(items, total, page, size)


async def list_referral_links(session: AsyncSession, *, keyword: str | None, page: int, size: int) -> dict:
    """추천 관계 목록 (가입 기준, 구매 전 포함). 기존 서버 GET /admin/rewards/referral-links."""
    stmt, referee = _referral_query(None, keyword)
    total = await session.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = await session.execute(stmt.order_by(referee.created_at.desc(), referee.id).offset((page - 1) * size).limit(size))
    data = rows.all()
    ids = [re.id for re, _, _ in data]
    purchased: set = set()
    if ids:
        purchased = set(
            await session.scalars(
                select(ChallengeOrder.user_id)
                .where(ChallengeOrder.user_id.in_(ids), ChallengeOrder.status == "COMPLETED")
                .distinct()
            )
        )
    items = [
        {
            "referee_user_id": str(re.id),
            "referee_name": _name(re),
            "referee_email": re.email,
            "referee_registered_at": re.created_at,
            "referrer_user_id": str(rr.id),
            "referrer_name": _name(rr),
            "referrer_email": rr.email,
            "referrer_code": rr.referral_code,
            "has_completed_purchase": re.id in purchased,
            "reward_id": rw.id if rw else None,
            "reward_status": rw.status if rw else None,
            "reward_amount": as_float(rw.amount) if rw else None,
        }
        for re, rr, rw in data
    ]
    return _page(items, total, page, size)


def _reason(reason: str) -> str:
    reason = (reason or "").strip()
    if not reason:
        raise AppError(422, "rejection_reason_required", "반려 사유를 입력해 주세요.")
    return reason


async def _lock(session: AsyncSession, model, record_id: int, label: str):
    record = await session.scalar(select(model).where(model.id == record_id).with_for_update())
    if record is None:
        raise AppError(404, "reward_not_found", f"{label}을(를) 찾을 수 없습니다.")
    if record.status != PENDING:
        raise AppError(400, "invalid_status", "대기(PENDING) 상태만 처리할 수 있습니다.")
    return record


async def _credit(
    session: AsyncSession,
    *,
    user_id,
    amount: Decimal,
    expense_account: str,
    entry_type: str,
    tx_type: str,
    description: str,
    reference_type: str,
    reference_id: int,
    admin: User,
) -> int:
    wallet = await get_wallet(session, user_id, lock=True)
    journal = await _post_journal(
        session,
        entry_type=entry_type,
        description=f"{description} — {amount} USDT",
        lines=[Line(expense_account, debit=amount), Line(USER_WALLET, credit=amount, user_id=user_id)],
        reference_type=reference_type,
        reference_id=reference_id,
        created_by=admin.id,
    )
    tx = await _change_balance(
        session, wallet, tx_type=tx_type, direction="IN", amount=amount,
        description=description, journal=journal, reference_type=reference_type, reference_id=reference_id,
    )
    return tx.id


async def approve_referral_reward(session: AsyncSession, admin: User, reward_id: int) -> None:
    reward: RewardRecord = await _lock(session, RewardRecord, reward_id, "리워드")
    if reward.source_user_id is not None:
        purchased = await session.scalar(
            select(
                exists().where(ChallengeOrder.user_id == reward.source_user_id, ChallengeOrder.status == "COMPLETED")
            )
        )
        if not purchased:
            raise AppError(
                400,
                "no_purchase_history",
                "피추천인의 챌린지 구매(계좌 발급 완료) 이력이 없어 리워드를 지급할 수 없습니다.",
            )
    reward.wallet_tx_id = await _credit(
        session,
        user_id=reward.user_id,
        amount=reward.amount,
        expense_account=REFERRAL_EXPENSE,
        entry_type="REFERRAL_REWARD",
        tx_type="REFERRAL_REWARD",
        description=f"추천인 리워드 지급 (#{reward.id})",
        reference_type="reward_record",
        reference_id=reward.id,
        admin=admin,
    )
    reward.status, reward.approved_by, reward.approved_at = APPROVED, admin.id, _now()
    await session.commit()


async def reject_referral_reward(session: AsyncSession, admin: User, reward_id: int, reason: str) -> None:
    reason = _reason(reason)
    reward: RewardRecord = await _lock(session, RewardRecord, reward_id, "리워드")
    reward.status, reward.rejected_by, reward.rejected_at = REJECTED, admin.id, _now()
    reward.rejection_reason = reason
    await session.commit()


# ── 트레이딩 보너스 (관리자) ──────────────────────────────────


async def trading_bonus_stats(session: AsyncSession) -> dict:
    async def _sum(status: str) -> float:
        value = await session.scalar(
            select(func.coalesce(func.sum(TradingBonusRecord.bonus_amount), 0)).where(
                TradingBonusRecord.status == status
            )
        )
        return float(value or 0)

    approved = await _sum(APPROVED)
    policy = await reward_policy.get_policy(session)
    return {
        "total_accumulated": approved,
        "total_approved": approved,
        "total_pending": await _sum(PENDING),
        "trading_bonus_rate": float(policy.trading_bonus_rate),
    }


async def list_trading_bonuses(
    session: AsyncSession, *, status: str | None, keyword: str | None, page: int, size: int
) -> dict:
    stmt = select(TradingBonusRecord, User).outerjoin(User, TradingBonusRecord.user_id == User.id)
    if status:
        normalized = status.upper()
        if normalized not in STATUSES:
            raise AppError(422, "invalid_status", "상태는 PENDING, APPROVED, REJECTED 중 하나여야 합니다.")
        stmt = stmt.where(TradingBonusRecord.status == normalized)
    keyword = (keyword or "").strip()
    if keyword:
        pattern = _like(keyword)
        conds = [User.email.ilike(pattern), User.first_name.ilike(pattern), User.last_name.ilike(pattern)]
        if keyword.isdigit():
            conds.append(TradingBonusRecord.mt4_login == int(keyword))
        stmt = stmt.where(or_(*conds))
    total = await session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = await session.execute(
        stmt.order_by(TradingBonusRecord.created_at.desc(), TradingBonusRecord.id.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    items = [
        {
            "id": b.id,
            "user_id": str(b.user_id),
            "user_name": _name(u),
            "user_email": u.email if u else None,
            "payout_request_id": b.payout_request_id,
            "mt4_login": b.mt4_login,
            "trader_profit": as_float(b.trader_profit),
            "profit_split_pct": float(b.profit_split_pct) if b.profit_split_pct is not None else None,
            "company_share": as_float(b.company_share),
            "bonus_rate": float(b.bonus_rate),
            "bonus_amount": as_float(b.bonus_amount),
            "status": b.status,
            "approved_by": str(b.approved_by) if b.approved_by else None,
            "approved_at": b.approved_at,
            "rejected_by": str(b.rejected_by) if b.rejected_by else None,
            "rejected_at": b.rejected_at,
            "rejection_reason": b.rejection_reason,
            "created_at": b.created_at,
            "updated_at": b.updated_at,
        }
        for b, u in rows.all()
    ]
    return _page(items, total, page, size)


async def approve_trading_bonus(session: AsyncSession, admin: User, bonus_id: int) -> None:
    bonus: TradingBonusRecord = await _lock(session, TradingBonusRecord, bonus_id, "트레이딩 보너스")
    bonus.wallet_tx_id = await _credit(
        session,
        user_id=bonus.user_id,
        amount=bonus.bonus_amount,
        expense_account=TRADING_BONUS_EXPENSE,
        entry_type="TRADING_BONUS",
        tx_type="TRADING_BONUS",
        description=f"트레이딩 보너스 지급 (#{bonus.id})",
        reference_type="trading_bonus",
        reference_id=bonus.id,
        admin=admin,
    )
    bonus.status, bonus.approved_by, bonus.approved_at = APPROVED, admin.id, _now()
    await session.commit()


async def reject_trading_bonus(session: AsyncSession, admin: User, bonus_id: int, reason: str) -> None:
    reason = _reason(reason)
    bonus: TradingBonusRecord = await _lock(session, TradingBonusRecord, bonus_id, "트레이딩 보너스")
    bonus.status, bonus.rejected_by, bonus.rejected_at = REJECTED, admin.id, _now()
    bonus.rejection_reason = reason
    await session.commit()


# ── 회원 본인 ────────────────────────────────────────────────


async def my_rewards(
    session: AsyncSession, user: User, *, type_: str | None, status: str | None, page: int, size: int
) -> dict:
    """내 리워드 이력 (추천인 리워드 + 트레이딩 보너스). 기존 서버 GET /rewards/mine."""
    type_ = (type_ or "").upper() or None
    status = (status or "").upper() or None
    records: list[dict] = []
    if type_ != "TRADING_BONUS":
        source = aliased(User, name="source")
        stmt = (
            select(RewardRecord, source.email)
            .outerjoin(source, RewardRecord.source_user_id == source.id)
            .where(RewardRecord.user_id == user.id)
        )
        if type_:
            stmt = stmt.where(RewardRecord.type == type_)
        if status:
            stmt = stmt.where(RewardRecord.status == status)
        for r, source_email in (await session.execute(stmt)).all():
            records.append({
                "id": r.id, "type": r.type, "amount": as_float(r.amount), "currency": r.currency,
                "status": r.status, "description": r.description, "rejection_reason": r.rejection_reason,
                # 웹에서 언어별 설명('피추천인 첫 구매. (구매자 : ...)')을 만들 때 쓴다 (기존 서버 응답에는 없던 필드).
                "source_user_email": source_email,
                "created_at": r.created_at.isoformat(),
                "credited_at": r.approved_at.isoformat() if r.approved_at else None,
            })
    if type_ in (None, "TRADING_BONUS"):
        stmt = select(TradingBonusRecord).where(TradingBonusRecord.user_id == user.id)
        if status:
            stmt = stmt.where(TradingBonusRecord.status == status)
        for b in await session.scalars(stmt):
            records.append({
                "id": b.id, "type": "TRADING_BONUS", "amount": as_float(b.bonus_amount), "currency": "USDT",
                "status": b.status, "description": f"Trading Bonus for Payout #{b.payout_request_id}",
                "source_user_email": None,
                "rejection_reason": b.rejection_reason, "created_at": b.created_at.isoformat(),
                "credited_at": b.approved_at.isoformat() if b.approved_at else None,
            })
    records.sort(key=lambda x: x["created_at"], reverse=True)
    total = len(records)
    return _page(records[(page - 1) * size : page * size], total, page, size)


async def my_summary(session: AsyncSession, user: User) -> dict:
    """리워드 집계 (총액·유형별). 기존 서버 GET /rewards/summary."""
    async def _sum(model, col, status):
        value = await session.scalar(
            select(func.coalesce(func.sum(col), 0)).where(model.user_id == user.id, model.status == status)
        )
        return float(value or 0)

    by_type = [
        {"type": t, "total": float(total), "count": count}
        for t, total, count in (
            await session.execute(
                select(RewardRecord.type, func.sum(RewardRecord.amount), func.count())
                .where(RewardRecord.user_id == user.id, RewardRecord.status == APPROVED)
                .group_by(RewardRecord.type)
            )
        ).all()
    ]
    tb_total = await _sum(TradingBonusRecord, TradingBonusRecord.bonus_amount, APPROVED)
    tb_count = await session.scalar(
        select(func.count()).where(TradingBonusRecord.user_id == user.id, TradingBonusRecord.status == APPROVED)
    )
    if tb_count:
        by_type.append({"type": "TRADING_BONUS", "total": tb_total, "count": tb_count})
    referral_count = await session.scalar(select(func.count()).select_from(User).where(User.referrer_id == user.id))
    return {
        "total_credited": await _sum(RewardRecord, RewardRecord.amount, APPROVED) + tb_total,
        "total_pending": await _sum(RewardRecord, RewardRecord.amount, PENDING)
        + await _sum(TradingBonusRecord, TradingBonusRecord.bonus_amount, PENDING),
        "by_type": by_type,
        "referral_count": referral_count or 0,
        "referral_code": user.referral_code,
    }
