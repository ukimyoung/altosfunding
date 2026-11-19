"""데모 계좌 생성 (웹 My Account > 데모 계좌 만들기).

기존 서버와 같은 검증: DEMO 상품만, 레버리지·자본금은 platform_config(DEMO)의 선택지 안에서.
MT4 그룹·번호 범위는 상품 값만 쓴다. MT4 계좌 생성·자본금 입금은 챌린지 계좌와 같은 Worker 작업
(mt4.provision_challenge_account)이 한다. 요청은 바로 응답하고 계좌는 '발급 중'(QUEUED)으로 보인다.
발급이 끝나면 ACTIVE(거래 가능). 끝내 실패하면 발급 실패(FAILED)로 남고 목록에서 빠진다 (결제가 없어 환불할 것은 없다).
"""

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import AppError
from app.models import Product, TradingAccount, User
from app.services import catalog, jobs, mt4
from app.services import challenge_order as orders

# 기존 웹이 보내던 상품 ID. Core 상품코드(3xxx)가 아니면 사용 중인 첫 DEMO 상품을 쓴다.
LEGACY_PRODUCT_IDS = ("DEMO_STD",)


async def _demo_product(session: AsyncSession, product_id: str | None) -> Product:
    if product_id and product_id not in LEGACY_PRODUCT_IDS:
        product = await session.get(Product, product_id)
        if product is None or not product.is_active:
            raise AppError(404, "product_not_found", "데모 상품을 찾을 수 없습니다.")
        if product.tier_type != "DEMO":
            raise AppError(400, "invalid_product_tier", f"상품({product_id})은 데모 계좌 생성용 상품이 아닙니다.")
        return product
    product = await session.scalar(
        select(Product)
        .where(Product.tier_type == "DEMO", Product.is_active.is_(True))
        .order_by(Product.product_id)
        .limit(1)
    )
    if product is None:
        raise AppError(400, "demo_product_not_found", "사용 중인 데모 상품이 없습니다. 관리자에게 문의해주세요.")
    return product


async def create(session: AsyncSession, user: User, product_id: str | None, capital: float, leverage: int) -> TradingAccount:
    product = await _demo_product(session, product_id)
    options = await catalog.demo_options(session)
    if leverage not in options.allowed_leverages:
        raise AppError(400, "invalid_leverage", f"허용되지 않는 레버리지입니다. 허용 목록: {options.allowed_leverages}")
    if not any(float(capital) == float(c) for c in options.allowed_capitals):
        raise AppError(400, "invalid_capital", f"허용되지 않는 자본금입니다. 허용 목록: {options.allowed_capitals}")

    account = TradingAccount(
        user_id=user.id,
        product_id=product.product_id,
        tier="DEMO",
        mt4_server=mt4.SERVER_OF_TIER["DEMO"],
        mt4_group=product.mt4_group,
        leverage=leverage,
        capital=Decimal(str(capital)),
        type_code=product.type_code,
        unit_price=Decimal(0),
        status="PENDING",
        is_read_only=False,
        provision_status=orders.QUEUED,
    )
    session.add(account)
    await session.flush()
    await jobs.enqueue(
        session, orders.PROVISION_JOB, {"account_id": str(account.id)},
        max_attempts=orders.PROVISION_MAX_ATTEMPTS, dedupe_key=f"provision:{account.id}",
        ref_type="trading_account", ref_id=str(account.id), priority=10,
    )
    await session.commit()
    return account
