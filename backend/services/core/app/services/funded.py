"""챌린지 합격 → 펀디드 계좌 자동 발급 (2026-11-20 사용자 승인).

흐름
1. 최종 판정(대회 종료 10분 뒤 Worker 자동 판정, 또는 종료 후 관리자 '확인하기')으로 챌린지 계좌가 PASSED가 되면
   challenge_evaluation.apply_result가 on_passed를 부른다.
2. 펀디드 상품 = 이 챌린지 상품을 연관 챌린지(related_id)로 지정한 펀디드 상품 (활성 상품 우선).
   없으면 챌린지 상품의 next_product_id가 펀디드 상품이면 그것 (사용자 웹 Start New Challenge 카드와 같은 기준).
   펀디드 상품이 없으면 발급하지 않고 경고 로그만 남긴다 (관리자가 상품을 연결한 뒤 수동 발급 API로 발급).
3. 발급 시각 = 대회 종료 시각(관리자가 먼저 종료했으면 그 시각) + 챌린지 상품의 '펀디드 계좌 자동 생성 시점'
   (funding_start_delay_hours, 0이면 바로). 주말·휴장 기간이면 다음 영업일 같은 시각. 이미 지났으면 지금.
4. 펀디드 계좌 행(발급 대기, QUEUED)을 만들고 발급 시각에 실행되는 MT4 발급 작업을 넣는다.
   작업은 챌린지 계좌와 같은 mt4.provision_challenge_account가 LIVE 서버에 한다 (번호 할당·생성·자본금 입금·재시도).
   발급이 끝나면 바로 거래할 수 있고(ACTIVE) 펀디드 계좌 발급 메일(funding_account_issued)을 보낸다.
   재시도를 다 써서 실패하면 발급 실패(FAILED)로 남고, 관리자가 수동 발급 API로 다시 발급할 수 있다.

중복 발급 방지: 챌린지 계좌 1개당 발급 실패가 아닌 펀디드 계좌는 1개만 (source_account_id 부분 유니크 인덱스).
합격 뒤 관리자가 다시 판정해 FAILED가 되어도 이미 만든 펀디드 계좌는 건드리지 않는다.
결제가 없으므로 주문·매출 분개·추천인 리워드는 없다 (펀디드 승급 리워드는 하지 않기로 함, 2026-11-19).
"""

import logging
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import AppError
from app.models import Challenge, Product, TradingAccount
from app.services import challenge as challenge_svc
from app.services import challenge_order as orders
from app.services import jobs, leaderboard, mt4

logger = logging.getLogger(__name__)

FUNDED = "FUNDED"
ISSUED_MAIL_JOB = "notify.funded_account_issued"


def _now() -> datetime:
    return datetime.now(UTC)


async def funded_product_for(session: AsyncSession, challenge_product: Product) -> Product | None:
    """챌린지 상품에 연결된 펀디드 상품. related_id 연결(활성 우선) → next_product_id 순."""
    linked = await session.scalar(
        select(Product)
        .where(Product.tier_type == FUNDED, Product.related_id == challenge_product.product_id)
        .order_by(Product.is_active.desc(), Product.product_id)
        .limit(1)
    )
    if linked is not None:
        return linked
    if challenge_product.next_product_id:
        nxt = await session.get(Product, challenge_product.next_product_id)
        if nxt is not None and nxt.tier_type == FUNDED:
            return nxt
    return None


async def issue_at(session: AsyncSession, challenge: Challenge, challenge_product: Product, now: datetime) -> datetime:
    """발급 시각: 대회 종료 + N시간, 주말·휴장이면 다음 영업일 같은 시각. 이미 지났으면 지금."""
    hours = challenge_product.funding_start_delay_hours or 0
    at = leaderboard.cutoff(challenge) + timedelta(hours=hours)
    at = challenge_svc.next_trading_datetime(at, await challenge_svc.active_holidays(session))
    return max(at, now)


async def existing_for(session: AsyncSession, source_id: uuid.UUID) -> TradingAccount | None:
    """이 챌린지 계좌로 만든 펀디드 계좌 (발급 실패한 것은 빼고)."""
    return await session.scalar(
        select(TradingAccount).where(
            TradingAccount.source_account_id == source_id, TradingAccount.provision_status != "FAILED"
        )
    )


async def create_for(
    session: AsyncSession, source: TradingAccount, now: datetime | None = None, *, immediate: bool = False
) -> TradingAccount:
    """합격한 챌린지 계좌로 펀디드 계좌를 만들고 발급 작업을 넣는다 (커밋은 호출한 쪽).

    이미 있으면 그 계좌를 돌려준다. immediate=True(관리자 수동 발급)면 생성 시점 설정과 상관없이 지금 발급한다.
    """
    now = now or _now()
    if source.tier != "CHALLENGE" or source.status != "PASSED":
        raise AppError(400, "account_not_passed", "합격(PASSED)한 챌린지 계좌만 펀디드 계좌를 발급할 수 있습니다.")
    found = await existing_for(session, source.id)
    if found is not None:
        return found
    challenge = await session.get(Challenge, source.challenge_id) if source.challenge_id else None
    challenge_product = await session.get(Product, source.product_id)
    if challenge is None or challenge_product is None:
        raise AppError(400, "challenge_not_found", "챌린지 계좌의 대회·상품을 찾을 수 없습니다.")
    product = await funded_product_for(session, challenge_product)
    if product is None:
        raise AppError(
            400, "funded_product_not_linked",
            f"챌린지 상품 {challenge_product.product_id}에 연결된 펀디드 상품이 없습니다. "
            "펀디드 상품의 '연관 챌린지 상품'을 지정해 주세요.",
        )
    at = now if immediate else await issue_at(session, challenge, challenge_product, now)
    account = TradingAccount(
        user_id=source.user_id,
        product_id=product.product_id,
        tier=FUNDED,
        mt4_server=mt4.SERVER_OF_TIER[FUNDED],
        mt4_group=product.mt4_group,
        leverage=product.leverage,
        capital=product.capital,
        type_code=product.type_code,
        unit_price=0,
        status="PENDING",
        is_read_only=True,
        provision_status=orders.QUEUED,
        start_at=at,
        source_account_id=source.id,
    )
    session.add(account)
    await session.flush()
    await jobs.enqueue(
        session, orders.PROVISION_JOB, {"account_id": str(account.id)},
        run_at=at, max_attempts=orders.PROVISION_MAX_ATTEMPTS, dedupe_key=f"provision:{account.id}",
        ref_type="trading_account", ref_id=str(account.id), priority=10,
    )
    logger.info(
        "펀디드 계좌 발급 예약: 챌린지 계좌 %s → 펀디드 %s (상품 %s, %s)",
        source.id, account.id, product.product_id, at.isoformat(),
    )
    return account


async def on_passed(session: AsyncSession, source: TradingAccount, now: datetime | None = None) -> TradingAccount | None:
    """최종 판정 PASSED 직후 (자동 판정·관리자 확인 공통). 펀디드 상품이 없으면 로그만 남기고 None."""
    try:
        async with session.begin_nested():
            return await create_for(session, source, now)
    except AppError as exc:
        logger.warning("펀디드 계좌 자동 발급 안 함: 챌린지 계좌 %s — %s", source.id, exc.message)
        return None


async def mark_issued(session: AsyncSession, account: TradingAccount, now: datetime) -> None:
    """MT4 생성·자본금 입금이 끝난 펀디드 계좌를 발급 완료로 바꾼다 (Worker 작업 안에서).

    발급 작업은 발급 시각(start_at)이 되어야 실행되므로 MT4에도 거래 가능 상태로 만들고, 바로 ACTIVE로 둔다.
    """
    account.provision_status, account.issued_at, account.provision_error = orders.DONE, now, None
    account.status = "ACTIVE"
    account.is_read_only = False
    await jobs.enqueue(
        session, ISSUED_MAIL_JOB, {"account_id": str(account.id)},
        dedupe_key=f"mail:funded_issued:{account.id}", ref_type="trading_account", ref_id=str(account.id),
    )
