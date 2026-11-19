"""관리자 트레이딩 계좌 API (백오피스 트레이더 관리 > 계좌 관리: 챌린지·펀디드·데모·라이브 계좌관리, 회원 상세).

GET /admin/accounts                       계좌 목록 (tier·상태·상품·기간 필터, 계좌번호·이름·이메일 검색)
GET /admin/accounts-stats                 계좌 수 통계 (전체·진행중)
GET /admin/accounts/{account_id}          계좌 상세 (계좌 UUID 또는 MT4 번호)
GET /admin/accounts/{account_id}/trades   거래내역 (Worker가 MT4에서 수집한 청산 거래)
POST /admin/accounts/{account_id}/freeze    비활성 (PENDING·ACTIVE → INACTIVE, 미결 포지션 있으면 거절)
POST /admin/accounts/{account_id}/unfreeze  활성 복귀 (INACTIVE → 대회 상태에 맞는 원래 상태)
POST /admin/accounts/{account_id}/ban       영구정지 (사유 필수, 되돌릴 수 없음)

상태 변경 후 MT4 거래 잠금(ReadOnly)은 Worker가 맞춘다. 이력: core.trading_account_status_history
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Body, Query
from pydantic import BaseModel, Field

from app.deps import AdminUser, Session
from app.schemas.trading import (
    AdminAccount,
    AdminAccountPage,
    AdminAccountStats,
    AdminTradePage,
)
from app.services import account_admin as svc
from app.services import mt4_ingest
from app.services.trading_query import pages

router = APIRouter(tags=["admin-accounts"])

Page = Annotated[int, Query(ge=1)]
Size = Annotated[int, Query(ge=1, le=100)]


@router.get("/admin/accounts", response_model=AdminAccountPage, summary="계좌 목록")
async def list_accounts(
    admin: AdminUser,
    session: Session,
    tier: Annotated[str | None, Query(description="CHALLENGE | FUNDED | DEMO | LIVE")] = None,
    status: Annotated[str | None, Query(description="PENDING | ACTIVE | CLOSED | PASSED | FAILED | INACTIVE | BANNED")] = None,
    user_id: Annotated[str | None, Query(description="회원 ID (회원 상세 화면)")] = None,
    keyword: Annotated[str | None, Query(description="MT4 계좌번호·이름·이메일·회원번호")] = None,
    type_code: Annotated[str | None, Query(description="상품코드(4자리) 또는 상품 type_code")] = None,
    start_date: Annotated[str | None, Query(description="계좌 생성일 YYYYMMDD (한국 시간)")] = None,
    end_date: Annotated[str | None, Query(description="계좌 생성일 YYYYMMDD (한국 시간)")] = None,
    page: Page = 1,
    size: Size = 20,
) -> AdminAccountPage:
    items, total = await svc.list_accounts(
        session, tier=tier, status=status, user_id=user_id, keyword=keyword, type_code=type_code,
        start_date=start_date, end_date=end_date, page=page, size=size,
    )
    return AdminAccountPage(items=items, total=total, page=page, size=size, pages=pages(total, size))


@router.get("/admin/accounts-stats", response_model=AdminAccountStats, summary="계좌 수 통계")
async def account_stats(admin: AdminUser, session: Session, tier: str | None = None) -> AdminAccountStats:
    return AdminAccountStats(**await svc.account_stats(session, tier))


@router.get("/admin/accounts/{account_id}", response_model=AdminAccount, summary="계좌 상세")
async def get_account(account_id: str, admin: AdminUser, session: Session) -> AdminAccount:
    return AdminAccount(**await svc.get_account(session, account_id))


@router.get("/admin/accounts/{account_id}/trades", response_model=AdminTradePage, summary="계좌 거래내역")
async def account_trades(account_id: str, admin: AdminUser, session: Session, page: Page = 1, size: Size = 20) -> AdminTradePage:
    """청산된 매수·매도 거래, 청산 시각 최신순 (계좌가 없으면 404). 계좌 UUID 또는 MT4 번호."""
    account = await svc.get_account(session, account_id)
    items, total = await mt4_ingest.closed_trades(session, uuid.UUID(account["account_id"]), page=page, size=size)
    return AdminTradePage(items=items, total=total, page=page, size=size, pages=pages(total, size))


class FreezeRequest(BaseModel):
    reason: str | None = Field(None, max_length=500)


class BanRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


class StatusChangeResult(BaseModel):
    ok: bool = True
    account_id: str
    mt4_login: int | None
    status: str


async def _result(session, account_id: str) -> StatusChangeResult:
    out = await svc.get_account(session, account_id)
    return StatusChangeResult(account_id=out["account_id"], mt4_login=out["mt4_login"], status=out["status"])


@router.post("/admin/accounts/{account_id}/freeze", response_model=StatusChangeResult, summary="계좌 비활성")
async def freeze_account(
    account_id: str, admin: AdminUser, session: Session, body: Annotated[FreezeRequest | None, Body()] = None
) -> StatusChangeResult:
    await svc.freeze(session, admin, account_id, body.reason if body else None)
    await session.commit()
    return await _result(session, account_id)


@router.post("/admin/accounts/{account_id}/unfreeze", response_model=StatusChangeResult, summary="계좌 활성 복귀")
async def unfreeze_account(account_id: str, admin: AdminUser, session: Session) -> StatusChangeResult:
    await svc.unfreeze(session, admin, account_id)
    await session.commit()
    return await _result(session, account_id)


@router.post("/admin/accounts/{account_id}/ban", response_model=StatusChangeResult, summary="계좌 영구정지")
async def ban_account(account_id: str, body: BanRequest, admin: AdminUser, session: Session) -> StatusChangeResult:
    await svc.ban(session, admin, account_id, body.reason)
    await session.commit()
    return await _result(session, account_id)
