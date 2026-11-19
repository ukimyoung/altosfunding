from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class JoinChallengeRequest(BaseModel):
    quantity: int = Field(1, ge=1, le=10, description="한 번에 발급할 계좌 수 (1~10)")
    coupon_code: str | None = Field(None, max_length=30, description="쿠폰 코드 (아직 지원하지 않음)")
    # 기존 웹이 보내던 값. 무시한다 (항상 새 계좌를 발급).
    mt4_login: int | None = None


class OrderAccountOut(BaseModel):
    account_id: str
    mt4_login: int | None
    # QUEUED: 발급 중 / DONE: 발급 완료 / FAILED: 발급 실패(환불됨)
    provision_status: str
    status: str
    start_at: datetime | None
    end_at: datetime | None


class OrderOut(BaseModel):
    order_id: str
    challenge_id: str
    challenge_name: str | None = None
    product_id: str
    product_name: str
    type_code: str | None
    quantity: int
    unit_price: float
    original_price: float
    discount_amount: float
    total_price: float
    issued_quantity: int
    refunded_quantity: int
    refunded_amount: float
    # PENDING: 계좌 발급 중 / COMPLETED: 처리 끝(1개 이상 발급) / REFUNDED: 전부 발급 실패·환불
    status: str
    created_at: datetime
    completed_at: datetime | None
    accounts: list[OrderAccountOut] = []


class JoinChallengeResponse(OrderOut):
    ok: bool = True
    # 기존 응답 형태 호환. 계좌는 Worker가 발급하므로 결제 직후에는 비어 있다.
    participants: list[dict] = []
    total_asset: float


class OrderPage(BaseModel):
    items: list[OrderOut]
    total: int
    page: int
    size: int
    pages: int


class AccountListItem(BaseModel):
    mt4_login: int | None
    account_id: str
    user_id: str
    product_id: str
    product_name: str | None = None
    status: str
    provision_status: str
    tier: str
    type_code: str | None
    is_read_only: bool
    capital: float
    # 잔고·평가금액은 MT4 데이터 수집 기능이 들어오기 전까지 자본금으로 보여 준다.
    balance: float
    equity: float
    total_profit: float = 0
    promoted_at: datetime | None = None
    failed_reason: str | None = None
    reason: str | None = None
    created_at: datetime
    challenge_id: str | None
    challenge_name: str | None
    start_date: datetime | None
    end_date: datetime | None
    user_email: str | None
    mt4_server: str
    # 대회가 시작되기 전에는 보여 주지 않는다 (발급 메일로는 바로 보낸다, 기존 서버와 같음)
    mt4_password: str | None = None
    leverage_override: int | None = None
    order_id: str | None


class AccountPage(BaseModel):
    items: list[AccountListItem]
    total: int
    page: int
    size: int
    pages: int


class AccountDetail(AccountListItem):
    leverage: int
    available_balance: float = 0
    total_completed_payout: float = 0
    session_id: str | None
    session_name: str | None
    start_at: datetime | None
    end_at: datetime | None
    challenge_mt4_login: int | None
    user_name: str | None
    user_grade: str | None


class ProductCount(BaseModel):
    product_id: str
    product_name: str
    count: int


class ChallengeAccountSummary(BaseModel):
    total_challenges: int
    active_challenges: int
    passed_challenges: int
    failed_challenges: int
    provisioning: int
    by_product: list[ProductCount]


# ── 관리자 ──────────────────────────────────────────────────


class AdminOrderItem(BaseModel):
    id: str
    uid: str
    user_id: str
    user_email: str
    user_nickname: str
    challenge_id: str
    product_id: str
    product_name: str
    quantity: int
    unit_price: float
    total_price: float
    issued_quantity: int
    refunded_quantity: int
    refunded_amount: float
    payment_method: str
    status: str
    created_at: datetime
    completed_at: datetime | None


class AdminOrderPage(BaseModel):
    items: list[AdminOrderItem]
    total: int
    page: int
    size: int
    pages: int


class AdminOrderAccount(OrderAccountOut):
    mt4_server: str
    provision_error: str | None
    issued_at: datetime | None


class AdminOrderDetail(AdminOrderItem):
    accounts: list[AdminOrderAccount]


class AdminOrderSummary(BaseModel):
    total_orders: int
    total_payment: float
    this_month_completed: int
    total_refunds: int
    provisioning_accounts: int


SalesPeriod = Literal["weekly", "monthly", "yearly"]


class SalesCell(BaseModel):
    quantity: int = 0
    amount: float = 0


class SalesColumn(BaseModel):
    product_id: str
    label: str
    price_usdt: float


class ChallengeSalesItem(BaseModel):
    date: str
    products: dict[str, SalesCell]
    subtotal: SalesCell = SalesCell()


class ChallengeSalesSummary(SalesCell):
    by_product: dict[str, SalesCell]


class ChallengeSalesReport(BaseModel):
    period: SalesPeriod
    columns: list[SalesColumn]
    items: list[ChallengeSalesItem]
    total: int
    page: int
    size: int
    pages: int
    summary: ChallengeSalesSummary


class ProfitSplit(BaseModel):
    trader_pct: float
    company_pct: float


class FundedSalesItem(BaseModel):
    date: str
    request_count: int = 0
    request_amount: float = 0
    trader_amount: float = 0
    company_amount: float = 0


class FundedSalesSummary(BaseModel):
    request_count: int = 0
    request_amount: float = 0
    trader_amount: float = 0
    company_amount: float = 0


class FundedSalesReport(BaseModel):
    period: SalesPeriod
    profit_split: ProfitSplit
    items: list[FundedSalesItem]
    total: int
    page: int
    size: int
    pages: int
    summary: FundedSalesSummary


# ── 관리자: 트레이딩 계좌 (트레이더 관리 > 계좌 관리) ─────────


class AdminAccount(AccountDetail):
    user_uid: str
    provision_error: str | None = None
    issued_at: datetime | None = None


class AdminAccountPage(BaseModel):
    items: list[AdminAccount]
    total: int
    page: int
    size: int
    pages: int


class AdminAccountStats(BaseModel):
    tier: str
    total_accounts: int
    # 진행중 = 대회가 시작돼 거래 중인 ACTIVE 계좌
    in_progress_accounts: int
    total_capital: float


class AdminTrade(BaseModel):
    deal_id: int
    date: datetime
    symbol: str
    action: str
    volume: float
    price: float
    profit: float
    fee: float
    swap: float
    entry: str
    comment: str | None


class AdminTradePage(BaseModel):
    items: list[AdminTrade]
    total: int
    page: int
    size: int
    pages: int
