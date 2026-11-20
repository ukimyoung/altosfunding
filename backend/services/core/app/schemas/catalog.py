"""상품·룰셋 스키마. 필드 이름과 기본값은 기존 서버(openapi.json)와 같다."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

TierType = Literal["CHALLENGE", "FUNDED", "DEMO", "LIVE"]
DdCalcMethod = Literal["STATIC", "EOD", "INTRADAY"]
RetryPolicy = Literal["NONE", "ONCE", "UNLIMITED", "FORBIDDEN"]
ViolationPolicy = Literal["AUTO_SUSPEND", "ALERT_ONLY", "MANUAL_BLOCK"]
PassConditionType = Literal["RELATIVE", "ABSOLUTE"]
ApplyScope = Literal["NEW", "ALL"]

Pct = Field(default=None, ge=0, le=100)


# ── 룰셋 ────────────────────────────────────────────────────


class RulesetFields(BaseModel):
    name: str = "Unnamed Ruleset"
    daily_loss_limit_pct: float = Field(default=5.0, ge=0, le=100)
    daily_loss_limit_amt: float | None = Field(default=None, ge=0)
    max_dd_normal_pct: float = Field(default=10.0, ge=0, le=100)
    max_dd_normal_amt: float | None = Field(default=None, ge=0)
    max_dd_vip_pct: float = Field(default=10.0, ge=0, le=100)
    max_dd_vip_amt: float | None = Field(default=None, ge=0)
    max_dd_lookback_days: int = Field(default=45, ge=0)
    dd_calc_method: DdCalcMethod = "STATIC"
    stop_out_pct: float | None = Pct
    pass_condition_type: PassConditionType = "RELATIVE"
    pass_condition_pct: float | None = Pct
    pass_condition_amt: float | None = Field(default=None, ge=0)
    pass_condition_vip_type: PassConditionType = "ABSOLUTE"
    pass_condition_vip_pct: float | None = Pct
    pass_condition_vip_amt: float | None = Field(default=None, ge=0)
    profit_target_pct: float | None = Pct
    profit_target_amt: float | None = Field(default=None, ge=0)
    min_trading_days: int = Field(default=5, ge=0)
    inactivity_days: int = Field(default=30, ge=0)
    consistency_pct: float | None = Pct
    retry_policy: RetryPolicy = "NONE"
    apply_scope: ApplyScope = "NEW"


class RulesetCreate(RulesetFields):
    # 미활동 일수는 30일을 넘길 수 없다.
    inactivity_days: int = Field(default=30, ge=0, le=30)
    # 비우면 서버가 만든다 (예: RS-7K2M9Q)
    id: str | None = Field(default=None, max_length=50, pattern=r"^[A-Za-z0-9_\-]+$")


class RulesetUpdate(BaseModel):
    name: str | None = None
    daily_loss_limit_pct: float | None = Pct
    daily_loss_limit_amt: float | None = Field(default=None, ge=0)
    max_dd_normal_pct: float | None = Pct
    max_dd_normal_amt: float | None = Field(default=None, ge=0)
    max_dd_vip_pct: float | None = Pct
    max_dd_vip_amt: float | None = Field(default=None, ge=0)
    max_dd_lookback_days: int | None = Field(default=None, ge=0)
    dd_calc_method: DdCalcMethod | None = None
    stop_out_pct: float | None = Pct
    pass_condition_type: PassConditionType | None = None
    pass_condition_pct: float | None = Pct
    pass_condition_amt: float | None = Field(default=None, ge=0)
    pass_condition_vip_type: PassConditionType | None = None
    pass_condition_vip_pct: float | None = Pct
    pass_condition_vip_amt: float | None = Field(default=None, ge=0)
    profit_target_pct: float | None = Pct
    profit_target_amt: float | None = Field(default=None, ge=0)
    min_trading_days: int | None = Field(default=None, ge=0)
    inactivity_days: int | None = Field(default=None, ge=0, le=30)
    consistency_pct: float | None = Pct
    retry_policy: RetryPolicy | None = None
    apply_scope: ApplyScope | None = None


class RulesetOut(RulesetFields):
    model_config = ConfigDict(from_attributes=True)

    id: str
    connected_products_count: int = 0
    created_at: datetime | None = None
    updated_at: datetime | None = None


class RulesetPage(BaseModel):
    items: list[RulesetOut]
    total: int
    page: int
    size: int
    pages: int


# ── 상품 ────────────────────────────────────────────────────


class ProductCreate(BaseModel):
    # 상품코드(product_id)는 서버가 만든다: 티어 1자리 + 일련번호 3자리 (예: 1001)
    name: str = Field(min_length=1, max_length=200)
    type_code: str | None = None
    description: str | None = None
    capital: float = Field(gt=0)
    price_usdt: float = Field(default=0.0, ge=0)
    discount_price_usdt: float | None = Field(default=None, ge=0)
    tier_type: TierType = "CHALLENGE"
    is_active: bool = True
    is_most_popular: bool = False
    ruleset_id: str | None = None
    mt4_group: str = "default"
    leverage: int = Field(default=100, gt=0)
    mt4_login_pool_start: int = Field(default=100000, gt=0)
    mt4_login_pool_end: int = Field(default=199999, gt=0)
    next_product_id: str | None = None
    # 펀디드 상품에만: 연관 챌린지 상품 id (예: 1001)
    related_id: str | None = None
    funding_start_delay_hours: int = Field(default=0, ge=0)
    duration_days: int = Field(default=30, ge=0)
    margin_call_pct: float | None = Field(default=None, ge=0)
    stop_out_pct: float | None = Field(default=None, ge=0)
    payout_ratio: float = Field(default=80.0, ge=0, le=100)
    payout_period_days: int = Field(default=14, ge=0)
    violation_policy: ViolationPolicy = "AUTO_SUSPEND"


class ProductUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    type_code: str | None = None
    description: str | None = None
    capital: float | None = Field(default=None, gt=0)
    price_usdt: float | None = Field(default=None, ge=0)
    discount_price_usdt: float | None = Field(default=None, ge=0)
    tier_type: TierType | None = None
    is_active: bool | None = None
    is_most_popular: bool | None = None
    ruleset_id: str | None = None
    mt4_group: str | None = None
    leverage: int | None = Field(default=None, gt=0)
    mt4_login_pool_start: int | None = Field(default=None, gt=0)
    mt4_login_pool_end: int | None = Field(default=None, gt=0)
    next_product_id: str | None = None
    related_id: str | None = None
    funding_start_delay_hours: int | None = Field(default=None, ge=0)
    duration_days: int | None = Field(default=None, ge=0)
    margin_call_pct: float | None = Field(default=None, ge=0)
    stop_out_pct: float | None = Field(default=None, ge=0)
    payout_ratio: float | None = Field(default=None, ge=0, le=100)
    payout_period_days: int | None = Field(default=None, ge=0)
    violation_policy: ViolationPolicy | None = None


class ProductStatusRequest(BaseModel):
    is_active: bool


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_id: str
    name: str
    type_code: str | None
    description: str | None
    capital: float
    price_usdt: float
    discount_price_usdt: float | None
    tier_type: str
    is_active: bool
    is_most_popular: bool
    ruleset_id: str | None
    ruleset_name: str | None = None
    mt4_group: str
    leverage: int
    mt4_login_pool_start: int
    mt4_login_pool_end: int
    last_mt4_login: int | None
    next_product_id: str | None
    related_id: str | None = None
    funding_start_delay_hours: int
    duration_days: int
    margin_call_pct: float | None
    stop_out_pct: float | None
    payout_ratio: float
    payout_period_days: int
    violation_policy: str
    created_at: datetime | None
    updated_at: datetime | None


class ProductPage(BaseModel):
    items: list[ProductOut]
    total: int
    page: int
    size: int
    pages: int


class DemoOptionsResponse(BaseModel):
    allowed_leverages: list[int]
    allowed_capitals: list[float]
    default_leverage: int
    default_capital: float


# ── 플랫폼 설정 (관리자) ────────────────────────────────────

ConfigScope = Literal["DEMO", "PAYOUT", "RISK", "CHALLENGE", "LIVE", "SYSTEM", "REWARD"]
ValueType = Literal["STRING", "INTEGER", "FLOAT", "JSON", "BOOLEAN"]


class ConfigItemOut(BaseModel):
    """기존 서버 응답과 같은 필드를 쓴다. 단, value는 문자열이 아니라 저장된 JSON 값 그대로다."""

    scope: str
    key: str
    value: object
    value_type: ValueType
    description: str | None
    updated_at: datetime


class ConfigUpsertRequest(BaseModel):
    """기존 서버와 같은 요청 형태. value_type이 JSON/INTEGER/FLOAT/BOOLEAN이면 문자열 값도 변환해서 저장한다."""

    value: object
    value_type: ValueType = "STRING"
    description: str | None = None
