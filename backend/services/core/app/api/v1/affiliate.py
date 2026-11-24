"""회원 제휴 프로그램(IB) API: 웹 'My Page > Affiliate Program' (Performance Overview·Performance Detail)."""

from typing import Annotated

from fastapi import APIRouter, Query

from app.deps import CurrentUser, Session
from app.services import affiliate_member as svc
from app.services import wallet

router = APIRouter(prefix="/affiliate", tags=["affiliate"])


@router.get("/me", summary="내 IB 요약 (IB가 아니면 is_ib=false)")
async def get_me(user: CurrentUser, session: Session) -> dict:
    return await svc.overview(session, user)


@router.get(
    "/network", summary="내 하위 조직도 (수당 조직 기준, 하위 회원 이름·이메일 가림)"
)
async def get_network(user: CurrentUser, session: Session) -> dict:
    return await svc.network(session, user)


@router.get("/commissions", summary="내 IB 커미션 내역")
async def get_commissions(
    user: CurrentUser,
    session: Session,
    keyword: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 10,
) -> dict:
    start, end = wallet.day_range(start_date, end_date)
    return await svc.commissions(
        session, user, keyword=keyword, start=start, end=end, page=page, size=size
    )
