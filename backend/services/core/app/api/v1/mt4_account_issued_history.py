"""MT4 계좌번호 관리 API (백오피스 운영 관리 > 계좌 관리).

GET    /admin/mt4/account-issued-history                                   번호 발급 기록 목록 (서버·상태·출처·번호 검색)
GET    /admin/mt4/account-issued-history/pools                             상품별 번호 범위와 현재 카운터
POST   /admin/mt4/account-issued-history/blacklist                         번호(범위) 블랙리스트 등록 — 발급 대상에서 제외
DELETE /admin/mt4/account-issued-history/blacklist/{server}/{login}        관리자가 등록한 블랙리스트 해제

테이블: core.mt4_account_issued_history (20261119010000에서 core.mt4_logins 이름 변경)

server: demo = Challenge 계좌(챌린지·데모 서버) / live = Funded 계좌(펀디드·라이브 서버)
"""

from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Path, Query
from pydantic import BaseModel, Field

from app.deps import AdminUser, Session
from app.services import mt4_account_issued_history_admin as svc

router = APIRouter(tags=["admin-mt4-account-issued-history"])

Server = Literal["demo", "live"]


class PoolProductOut(BaseModel):
    product_id: str
    name: str
    # 이 상품의 번호 카운터가 이미 이 번호를 지나갔는지 (지나간 번호는 다시 발급되지 않는다)
    passed: bool


class Mt4LoginOut(BaseModel):
    mt4_server: str
    mt4_login: int
    status: str
    source: str
    reason: str | None
    product_id: str | None
    product_name: str | None
    account_id: str | None
    created_by_email: str | None
    created_at: datetime
    updated_at: datetime
    pool_products: list[PoolProductOut]


class Mt4LoginPage(BaseModel):
    items: list[Mt4LoginOut]
    total: int
    page: int
    page_size: int
    counts: dict[str, int]


class LoginPoolOut(BaseModel):
    product_id: str
    name: str
    tier_type: str
    is_active: bool
    pool_start: int
    pool_end: int
    last_mt4_login: int | None
    next_login: int


class BlacklistCreate(BaseModel):
    mt4_server: Server = Field(description="demo = Challenge 계좌 / live = Funded 계좌")
    login_from: int = Field(gt=0, description="번호 (범위면 시작 번호)")
    login_to: int | None = Field(None, gt=0, description="범위 끝 번호 (비우면 한 개)")
    reason: str = Field(min_length=1, max_length=200)


class SkippedLogin(BaseModel):
    mt4_login: int
    status: str
    source: str


class BlacklistResult(BaseModel):
    added: list[int]
    converted: list[int]
    skipped: list[SkippedLogin]


@router.get("/admin/mt4/account-issued-history", response_model=Mt4LoginPage, summary="MT4 번호 기록 목록")
async def list_logins(
    admin: AdminUser,
    session: Session,
    server: Annotated[Server, Query()] = "demo",
    status: Annotated[Literal["BLACKLISTED", "IN_USE", "RESERVED", "ORPHANED"] | None, Query()] = None,
    source: Annotated[Literal["SYSTEM", "ADMIN"] | None, Query()] = None,
    login: Annotated[str | None, Query(pattern=r"^\d{1,19}$")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> dict:
    return await svc.list_logins(
        session, server=server, status=status, source=source, login=login, page=page, page_size=page_size
    )


@router.get("/admin/mt4/account-issued-history/pools", response_model=list[LoginPoolOut], summary="상품별 MT4 번호 범위")
async def login_pools(admin: AdminUser, session: Session, server: Annotated[Server, Query()] = "demo") -> list[dict]:
    return await svc.login_pools(session, server)


@router.post("/admin/mt4/account-issued-history/blacklist", response_model=BlacklistResult, summary="MT4 번호 블랙리스트 등록")
async def add_blacklist(body: BlacklistCreate, admin: AdminUser, session: Session) -> dict:
    return await svc.add_blacklist(
        session, admin, server=body.mt4_server, login_from=body.login_from, login_to=body.login_to,
        reason=body.reason.strip() or "관리자 등록",
    )


@router.delete("/admin/mt4/account-issued-history/blacklist/{server}/{login}", status_code=204, summary="MT4 번호 블랙리스트 해제")
async def release_blacklist(
    admin: AdminUser, session: Session, server: Server, login: Annotated[int, Path(gt=0)]
) -> None:
    await svc.release_blacklist(session, server, login)
