"""백오피스 대시보드.

GET /admin/dashboard/summary  시스템 상태 · 오늘 처리할 액션 · 기간 매출 · 대회 현황
GET /admin/dashboard/trends   매출 추이(합계·상품별), 챌린지·펀디드 계좌 생성 수 추이
"""

from typing import Annotated

from fastapi import APIRouter, Query

from app.deps import AdminUser, Session
from app.services import dashboard

router = APIRouter(tags=["admin-dashboard"])


@router.get("/admin/dashboard/summary", summary="대시보드 요약 (시스템·액션·매출·대회)")
async def dashboard_summary(
    admin: AdminUser,
    session: Session,
    range: Annotated[str | None, Query(description="today | yesterday | this_week | this_month (한국 시간, 기본 today)")] = None,
) -> dict:
    """액션 건수와 시스템 상태는 기간과 상관없이 지금 값이다. 매출은 선택 기간과 같은 길이의 직전 기간을 함께 준다."""
    return await dashboard.summary(session, range)


@router.get("/admin/dashboard/trends", summary="대시보드 추이 차트 (매출·계좌 생성 수)")
async def dashboard_trends(
    admin: AdminUser,
    session: Session,
    metric: Annotated[str, Query(description="revenue | accounts")],
    period: Annotated[str | None, Query(description="daily | weekly | monthly (기본 daily)")] = None,
    start_date: Annotated[str | None, Query(description="YYYY-MM-DD (한국 시간). 없으면 기본 구간")] = None,
    end_date: Annotated[str | None, Query(description="YYYY-MM-DD (한국 시간). 없으면 오늘")] = None,
) -> dict:
    """날짜를 안 주면 오늘까지 일별 7일 · 주별 8주 · 월별 6개월. 빈 칸도 0으로 채운다."""
    return await dashboard.trends(session, metric=metric, period=period, start_date=start_date, end_date=end_date)
