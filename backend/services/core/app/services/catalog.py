"""상품·룰셋 관리."""

import re

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import AppError
from app.models import PlatformConfig, Product, Ruleset
from app.schemas.catalog import DemoOptionsResponse, ProductOut, RulesetOut
from app.security import generate_human_code

# 같은 MT4 서버를 쓰는 상품끼리는 계좌번호 범위가 겹치면 안 된다.
# 챌린지·데모는 데모 서버, 펀디드·라이브는 실서버를 쓴다.
MT4_SERVER_OF_TIER = {"CHALLENGE": "demo", "DEMO": "demo", "FUNDED": "live", "LIVE": "live"}


# ── 룰셋 ────────────────────────────────────────────────────


async def _ruleset_product_counts(session: AsyncSession, ids: list[str]) -> dict[str, int]:
    if not ids:
        return {}
    rows = await session.execute(
        select(Product.ruleset_id, func.count()).where(Product.ruleset_id.in_(ids)).group_by(Product.ruleset_id)
    )
    return dict(rows.all())


async def ruleset_out(session: AsyncSession, ruleset: Ruleset) -> RulesetOut:
    await session.refresh(ruleset)
    counts = await _ruleset_product_counts(session, [ruleset.id])
    return RulesetOut.model_validate(ruleset).model_copy(
        update={"connected_products_count": counts.get(ruleset.id, 0)}
    )


async def list_rulesets(session: AsyncSession, page: int, size: int) -> tuple[list[RulesetOut], int]:
    total = await session.scalar(select(func.count()).select_from(Ruleset)) or 0
    rows = list(
        await session.scalars(
            select(Ruleset).order_by(Ruleset.created_at.desc(), Ruleset.id).offset((page - 1) * size).limit(size)
        )
    )
    counts = await _ruleset_product_counts(session, [r.id for r in rows])
    items = [
        RulesetOut.model_validate(r).model_copy(update={"connected_products_count": counts.get(r.id, 0)})
        for r in rows
    ]
    return items, total


async def get_ruleset(session: AsyncSession, ruleset_id: str) -> Ruleset:
    ruleset = await session.get(Ruleset, ruleset_id)
    if ruleset is None:
        raise AppError(404, "not_found", "ruleset not found")
    return ruleset


async def create_ruleset(session: AsyncSession, data: dict) -> Ruleset:
    ruleset_id = data.pop("id", None)
    if ruleset_id:
        if await session.get(Ruleset, ruleset_id):
            raise AppError(409, "ruleset_already_exists", "이미 있는 룰셋 ID입니다.")
    else:
        for _ in range(10):
            ruleset_id = f"RS-{generate_human_code(6)}"
            if not await session.get(Ruleset, ruleset_id):
                break
    ruleset = Ruleset(id=ruleset_id, **data)
    session.add(ruleset)
    await session.flush()
    return ruleset


def update_ruleset(ruleset: Ruleset, data: dict) -> None:
    nullable = {"max_dd_normal_amt", "max_dd_vip_amt", "stop_out_pct", "pass_condition_pct", "pass_condition_amt",
                "pass_condition_vip_pct", "pass_condition_vip_amt", "profit_target_pct"}
    for field, value in data.items():
        # 값이 필요한 항목에 null이 오면 바꾸지 않는다.
        if value is None and field not in nullable:
            continue
        setattr(ruleset, field, value)


# ── 상품 ────────────────────────────────────────────────────


def product_out(product: Product, ruleset_name: str | None) -> ProductOut:
    return ProductOut.model_validate(product).model_copy(update={"ruleset_name": ruleset_name})


async def list_products(
    session: AsyncSession, *, tier_type: str | None, active_only: bool, page: int, size: int
) -> tuple[list[ProductOut], int]:
    conditions = []
    if tier_type:
        conditions.append(Product.tier_type == tier_type)
    if active_only:
        conditions.append(Product.is_active.is_(True))
    total = await session.scalar(select(func.count()).select_from(Product).where(*conditions)) or 0
    rows = await session.execute(
        select(Product, Ruleset.name)
        .outerjoin(Ruleset, Ruleset.id == Product.ruleset_id)
        .where(*conditions)
        .order_by(Product.tier_type, Product.capital, Product.product_id)
        .offset((page - 1) * size)
        .limit(size)
    )
    return [product_out(p, name) for p, name in rows.all()], total


async def get_product(session: AsyncSession, product_id: str, *, lock: bool = False) -> Product:
    product = await session.get(Product, product_id, with_for_update=lock)
    if product is None:
        raise AppError(404, "not_found", "product not found")
    return product


async def product_out_with_ruleset(session: AsyncSession, product: Product) -> ProductOut:
    await session.refresh(product)
    name = await session.scalar(select(Ruleset.name).where(Ruleset.id == product.ruleset_id)) if product.ruleset_id else None
    return product_out(product, name)


def _capital_label(capital: float) -> str:
    if capital >= 1000 and capital % 1000 == 0:
        return f"{int(capital // 1000)}K"
    return re.sub(r"\.0+$", "", f"{capital:g}").replace(".", "_")


async def _generate_product_id(session: AsyncSession, tier_type: str, capital: float) -> str:
    base = f"{tier_type}_{_capital_label(capital)}"
    candidate, n = base, 1
    while await session.get(Product, candidate):
        n += 1
        candidate = f"{base}_{n}"
    return candidate


async def _validate_product(session: AsyncSession, product: Product) -> None:
    # 검증 쿼리가 아직 확인 전인 변경을 먼저 DB에 보내지 않도록 한다.
    with session.no_autoflush:
        await _check_product(session, product)


async def _check_product(session: AsyncSession, product: Product) -> None:
    if product.mt4_login_pool_start > product.mt4_login_pool_end:
        raise AppError(400, "invalid_login_pool", "계좌번호 범위의 시작이 끝보다 클 수 없습니다.")
    if product.ruleset_id and not await session.get(Ruleset, product.ruleset_id):
        raise AppError(400, "ruleset_not_found", "존재하지 않는 룰셋입니다.")
    if product.next_product_id:
        if product.next_product_id == product.product_id:
            raise AppError(400, "invalid_next_product", "다음 단계 상품으로 자기 자신을 지정할 수 없습니다.")
        if not await session.get(Product, product.next_product_id):
            raise AppError(400, "next_product_not_found", "존재하지 않는 다음 단계 상품입니다.")

    same_server = [t for t, s in MT4_SERVER_OF_TIER.items() if s == MT4_SERVER_OF_TIER[product.tier_type]]
    overlap = await session.scalar(
        select(Product.product_id).where(
            Product.product_id != product.product_id,
            Product.tier_type.in_(same_server),
            Product.mt4_login_pool_start <= product.mt4_login_pool_end,
            Product.mt4_login_pool_end >= product.mt4_login_pool_start,
        ).limit(1)
    )
    if overlap:
        raise AppError(
            409, "login_pool_overlap",
            f"계좌번호 범위가 같은 MT4 서버를 쓰는 상품({overlap})과 겹칩니다.",
        )


async def create_product(session: AsyncSession, data: dict) -> Product:
    product_id = data.pop("product_id", None)
    if product_id:
        if await session.get(Product, product_id):
            raise AppError(409, "product_already_exists", "이미 있는 상품 ID입니다.")
    else:
        product_id = await _generate_product_id(session, data["tier_type"], data["capital"])
    product = Product(product_id=product_id, **data)
    await _validate_product(session, product)
    session.add(product)
    await session.flush()
    return product


_NULLABLE_PRODUCT_FIELDS = {"type_code", "description", "ruleset_id", "next_product_id", "margin_call_pct", "stop_out_pct"}


async def update_product(session: AsyncSession, product: Product, data: dict) -> None:
    for field, value in data.items():
        if value is None and field not in _NULLABLE_PRODUCT_FIELDS:
            continue
        setattr(product, field, value)
    if product.last_mt4_login is not None and not (
        product.mt4_login_pool_start <= product.last_mt4_login <= product.mt4_login_pool_end
    ):
        # 이미 발급한 번호가 새 범위 밖이면, 다음 발급은 새 범위의 처음부터 한다.
        product.last_mt4_login = None
    await _validate_product(session, product)


# ── 데모 계좌 옵션 ──────────────────────────────────────────

_DEMO_DEFAULTS = {
    "allowed_leverages": [100, 200, 500],
    "allowed_capitals": [10000, 50000, 100000],
    "default_leverage": 100,
    "default_capital": 10000,
}


async def demo_options(session: AsyncSession) -> DemoOptionsResponse:
    rows = await session.execute(select(PlatformConfig.key, PlatformConfig.value).where(PlatformConfig.scope == "DEMO"))
    values = {**_DEMO_DEFAULTS, **dict(rows.all())}
    return DemoOptionsResponse(**{k: values[k] for k in _DEMO_DEFAULTS})
