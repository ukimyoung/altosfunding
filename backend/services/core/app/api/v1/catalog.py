"""상품·룰셋 API. 경로와 응답 형태는 기존 서버와 같다."""

import math
from typing import Annotated

from fastapi import APIRouter, Path, Query

from app.api.v1.auth import Session
from app.deps import AdminUser
from app.schemas.catalog import (
    ConfigItemOut,
    ConfigScope,
    ConfigUpsertRequest,
    DemoOptionsResponse,
    ProductCreate,
    ProductOut,
    ProductPage,
    ProductStatusRequest,
    ProductUpdateRequest,
    RulesetCreate,
    RulesetOut,
    RulesetPage,
    RulesetUpdate,
    TierType,
)
from app.services import catalog

router = APIRouter(tags=["catalog"])

Page = Annotated[int, Query(ge=1)]
Size = Annotated[int, Query(ge=1, le=100)]


def _pages(total: int, size: int) -> int:
    return math.ceil(total / size) if total else 0


# ── 상품 ────────────────────────────────────────────────────


@router.get("/catalog/products", response_model=ProductPage, summary="상품 목록")
async def list_products(
    session: Session,
    tier_type: TierType | None = None,
    active_only: bool = False,
    page: Page = 1,
    size: Size = 20,
) -> ProductPage:
    """로그인 없이 볼 수 있다. tier_type으로 CHALLENGE/FUNDED/DEMO/LIVE를 나눠 본다."""
    items, total = await catalog.list_products(
        session, tier_type=tier_type, active_only=active_only, page=page, size=size
    )
    return ProductPage(items=items, total=total, page=page, size=size, pages=_pages(total, size))


@router.post("/catalog/products", response_model=ProductOut, summary="상품 생성 (관리자)")
async def create_product(body: ProductCreate, admin: AdminUser, session: Session) -> ProductOut:
    """product_id를 비우면 `CHALLENGE_10K`처럼 티어와 자본금으로 만든다."""
    product = await catalog.create_product(session, body.model_dump())
    await session.commit()
    return await catalog.product_out_with_ruleset(session, product)


@router.put("/catalog/products/{product_id}", response_model=ProductOut, summary="상품 수정 (관리자)")
async def update_product(
    product_id: str, body: ProductUpdateRequest, admin: AdminUser, session: Session
) -> ProductOut:
    product = await catalog.get_product(session, product_id, lock=True)
    await catalog.update_product(session, product, body.model_dump(exclude_unset=True))
    await session.commit()
    return await catalog.product_out_with_ruleset(session, product)


@router.patch("/catalog/products/{product_id}/status", response_model=ProductOut, summary="상품 활성/비활성 (관리자)")
async def update_product_status(
    product_id: str, body: ProductStatusRequest, admin: AdminUser, session: Session
) -> ProductOut:
    product = await catalog.get_product(session, product_id, lock=True)
    product.is_active = body.is_active
    await session.commit()
    return await catalog.product_out_with_ruleset(session, product)


# ── 룰셋 ────────────────────────────────────────────────────


@router.get("/admin/rulesets", response_model=RulesetPage, summary="룰셋 목록")
async def list_rulesets(admin: AdminUser, session: Session, page: Page = 1, size: Size = 20) -> RulesetPage:
    items, total = await catalog.list_rulesets(session, page, size)
    return RulesetPage(items=items, total=total, page=page, size=size, pages=_pages(total, size))


@router.post("/admin/rulesets", response_model=RulesetOut, summary="룰셋 생성")
async def create_ruleset(body: RulesetCreate, admin: AdminUser, session: Session) -> RulesetOut:
    ruleset = await catalog.create_ruleset(session, body.model_dump())
    await session.commit()
    return await catalog.ruleset_out(session, ruleset)


@router.get("/admin/rulesets/{ruleset_id}", response_model=RulesetOut, summary="룰셋 상세")
async def get_ruleset(ruleset_id: str, admin: AdminUser, session: Session) -> RulesetOut:
    return await catalog.ruleset_out(session, await catalog.get_ruleset(session, ruleset_id))


@router.patch("/admin/rulesets/{ruleset_id}", response_model=RulesetOut, summary="룰셋 수정")
async def update_ruleset(ruleset_id: str, body: RulesetUpdate, admin: AdminUser, session: Session) -> RulesetOut:
    ruleset = await catalog.get_ruleset(session, ruleset_id)
    catalog.update_ruleset(ruleset, body.model_dump(exclude_unset=True))
    await session.commit()
    return await catalog.ruleset_out(session, ruleset)


# ── 데모 계좌 옵션 ──────────────────────────────────────────


@router.get("/demo/options", response_model=DemoOptionsResponse, summary="데모 계좌 생성 옵션 (로그인 불필요)")
async def demo_options(session: Session) -> DemoOptionsResponse:
    """선택지는 core.platform_config(scope=DEMO)에서 읽는다."""
    return await catalog.demo_options(session)


# ── 플랫폼 설정 (관리자) ────────────────────────────────────
# 기존 서버의 /admin/platform-config와 같은 경로·요청 형태다.
# 백오피스 '데모 계정 관리' 화면은 DEMO scope의 선택지를 이 API로 바꾼다.


@router.get("/admin/platform-config/{scope}", response_model=list[ConfigItemOut], summary="scope별 설정 목록")
async def list_platform_configs(scope: ConfigScope, admin: AdminUser, session: Session) -> list[ConfigItemOut]:
    return await catalog.list_configs(session, scope)


@router.put("/admin/platform-config/{scope}/{key}", response_model=ConfigItemOut, summary="설정값 등록 또는 수정")
async def upsert_platform_config(
    scope: ConfigScope,
    body: ConfigUpsertRequest,
    admin: AdminUser,
    session: Session,
    key: str = Path(min_length=1, max_length=100),
) -> ConfigItemOut:
    """DEMO scope는 allowed_leverages·allowed_capitals(양수 목록, 중복 불가), default_leverage·default_capital(양수)만 받는다."""
    config = await catalog.upsert_config(session, scope, key, body.value, body.value_type, body.description)
    await session.commit()
    return catalog.config_item_out(config)
