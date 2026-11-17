"""메일 발송 이력 API (백오피스 '운영 관리 > 이메일/알림 관리 > 발송 이력').

GET /admin/logs             발송 이력 목록 (템플릿·상태·수신자·기간 필터, 성공/실패 요약)
GET /admin/logs/{log_id}    한 통의 상세 (오류 메시지, SES 메시지 ID)
GET /admin/events           필터 드롭다운용 템플릿 목록
"""

from typing import Annotated

from fastapi import APIRouter, Query

from app.deps import AdminUser, Session
from app.services import email_log as svc

router = APIRouter(tags=["admin-email-logs"])


@router.get("/admin/logs", summary="메일 발송 이력")
async def list_logs(
    admin: AdminUser,
    session: Session,
    event_type: Annotated[str | None, Query(description="템플릿 코드")] = None,
    status: Annotated[str | None, Query(description="SENT | FAILED")] = None,
    keyword: Annotated[str | None, Query(description="수신자 이메일 / 제목")] = None,
    start_date: Annotated[str | None, Query(description="YYYY-MM-DD (KST)")] = None,
    end_date: Annotated[str | None, Query(description="YYYY-MM-DD (KST)")] = None,
    group_by_batch: Annotated[
        bool, Query(description="같은 묶음(수동 발송)을 한 줄로")
    ] = False,
    trace_id: Annotated[
        str | None, Query(description="묶음 id — 한 묶음의 수신자별 이력")
    ] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> dict:
    """최신순. 본문과 인증코드 같은 변수는 저장하지 않으므로 제목·수신자·결과만 보여 준다."""
    return await svc.list_logs(
        session,
        event_type=event_type or None,
        status=status or None,
        keyword=keyword,
        start_date=start_date,
        end_date=end_date,
        group_by_batch=group_by_batch,
        trace_id=trace_id or None,
        page=page,
        page_size=page_size,
    )


@router.get("/admin/logs/{log_id}", summary="메일 발송 이력 상세")
async def get_log(log_id: int, admin: AdminUser, session: Session) -> dict:
    return await svc.get_log(session, log_id)


@router.get("/admin/events", summary="발송 이력 필터용 템플릿 목록")
async def list_events(admin: AdminUser, session: Session) -> dict:
    return {"events": await svc.list_event_types(session)}
