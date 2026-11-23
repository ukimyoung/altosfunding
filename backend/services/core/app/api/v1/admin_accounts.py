"""관리자 트레이딩 계좌 API (백오피스 트레이더 관리 > 계좌 관리: 챌린지·펀디드·데모·라이브 계좌관리, 회원 상세).

GET /admin/accounts                       계좌 목록 (tier·상태·상품·기간 필터, 계좌번호·이름·이메일 검색)
GET /admin/accounts-stats                 계좌 수 통계 (전체·진행중)
GET /admin/accounts/{account_id}          계좌 상세 (계좌 UUID 또는 MT4 번호)
GET /admin/accounts/{account_id}/trades   거래내역 (Worker가 MT4에서 수집한 청산 거래)
GET /admin/accounts/{account_id}/evaluation  챌린지 결과 (웹 Account Detail과 같은 최종 판정, 대회 종료 전이면 null)
POST /admin/accounts/{account_id}/freeze    비활성 (PENDING·ACTIVE → INACTIVE, 미결 포지션 있으면 거절)
POST /admin/accounts/{account_id}/unfreeze  활성 복귀 (INACTIVE → 대회 상태에 맞는 원래 상태)
POST /admin/accounts/{account_id}/ban       영구정지 (사유 필수, 되돌릴 수 없음)
POST /admin/accounts/{account_id}/issue-funded  합격(PASSED) 챌린지 계좌의 펀디드 계좌 수동 발급 (수동 발급 상품, 자동 발급이 안 됐거나 실패했을 때)
GET /admin/accounts/{account_id}/rules      룰 감시 상태·일일 결산·위반 기록 (트레이딩 룰 자동 검증)
GET /admin/rule-violations                  룰 위반 목록 (전체 계좌)

상태 변경 후 MT4 거래 잠금(ReadOnly)은 Worker가 맞춘다. 이력: core.trading_account_status_history
"""

import uuid
from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Body, Query
from pydantic import BaseModel, Field

from app.deps import AdminUser, Session
from app.schemas.challenge import AccountFinalEvaluationOut
from app.schemas.trading import (
    AdminAccount,
    AdminAccountPage,
    AdminAccountStats,
    AdminTradePage,
)
from app.services import account_admin as svc
from app.services import challenge_evaluation, mt4_ingest, trading_rules
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


@router.get(
    "/admin/accounts/{account_id}/evaluation",
    response_model=AccountFinalEvaluationOut | None,
    summary="계좌 챌린지 결과 (웹 Account Detail과 같은 최종 판정)",
)
async def account_evaluation(account_id: str, admin: AdminUser, session: Session) -> AccountFinalEvaluationOut | None:
    """대회가 끝나고 내려진 최종 판정 (Worker 자동 또는 관리자 확인). 대회 기간 중·판정 전·챌린지 계좌가 아니면 null."""
    account = await svc.get_account(session, account_id)
    return await challenge_evaluation.final_out(session, uuid.UUID(account["account_id"]))


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


@router.post(
    "/admin/accounts/{account_id}/issue-funded", response_model=AdminAccount,
    summary="펀디드 계좌 수동 발급 (합격한 챌린지 계좌)",
    description="합격(PASSED)한 챌린지 계좌로 펀디드 계좌를 지금 발급한다. 이미 발급(또는 발급 대기) 중인 펀디드 계좌가 "
    "있으면 그 계좌를 돌려준다. 자동 발급 때 펀디드 상품이 연결되어 있지 않았거나 MT4 발급이 실패했을 때 쓴다.",
)
async def issue_funded(account_id: str, admin: AdminUser, session: Session) -> AdminAccount:
    funded_id = await svc.issue_funded(session, account_id)
    await session.commit()
    return AdminAccount(**await svc.get_account(session, str(funded_id)))


# ── 트레이딩 룰 자동 검증 (1단계: 기록만) ──────────────────────────


class RuleViolationOut(BaseModel):
    id: int
    account_id: str
    challenge_id: str | None
    rule_key: str = Field(description="MAX_DRAWDOWN | DAILY_LOSS | CONSISTENCY")
    severity: str = Field(description="HARD(탈락·정지 사유) | WARN(경고)")
    trading_date: date
    detected_at: datetime
    observed_value: float | None
    limit_value: float | None
    detail: str | None
    mode: str = Field(description="SHADOW(기록만) | ENFORCED(조치까지)")
    action: str
    status: str = Field(description="OPEN | ACTIONED | DISMISSED")


class RuleViolationListItem(RuleViolationOut):
    mt4_login: int | None
    tier: str
    email: str


class RuleViolationPage(BaseModel):
    items: list[RuleViolationListItem]
    total: int
    page: int
    size: int
    pages: int


class DailyStatOut(BaseModel):
    trading_date: date
    period_start: datetime
    period_end: datetime
    start_balance: float
    start_equity: float
    close_balance: float
    close_equity: float
    day_pnl: float
    low_equity: float | None
    high_equity: float | None
    fills_count: int
    is_trading_day: bool
    dd_floor_before: float | None
    dd_floor_after: float | None


class RiskStateOut(BaseModel):
    dd_amount: float | None
    dd_floor: float | None
    peak_close_equity: float | None
    current_trading_date: date
    day_start_balance: float
    day_start_equity: float
    last_equity: float | None
    last_checked_at: datetime | None


class AccountRulesOut(BaseModel):
    account_id: str
    mt4_login: int | None
    state: RiskStateOut | None
    daily_stats: list[DailyStatOut]
    violations: list[RuleViolationOut]


def _floats(obj, fields: list[str]) -> dict:
    out = {}
    for name in fields:
        value = getattr(obj, name)
        out[name] = float(value) if value is not None and name not in ("trading_date", "period_start", "period_end",
                                                                       "current_trading_date", "last_checked_at",
                                                                       "fills_count", "is_trading_day") else value
    return out


@router.get("/admin/accounts/{account_id}/rules", response_model=AccountRulesOut, summary="계좌 룰 감시 상태·일일 결산·위반")
async def account_rules(account_id: str, admin: AdminUser, session: Session) -> AccountRulesOut:
    account = await svc.get_account(session, account_id)
    uid = uuid.UUID(account["account_id"])
    state = await session.get(trading_rules.AccountRiskState, uid)
    stats = await trading_rules.daily_stats(session, uid)
    violations = await trading_rules.violations_of(session, uid)
    return AccountRulesOut(
        account_id=account["account_id"],
        mt4_login=account["mt4_login"],
        state=RiskStateOut(**_floats(state, list(RiskStateOut.model_fields))) if state else None,
        daily_stats=[DailyStatOut(**_floats(s, list(DailyStatOut.model_fields))) for s in stats],
        violations=[RuleViolationOut(**trading_rules.violation_out(v)) for v in violations],
    )


@router.get("/admin/rule-violations", response_model=RuleViolationPage, summary="룰 위반 목록")
async def rule_violations(
    admin: AdminUser,
    session: Session,
    rule_key: Annotated[str | None, Query(description="MAX_DRAWDOWN | DAILY_LOSS | CONSISTENCY")] = None,
    severity: Annotated[str | None, Query(description="HARD | WARN")] = None,
    status: Annotated[str | None, Query(description="OPEN | ACTIONED | DISMISSED")] = None,
    tier: Annotated[str | None, Query(description="CHALLENGE | FUNDED")] = None,
    keyword: Annotated[str | None, Query(description="MT4 계좌번호·이메일")] = None,
    page: Page = 1,
    size: Size = 20,
) -> RuleViolationPage:
    items, total = await trading_rules.list_violations(
        session, rule_key=rule_key, severity=severity, status=status, tier=tier, keyword=keyword, page=page, size=size
    )
    return RuleViolationPage(items=items, total=total, page=page, size=size, pages=pages(total, size))
