from datetime import datetime
from decimal import Decimal

from sqlalchemy import BigInteger, ForeignKey, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Ruleset(Base):
    __tablename__ = "rulesets"

    id: Mapped[str] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(server_default="Unnamed Ruleset")
    daily_loss_limit_pct: Mapped[Decimal] = mapped_column(server_default="5")
    daily_loss_limit_amt: Mapped[Decimal | None]
    max_dd_normal_pct: Mapped[Decimal] = mapped_column(server_default="10")
    max_dd_normal_amt: Mapped[Decimal | None]
    max_dd_vip_pct: Mapped[Decimal] = mapped_column(server_default="10")
    max_dd_vip_amt: Mapped[Decimal | None]
    max_dd_lookback_days: Mapped[int] = mapped_column(server_default="45")
    dd_calc_method: Mapped[str] = mapped_column(server_default="STATIC")
    stop_out_pct: Mapped[Decimal | None]
    pass_condition_type: Mapped[str] = mapped_column(server_default="RELATIVE")
    pass_condition_pct: Mapped[Decimal | None]
    pass_condition_amt: Mapped[Decimal | None]
    pass_condition_vip_type: Mapped[str] = mapped_column(server_default="ABSOLUTE")
    pass_condition_vip_pct: Mapped[Decimal | None]
    pass_condition_vip_amt: Mapped[Decimal | None]
    profit_target_pct: Mapped[Decimal | None]
    profit_target_amt: Mapped[Decimal | None]
    min_trading_days: Mapped[int] = mapped_column(server_default="5")
    inactivity_days: Mapped[int] = mapped_column(server_default="30")
    max_mini_contracts: Mapped[int | None]
    max_micro_contracts: Mapped[int | None]
    consistency_pct: Mapped[Decimal | None]
    retry_policy: Mapped[str] = mapped_column(server_default="NONE")
    apply_scope: Mapped[str] = mapped_column(server_default="NEW")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())


class Product(Base):
    __tablename__ = "products"

    # DB 컬럼은 id, API에서는 기존 서버와 같이 product_id로 내보낸다.
    product_id: Mapped[str] = mapped_column("id", primary_key=True)
    name: Mapped[str]
    type_code: Mapped[str | None]
    description: Mapped[str | None]
    capital: Mapped[Decimal]
    price_usdt: Mapped[Decimal] = mapped_column(server_default="0")
    # 할인가격. null이면 할인 없이 원가격(price_usdt)으로 판매한다.
    discount_price_usdt: Mapped[Decimal | None]
    tier_type: Mapped[str] = mapped_column(server_default="CHALLENGE")
    is_active: Mapped[bool] = mapped_column(server_default="true")
    # MOST POPULAR 뱃지 (랜딩 Account Size, Start New Challenge 카드)
    is_most_popular: Mapped[bool] = mapped_column(server_default="false")
    ruleset_id: Mapped[str | None] = mapped_column(ForeignKey("core.rulesets.id"))
    mt4_group: Mapped[str] = mapped_column(server_default="default")
    leverage: Mapped[int] = mapped_column(server_default="100")
    mt4_login_pool_start: Mapped[int] = mapped_column(BigInteger, server_default="100000")
    mt4_login_pool_end: Mapped[int] = mapped_column(BigInteger, server_default="199999")
    last_mt4_login: Mapped[int | None] = mapped_column(BigInteger)
    next_product_id: Mapped[str | None] = mapped_column(ForeignKey("core.products.id"))
    # 펀디드 상품에만: 연관 챌린지 상품 id (예: 1001)
    related_id: Mapped[str | None] = mapped_column(ForeignKey("core.products.id"))
    funding_start_delay_hours: Mapped[int] = mapped_column(server_default="0")
    duration_days: Mapped[int] = mapped_column(server_default="30")
    margin_call_pct: Mapped[Decimal | None]
    # 상품별 최소거래일. null이면 연결된 룰셋의 min_trading_days를 쓴다.
    min_trading_days: Mapped[int | None]
    stop_out_pct: Mapped[Decimal | None]
    payout_ratio: Mapped[Decimal] = mapped_column(server_default="80")
    payout_period_days: Mapped[int] = mapped_column(server_default="14")
    violation_policy: Mapped[str] = mapped_column(server_default="AUTO_SUSPEND")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())


class PlatformConfig(Base):
    __tablename__ = "platform_config"

    scope: Mapped[str] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(primary_key=True)
    value: Mapped[object] = mapped_column(JSONB)
    description: Mapped[str | None]
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())
