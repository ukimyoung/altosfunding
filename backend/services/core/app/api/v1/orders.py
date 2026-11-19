"""챌린지 티켓 구매(주문·결제)와 트레이딩 계좌 조회, 관리자 주문 목록·매출 현황.

사용자
    POST /challenges/{challenge_id}/join     결제(통합 지갑) + 계좌 발급 요청. 계좌는 Worker가 발급한다 (발급 중 → 완료)
    GET  /challenges/orders/me               내 구매 내역
    GET  /challenges/orders/{order_id}       내 주문 상세 (계좌 발급 상태)
    GET  /accounts                           내 트레이딩 계좌 목록
    GET  /accounts/challenge-summary         내 챌린지 계좌 요약
    GET  /accounts/{account_id}              내 계좌 상세
    POST /demo/accounts                      데모 계좌 만들기 (Worker가 MT4 계좌 발급)
관리자
    GET  /admin/challenges/orders            전체구매/결제이력
    GET  /admin/challenges/orders/summary    요약 카드
    GET  /admin/challenges/orders/{order_id} 주문 상세 (계좌별 발급 상태·오류)
    GET  /admin/reports/sales/challenge      매출 현황 (챌린지)
    GET  /admin/reports/sales/funded         매출 현황 (펀디드, 아직 빈 집계)
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Header, Query
from pydantic import BaseModel, Field

from app.deps import AdminUser, CurrentUser, Sender, Session
from app.schemas.trading import (
    AccountDetail,
    AccountPage,
    AdminOrderDetail,
    AdminOrderPage,
    AdminOrderSummary,
    ChallengeAccountSummary,
    ChallengeSalesReport,
    FundedSalesReport,
    JoinChallengeRequest,
    JoinChallengeResponse,
    OrderOut,
    OrderPage,
    SalesPeriod,
)
from app.services import challenge_order, demo_account, notify
from app.services import trading_query as q
from app.services.wallet import as_float, get_wallet

router = APIRouter(tags=["challenge-orders"])
admin_router = APIRouter(tags=["admin-challenge-orders"])

Page = Annotated[int, Query(ge=1)]
Size = Annotated[int, Query(ge=1, le=100)]
TimeZone = Annotated[str | None, Header(alias="X-Timezone")]


# ── 사용자: 구매 ────────────────────────────────────────────


@router.post(
    "/challenges/{challenge_id}/join",
    response_model=JoinChallengeResponse,
    status_code=201,
    summary="챌린지 티켓 구매 (통합 지갑 결제)",
)
async def join_challenge(
    challenge_id: str, body: JoinChallengeRequest, user: CurrentUser, session: Session, sender: Sender
) -> JoinChallengeResponse:
    """결제가 끝나면 바로 응답한다. 계좌는 '발급 중'(QUEUED)으로 만들어지고 Worker가 MT4 계좌를 발급한다.
    발급 결과는 GET /challenges/orders/{order_id} 로 확인한다. 끝내 발급하지 못한 계좌는 자동 환불된다."""
    order = await challenge_order.purchase(session, user, challenge_id, body.quantity, body.coupon_code)
    out = await q.my_order(session, user, order.id)
    wallet = await get_wallet(session, user.id)
    await notify.to_user(
        session, sender, user, "challenge_applied",
        {
            "challenge_name": out["challenge_name"] or order.product_name,
            "quantity": order.quantity,
            "amount": notify.amount_text(order.total_price),
        },
        meta={"order_id": order.id},
    )
    await session.commit()
    return JoinChallengeResponse(**out, total_asset=as_float(wallet.balance_usdt) or 0.0)


@router.get("/challenges/orders/me", response_model=OrderPage, summary="내 챌린지 구매 내역")
async def my_orders(
    user: CurrentUser,
    session: Session,
    status: str | None = None,
    search: str | None = None,
    start_date: Annotated[str | None, Query(description="YYYYMMDD 또는 YYYY-MM-DD (한국 시간)")] = None,
    end_date: str | None = None,
    page: Page = 1,
    size: Size = 20,
) -> OrderPage:
    items, total = await q.my_orders(
        session, user, status=status, search=search, start_date=start_date, end_date=end_date, page=page, size=size
    )
    return OrderPage(items=items, total=total, page=page, size=size, pages=q.pages(total, size))


@router.get("/challenges/orders/{order_id}", response_model=OrderOut, summary="내 주문 상세 (계좌 발급 상태)")
async def my_order(order_id: str, user: CurrentUser, session: Session) -> OrderOut:
    return OrderOut(**await q.my_order(session, user, order_id))


# ── 사용자: 계좌 ────────────────────────────────────────────


@router.get("/accounts", response_model=AccountPage, summary="내 트레이딩 계좌 목록")
async def my_accounts(
    user: CurrentUser,
    session: Session,
    tier: str | None = None,
    status: str | None = None,
    type_code: str | None = None,
    mt4_login: int | None = None,
    page: Page = 1,
    size: Size = 20,
) -> AccountPage:
    items, total = await q.my_accounts(
        session, user, tier=tier, status=status, type_code=type_code, mt4_login=mt4_login, page=page, size=size
    )
    return AccountPage(items=items, total=total, page=page, size=size, pages=q.pages(total, size))


@router.get("/accounts/challenge-summary", response_model=ChallengeAccountSummary, summary="내 챌린지 계좌 요약")
async def my_challenge_summary(user: CurrentUser, session: Session) -> ChallengeAccountSummary:
    return ChallengeAccountSummary(**await q.challenge_account_summary(session, user))


@router.get("/accounts/{account_id:uuid}", response_model=AccountDetail, summary="내 계좌 상세")
async def my_account(account_id: uuid.UUID, user: CurrentUser, session: Session) -> AccountDetail:
    return AccountDetail(**await q.my_account(session, user, account_id))


# ── 사용자: 데모 계좌 ───────────────────────────────────────


class DemoAccountCreateRequest(BaseModel):
    # 기존 웹은 DEMO_STD를 보낸다. Core 상품코드가 아니면 사용 중인 첫 데모 상품을 쓴다.
    product_id: str | None = Field(None, description="데모 상품코드 (비우면 사용 중인 첫 데모 상품)")
    capital: float = Field(gt=0, description="초기 가상 자본금 (GET /demo/options의 선택지)")
    leverage: int = Field(gt=0, description="레버리지 (GET /demo/options의 선택지)")


class DemoAccountOut(BaseModel):
    account_id: str
    mt4_login: int | None
    tier: str
    status: str
    # QUEUED: 발급 중 → DONE: 발급 완료(ACTIVE)
    provision_status: str
    capital: float
    leverage_override: int | None
    product_id: str


@router.post("/demo/accounts", response_model=DemoAccountOut, status_code=201, summary="데모 계좌 만들기")
async def create_demo_account(body: DemoAccountCreateRequest, user: CurrentUser, session: Session) -> DemoAccountOut:
    """바로 응답하고 MT4 계좌는 Worker가 만든다 (보통 수 초). 발급 상태는 GET /accounts?tier=DEMO 로 확인한다."""
    account = await demo_account.create(session, user, body.product_id, body.capital, body.leverage)
    return DemoAccountOut(
        account_id=str(account.id), mt4_login=account.mt4_login, tier=account.tier, status=account.status,
        provision_status=account.provision_status, capital=float(account.capital),
        leverage_override=account.leverage, product_id=account.product_id,
    )


# ── 관리자 ──────────────────────────────────────────────────


@admin_router.get("/admin/challenges/orders", response_model=AdminOrderPage, summary="전체구매/결제이력")
async def admin_orders(
    admin: AdminUser,
    session: Session,
    keyword: Annotated[str | None, Query(description="회원 이메일·이름·회원번호, 상품명, 주문번호")] = None,
    status: Annotated[str | None, Query(description="PENDING(발급 중) | COMPLETED | REFUNDED")] = None,
    product_type: str | None = None,
    start_date: Annotated[str | None, Query(description="YYYYMMDD (한국 시간)")] = None,
    end_date: str | None = None,
    page: Page = 1,
    size: Size = 20,
) -> AdminOrderPage:
    items, total = await q.admin_orders(
        session, keyword=keyword, status=status, product_type=product_type, start_date=start_date,
        end_date=end_date, page=page, size=size,
    )
    return AdminOrderPage(items=items, total=total, page=page, size=size, pages=q.pages(total, size))


@admin_router.get("/admin/challenges/orders/summary", response_model=AdminOrderSummary, summary="구매 요약")
async def admin_order_summary(admin: AdminUser, session: Session) -> AdminOrderSummary:
    """total_payment: 처리 끝난 주문의 결제 금액(환불 제외). total_refunds: 환불이 있는 주문 수."""
    return AdminOrderSummary(**await q.admin_order_summary(session))


@admin_router.get("/admin/challenges/orders/{order_id}", response_model=AdminOrderDetail, summary="주문 상세")
async def admin_order(order_id: str, admin: AdminUser, session: Session) -> AdminOrderDetail:
    return AdminOrderDetail(**await q.admin_order(session, order_id))


@admin_router.get("/admin/reports/sales/challenge", response_model=ChallengeSalesReport, summary="챌린지 매출 집계")
async def challenge_sales(
    admin: AdminUser,
    session: Session,
    timezone: TimeZone = None,
    period: SalesPeriod | None = None,
    start_date: Annotated[str | None, Query(description="YYYY-MM-DD (X-Timezone 기준, 기본 한국 시간)")] = None,
    end_date: str | None = None,
    keyword: Annotated[str | None, Query(description="회원 이름 또는 이메일")] = None,
) -> ChallengeSalesReport:
    return ChallengeSalesReport(
        **await q.challenge_sales(
            session, period=period, start_date=start_date, end_date=end_date, keyword=keyword, timezone=timezone
        )
    )


@admin_router.get("/admin/reports/sales/funded", response_model=FundedSalesReport, summary="펀디드 매출 집계")
async def funded_sales(
    admin: AdminUser,
    session: Session,
    timezone: TimeZone = None,
    period: SalesPeriod | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    keyword: str | None = None,
) -> FundedSalesReport:
    return FundedSalesReport(
        **await q.funded_sales(
            session, period=period, start_date=start_date, end_date=end_date, keyword=keyword, timezone=timezone
        )
    )
