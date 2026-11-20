"""상품·룰셋 관리."""

import json
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import AppError
from app.models import PlatformConfig, Product, Ruleset
from app.schemas.catalog import ConfigItemOut, DemoOptionsResponse, ProductOut, RulesetOut
from app.security import generate_human_code
from app.services import reward_policy

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
                "pass_condition_vip_pct", "pass_condition_vip_amt", "profit_target_pct",
                "consistency_pct", "daily_loss_limit_amt", "profit_target_amt"}
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


# 상품코드 4자리: 앞자리 티어 + 티어별 일련번호 3자리 (예: 1001)
TIER_CODE_PREFIX = {"CHALLENGE": "1", "FUNDED": "2", "DEMO": "3", "LIVE": "4"}


async def _generate_product_id(session: AsyncSession, tier_type: str) -> str:
    prefix = TIER_CODE_PREFIX[tier_type]
    last = await session.scalar(
        select(func.max(Product.product_id)).where(Product.product_id.like(f"{prefix}___"))
    )
    seq = int(last[1:]) + 1 if last else 1
    if seq > 999:
        raise AppError(409, "product_code_exhausted", "이 티어의 상품코드(999개)를 모두 사용했습니다.")
    return f"{prefix}{seq:03d}"


async def _validate_product(session: AsyncSession, product: Product) -> None:
    # 검증 쿼리가 아직 확인 전인 변경을 먼저 DB에 보내지 않도록 한다.
    with session.no_autoflush:
        await _check_product(session, product)


async def _check_product(session: AsyncSession, product: Product) -> None:
    if product.discount_price_usdt is not None and Decimal(str(product.discount_price_usdt)) > Decimal(str(product.price_usdt)):
        raise AppError(400, "invalid_discount_price", "할인가격은 원가격보다 클 수 없습니다.")
    if product.mt4_login_pool_start > product.mt4_login_pool_end:
        raise AppError(400, "invalid_login_pool", "계좌번호 범위의 시작이 끝보다 클 수 없습니다.")
    if product.ruleset_id and not await session.get(Ruleset, product.ruleset_id):
        raise AppError(400, "ruleset_not_found", "존재하지 않는 룰셋입니다.")
    if product.next_product_id:
        if product.next_product_id == product.product_id:
            raise AppError(400, "invalid_next_product", "다음 단계 상품으로 자기 자신을 지정할 수 없습니다.")
        if not await session.get(Product, product.next_product_id):
            raise AppError(400, "next_product_not_found", "존재하지 않는 다음 단계 상품입니다.")
    if product.related_id:
        await _check_related(session, product)

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


async def _check_related(session: AsyncSession, product: Product) -> None:
    """펀디드 상품의 연관 챌린지 상품. 챌린지 상품 하나에는 펀디드 상품 하나만 연결한다."""
    if product.tier_type != "FUNDED":
        raise AppError(400, "invalid_related_product", "연관 챌린지 상품은 펀디드 상품에만 지정할 수 있습니다.")
    related = await session.get(Product, product.related_id)
    if related is None:
        raise AppError(400, "related_product_not_found", "존재하지 않는 챌린지 상품입니다.")
    if related.tier_type != "CHALLENGE":
        raise AppError(400, "invalid_related_product", "연관 상품은 챌린지 상품이어야 합니다.")
    linked = await session.scalar(
        select(Product.product_id).where(
            Product.related_id == product.related_id, Product.product_id != product.product_id
        ).limit(1)
    )
    if linked:
        raise AppError(
            409, "related_product_taken",
            f"챌린지 상품 {product.related_id}에는 이미 펀디드 상품({linked})이 연결되어 있습니다.",
        )


async def create_product(session: AsyncSession, data: dict) -> Product:
    product_id = await _generate_product_id(session, data["tier_type"])
    product = Product(product_id=product_id, **data)
    await _validate_product(session, product)
    session.add(product)
    await session.flush()
    return product


_NULLABLE_PRODUCT_FIELDS = {
    "type_code", "description", "ruleset_id", "next_product_id", "margin_call_pct", "stop_out_pct", "discount_price_usdt",
    "related_id",
}


async def update_product(session: AsyncSession, product: Product, data: dict) -> None:
    # 상품코드 앞자리가 티어라서 만든 뒤에는 티어를 바꿀 수 없다.
    if data.get("tier_type") is not None and data["tier_type"] != product.tier_type:
        raise AppError(400, "tier_type_immutable", "상품의 티어는 바꿀 수 없습니다.")
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
    leverages = values["allowed_leverages"] or _DEMO_DEFAULTS["allowed_leverages"]
    capitals = values["allowed_capitals"] or _DEMO_DEFAULTS["allowed_capitals"]
    # 관리자가 선택지를 바꾸는 중에 기본값이 목록에서 빠질 수 있다. 그때는 목록의 첫 값을 기본값으로 쓴다.
    default_leverage = values["default_leverage"]
    if default_leverage not in leverages:
        default_leverage = leverages[0]
    default_capital = values["default_capital"]
    if default_capital not in capitals:
        default_capital = capitals[0]
    return DemoOptionsResponse(
        allowed_leverages=leverages,
        allowed_capitals=capitals,
        default_leverage=default_leverage,
        default_capital=default_capital,
    )


# ── 플랫폼 설정 (관리자) ────────────────────────────────────

# 데모 계좌 선택지는 화면과 계좌 생성 검증에 바로 쓰이므로 키와 값 형태를 검사한다.
_DEMO_LIST_KEYS = {"allowed_leverages": int, "allowed_capitals": float}
_DEMO_NUMBER_KEYS = {"default_leverage": int, "default_capital": float}
_DEMO_MAX_OPTIONS = 20


def _invalid(message: str) -> AppError:
    return AppError(422, "invalid_config_value", message)


def _value_type_of(value: object) -> str:
    if isinstance(value, bool):
        return "BOOLEAN"
    if isinstance(value, int):
        return "INTEGER"
    if isinstance(value, float):
        return "FLOAT"
    if isinstance(value, str):
        return "STRING"
    return "JSON"


def _coerce(value: object, value_type: str) -> object:
    """기존 서버 클라이언트는 값을 문자열로 보내기도 하므로 value_type에 맞춰 바꾼다."""
    if not isinstance(value, str) or value_type == "STRING":
        return value
    try:
        if value_type == "INTEGER":
            return int(value)
        if value_type == "FLOAT":
            return float(value)
        if value_type == "BOOLEAN":
            return value.strip().lower() in ("true", "1", "yes")
        return json.loads(value)
    except ValueError as exc:
        raise _invalid(f"값을 {value_type}로 읽을 수 없습니다.") from exc


def _positive_number(value: object, kind: type, label: str) -> int | float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise _invalid(f"{label}은(는) 숫자여야 합니다.")
    if kind is int and value != int(value):
        raise _invalid(f"{label}은(는) 정수여야 합니다.")
    if value <= 0:
        raise _invalid(f"{label}은(는) 0보다 커야 합니다.")
    return int(value) if kind is int or value == int(value) else value


def _validate_demo_value(key: str, value: object) -> object:
    if key in _DEMO_LIST_KEYS:
        if not isinstance(value, list) or not value:
            raise _invalid("선택지는 하나 이상 있어야 합니다.")
        if len(value) > _DEMO_MAX_OPTIONS:
            raise _invalid(f"선택지는 {_DEMO_MAX_OPTIONS}개까지 등록할 수 있습니다.")
        items = [_positive_number(v, _DEMO_LIST_KEYS[key], "선택지 값") for v in value]
        if len(set(items)) != len(items):
            raise _invalid("같은 값을 두 번 등록할 수 없습니다.")
        return items
    if key in _DEMO_NUMBER_KEYS:
        return _positive_number(value, _DEMO_NUMBER_KEYS[key], "기본값")
    raise _invalid(f"DEMO 설정에는 {key} 키를 쓸 수 없습니다.")


def config_item_out(config: PlatformConfig) -> ConfigItemOut:
    return ConfigItemOut(
        scope=config.scope,
        key=config.key,
        value=config.value,
        value_type=_value_type_of(config.value),
        description=config.description,
        updated_at=config.updated_at,
    )


async def list_configs(session: AsyncSession, scope: str) -> list[ConfigItemOut]:
    rows = await session.scalars(
        select(PlatformConfig).where(PlatformConfig.scope == scope).order_by(PlatformConfig.key)
    )
    return [config_item_out(c) for c in rows]


async def upsert_config(
    session: AsyncSession, scope: str, key: str, value: object, value_type: str, description: str | None
) -> PlatformConfig:
    value = _coerce(value, value_type)
    if scope == "DEMO":
        value = _validate_demo_value(key, value)
    elif scope == reward_policy.SCOPE:
        value = reward_policy.validate_value(key, value)
    config = await session.get(PlatformConfig, (scope, key), with_for_update=True)
    if config is None:
        config = PlatformConfig(scope=scope, key=key, value=value, description=description)
        session.add(config)
    else:
        config.value = value
        if description is not None:
            config.description = description
    await session.flush()
    await session.refresh(config)
    return config
