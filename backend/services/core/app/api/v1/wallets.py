"""지갑·입출금 API. 경로와 응답 형태는 기존 서버와 같다.

- 사용자 (웹 'My Page > My Profile > My Asset')
    GET  /accounts/my-asset            Total Asset (통합 지갑 잔고)
    GET  /payouts/config/networks      입금·출금 팝업의 네트워크 목록·출금 수수료
    GET  /wallets/me                   내 지갑
    GET  /wallets/me/transactions      Deposit & Withdraw History
    POST /wallets/me/deposit           입금 확인 요청 (USDT 송금 후 TX hash 입력 → 관리자 승인 대기)
    POST /wallets/me/withdraw          출금 신청 (잔고에서 바로 차감 → 관리자 송금·승인 대기)
- 관리자 (백오피스 '입출금 승인 관리', '입출금 내역', '수익 분배 설정')
    GET  /admin/wallets/requests/pending|history|summary
    POST /admin/wallets/deposits/{id}/approve|reject
    POST /admin/wallets/withdrawals/{id}/approve|reject
    GET/PUT /admin/payout-settings/network-fees, profit-split, GET profit-split/history
"""

import logging
from typing import Annotated

from fastapi import APIRouter, Query, Request

from app.deps import AdminUser, CurrentUser, Sender, Session
from app.models import User
from app.schemas.wallet import (
    DepositCreate,
    DepositCreated,
    DepositRejectBody,
    MyAssetOut,
    NetworkFeesUpdate,
    NetworkItem,
    ProfitSplitHistoryPage,
    ProfitSplitOut,
    ProfitSplitUpdate,
    RequestProcessed,
    WalletOut,
    WithdrawalApproveBody,
    WithdrawalRejectBody,
    WithdrawCreate,
    WithdrawCreated,
)
from app.services import notify, payout_settings, wallet_history
from app.services import wallet as svc
from app.services.announcement import request_locale
from app.services.wallet import as_float

logger = logging.getLogger(__name__)

router = APIRouter(tags=["wallet"])
admin_router = APIRouter(tags=["admin-wallet"])

Page = Annotated[int, Query(ge=1)]
Size = Annotated[int, Query(ge=1, le=100)]


# ── 사용자 ──────────────────────────────────────────────────


@router.get("/accounts/my-asset", response_model=MyAssetOut, summary="My Asset — Total Asset")
async def my_asset(user: CurrentUser, session: Session) -> MyAssetOut:
    wallet = await svc.get_wallet(session, user.id)
    await session.commit()
    return MyAssetOut(total_asset=as_float(wallet.balance_usdt) or 0.0)


@router.get("/payouts/config/networks", response_model=list[NetworkItem], summary="입출금 네트워크 목록 (사용 중인 것만)")
async def list_networks(user: CurrentUser, session: Session) -> list[dict]:
    return [n for n in await svc.get_network_fees(session) if n["is_active"]]


@router.get("/wallets/me", response_model=list[WalletOut], summary="내 지갑")
async def my_wallets(user: CurrentUser, session: Session) -> list[WalletOut]:
    wallet = await svc.get_wallet(session, user.id)
    await session.commit()
    return [
        WalletOut(
            id=wallet.id,
            wallet_type=wallet.wallet_type,
            balance_usdt=as_float(wallet.balance_usdt) or 0.0,
            is_active=wallet.is_active,
        )
    ]


@router.get("/wallets/me/transactions", summary="내 입출금 내역 (Deposit & Withdraw History)")
async def my_transactions(
    user: CurrentUser,
    session: Session,
    category: Annotated[str | None, Query(description="DEPOSIT | WITHDRAW, 없으면 전체")] = None,
    status: Annotated[str | None, Query(description="Completed | Pending | Failed")] = None,
    start_date: Annotated[str | None, Query(description="YYYYMMDD (KST)")] = None,
    end_date: Annotated[str | None, Query(description="YYYYMMDD (KST)")] = None,
    page: Page = 1,
    size: Size = 20,
) -> dict:
    return await wallet_history.list_my_transactions(
        session, user, category=category, status=status, start_date=start_date, end_date=end_date, page=page, size=size
    )


@router.post("/wallets/me/deposit", response_model=DepositCreated, summary="입금 확인 요청 (관리자 승인 대기)")
async def create_deposit(body: DepositCreate, user: CurrentUser, session: Session) -> DepositCreated:
    """회사 주소로 USDT를 보낸 뒤 TX hash를 입력한다. 최소 금액은 WALLET.min_deposit_amount (기본 10 USDT)."""
    req = await svc.request_deposit(session, user, body.amount, body.tx_hash, body.network)
    logger.info("입금 요청 #%s user=%s amount=%s network=%s", req.id, user.id, req.amount, req.network)
    return DepositCreated(
        request_id=req.id, amount=as_float(req.amount), tx_hash=req.tx_hash, network=req.network, status=req.status
    )


@router.post("/wallets/me/withdraw", response_model=WithdrawCreated, summary="출금 신청 (관리자 승인 대기)")
async def create_withdrawal(
    body: WithdrawCreate, user: CurrentUser, session: Session, sender: Sender, request: Request
) -> WithdrawCreated:
    """KYC 승인 회원만. 2FA를 켰으면 totp_code, 출금 이메일 인증을 켰으면 verification_code
    (POST /auth/email/send-verification purpose=WITHDRAW_REQUEST로 받은 코드)가 필요하다.
    신청 금액은 잔고에서 바로 빠지고, 회원이 받는 금액은 금액 - 네트워크 수수료다."""
    req = await svc.request_withdrawal(
        session,
        user,
        amount=body.amount,
        network=body.network,
        wallet_address=body.wallet_address,
        verification_code=body.verification_code,
        totp_code=body.totp_code,
    )
    logger.info("출금 신청 #%s user=%s amount=%s fee=%s", req.id, user.id, req.amount, req.fee)
    await notify.to_user(
        session, sender, user, "withdrawal_requested",
        {"recipient_email": user.email, "payout_id": req.id, "amount": notify.amount_text(req.amount)},
        locale=request_locale(request.headers.get("accept-language")),
    )
    return WithdrawCreated(
        request_id=req.id,
        amount=as_float(req.amount),
        fee=as_float(req.fee),
        network=req.network,
        wallet_address=req.wallet_address,
        status=req.status,
    )


# ── 관리자: 입출금 승인 ─────────────────────────────────────


async def _notify(session, sender, user_id, template_id: str, variables: dict) -> None:
    user = await session.get(User, user_id)
    if user is not None:
        await notify.to_user(session, sender, user, template_id, variables)


def _withdrawal_amounts(req) -> dict:
    return {
        "amount": notify.amount_text(req.amount),
        "fee": notify.amount_text(req.fee),
        "received_amount": notify.amount_text(req.amount - req.fee),
    }


@admin_router.get("/admin/wallets/requests/pending", summary="입출금 승인 대기 목록 (오래된 순)")
async def admin_pending(
    admin: AdminUser,
    session: Session,
    keyword: Annotated[str | None, Query(description="이름 / 이메일 / UID / TX hash / 지갑 주소")] = None,
    display_tx_type: Annotated[str | None, Query(description="External Wallet | Payout")] = None,
    start_date: Annotated[str | None, Query(description="YYYY-MM-DD (KST)")] = None,
    end_date: Annotated[str | None, Query(description="YYYY-MM-DD (KST)")] = None,
    page: Page = 1,
    size: Size = 20,
) -> dict:
    return await wallet_history.list_admin_requests(
        session, pending=True, keyword=keyword, display_tx_type=display_tx_type, display_status=None,
        direction=None, start_date=start_date, end_date=end_date, page=page, size=size,
    )


@admin_router.get("/admin/wallets/requests/history", summary="입출금 처리 이력 (최신순)")
async def admin_history(
    admin: AdminUser,
    session: Session,
    keyword: Annotated[str | None, Query(description="이름 / 이메일 / UID / TX hash / 지갑 주소")] = None,
    display_tx_type: Annotated[str | None, Query(description="External Wallet | Payout")] = None,
    display_status: Annotated[str | None, Query(description="Completed | Failed")] = None,
    direction: Annotated[str | None, Query(description="IN | OUT")] = None,
    start_date: Annotated[str | None, Query(description="YYYY-MM-DD (KST)")] = None,
    end_date: Annotated[str | None, Query(description="YYYY-MM-DD (KST)")] = None,
    page: Page = 1,
    size: Size = 20,
) -> dict:
    return await wallet_history.list_admin_requests(
        session, pending=False, keyword=keyword, display_tx_type=display_tx_type, display_status=display_status,
        direction=direction, start_date=start_date, end_date=end_date, page=page, size=size,
    )


@admin_router.get("/admin/wallets/requests/summary", summary="입출금 승인 대기 건수 요약")
async def admin_summary(
    admin: AdminUser,
    session: Session,
    keyword: str | None = None,
    display_tx_type: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    status: Annotated[str | None, Query(description="(사용하지 않음, 기존 화면 호환)")] = None,
) -> dict:
    return await wallet_history.admin_summary(
        session, keyword=keyword, display_tx_type=display_tx_type, start_date=start_date, end_date=end_date
    )


@admin_router.post("/admin/wallets/deposits/{request_id}/approve", response_model=RequestProcessed, summary="입금 승인 (지갑 잔고 반영)")
async def approve_deposit(request_id: int, admin: AdminUser, session: Session, sender: Sender) -> RequestProcessed:
    req = await svc.approve_deposit(session, admin, request_id)
    logger.info("입금 승인 #%s by %s amount=%s", req.id, admin.id, req.amount)
    await _notify(session, sender, req.user_id, "deposit_confirmed", {
        "amount": notify.amount_text(req.amount), "processed_at": notify.time_text(req.processed_at), "tx_id": req.tx_hash,
    })
    return RequestProcessed(id=req.id, status=req.status, amount=as_float(req.amount), tx_hash=req.tx_hash)


@admin_router.post("/admin/wallets/deposits/{request_id}/reject", response_model=RequestProcessed, summary="입금 반려")
async def reject_deposit(
    request_id: int, body: DepositRejectBody, admin: AdminUser, session: Session, sender: Sender
) -> RequestProcessed:
    req = await svc.reject_deposit(session, admin, request_id, body.reason)
    logger.info("입금 반려 #%s by %s", req.id, admin.id)
    await _notify(session, sender, req.user_id, "deposit_rejected", {
        "amount": notify.amount_text(req.amount), "processed_at": notify.time_text(req.processed_at),
        "tx_id": req.tx_hash, "reason": req.reject_reason,
    })
    return RequestProcessed(
        id=req.id, status=req.status, amount=as_float(req.amount), tx_hash=req.tx_hash, reject_reason=req.reject_reason
    )


@admin_router.post("/admin/wallets/withdrawals/{request_id}/approve", response_model=RequestProcessed, summary="출금 승인 (송금 TX hash 입력)")
async def approve_withdrawal(
    request_id: int, body: WithdrawalApproveBody, admin: AdminUser, session: Session, sender: Sender
) -> RequestProcessed:
    """회원 지갑 주소로 (금액 - 수수료)를 송금한 뒤 그 TX hash를 입력해 승인한다."""
    req = await svc.approve_withdrawal(session, admin, request_id, body.tx_hash)
    logger.info("출금 승인 #%s by %s amount=%s", req.id, admin.id, req.amount)
    await _notify(session, sender, req.user_id, "withdrawal_confirmed", {
        **_withdrawal_amounts(req), "processed_at": notify.time_text(req.processed_at), "tx_id": req.tx_hash,
    })
    return RequestProcessed(
        id=req.id, status=req.status, amount=as_float(req.amount), fee=as_float(req.fee), tx_hash=req.tx_hash
    )


@admin_router.post("/admin/wallets/withdrawals/{request_id}/reject", response_model=RequestProcessed, summary="출금 반려 (잔고 되돌림)")
async def reject_withdrawal(
    request_id: int, body: WithdrawalRejectBody, admin: AdminUser, session: Session, sender: Sender
) -> RequestProcessed:
    req = await svc.reject_withdrawal(session, admin, request_id, body.note)
    logger.info("출금 반려 #%s by %s", req.id, admin.id)
    await _notify(session, sender, req.user_id, "withdrawal_rejected", {
        **_withdrawal_amounts(req), "processed_at": notify.time_text(req.processed_at), "reason": req.rejected_reason,
    })
    return RequestProcessed(
        id=req.id, status=req.status, amount=as_float(req.amount), fee=as_float(req.fee),
        reject_reason=req.rejected_reason,
    )


# ── 관리자: 수익 분배 설정 (네트워크 수수료) ─────────────────


@admin_router.get("/admin/payout-settings/network-fees", response_model=list[NetworkItem], summary="네트워크별 출금 수수료 목록")
async def get_network_fees(admin: AdminUser, session: Session) -> list[dict]:
    return await svc.get_network_fees(session)


@admin_router.put("/admin/payout-settings/network-fees", response_model=list[NetworkItem], summary="네트워크별 출금 수수료 일괄 저장")
async def put_network_fees(body: NetworkFeesUpdate, admin: AdminUser, session: Session) -> list[dict]:
    return await payout_settings.set_network_fees(session, [n.model_dump() for n in body.networks])


@admin_router.get("/admin/payout-settings/profit-split", response_model=ProfitSplitOut, summary="기본 수익 분배 비율")
async def get_profit_split(admin: AdminUser, session: Session) -> dict:
    return await payout_settings.get_profit_split(session)


@admin_router.put("/admin/payout-settings/profit-split", response_model=ProfitSplitOut, summary="기본 수익 분배 비율 저장")
async def put_profit_split(body: ProfitSplitUpdate, admin: AdminUser, session: Session) -> dict:
    return await payout_settings.set_profit_split(session, admin, body.trader_pct)


@admin_router.get("/admin/payout-settings/profit-split/history", response_model=ProfitSplitHistoryPage, summary="분배 비율 변경 이력")
async def get_profit_split_history(admin: AdminUser, session: Session, page: Page = 1, size: Size = 20) -> dict:
    return await payout_settings.profit_split_history(session, page, size)
