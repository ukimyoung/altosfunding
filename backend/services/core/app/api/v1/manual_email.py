"""수동 메일 발송 API (백오피스 '운영 관리 > 이메일/알림 관리 > 수동 발송 관리').

POST  /admin/notifications/manual-send/recipients/search   조건 검색 (참고용 회원 목록)
POST  /admin/notifications/manual-send/recipients/unsubscribed/search   수신거부 회원 (수신거부 관리 탭)
GET   /admin/notifications/manual-send/recipients/export   조건 검색 결과 CSV
POST  /admin/notifications/manual-send/drafts              임시 저장 (JSON, 또는 multipart: payload + CSV file)
GET   /admin/notifications/manual-send/drafts              작성 중인 메일 목록
PATCH /admin/notifications/manual-send/drafts/{id}         임시 저장 수정
POST  /admin/notifications/manual-send/drafts/{id}/send    발송 (즉시 또는 예약)
GET   /admin/notifications/manual-send/jobs/{id}           발송 진행 상황
POST  /admin/notifications/manual-send/jobs/{id}/cancel    예약 발송 취소
POST  /admin/notifications/manual-send/jobs/run-due        예약 발송 지금 한 번 실행 (테스트용)
POST  /internal/jobs/manual-emails                         예약 발송 주기 작업 (외부 스케줄러용)
"""

import hmac
from typing import Annotated, Any

from fastapi import APIRouter, BackgroundTasks, Header, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from starlette.datastructures import UploadFile

from app.config import settings
from app.deps import AdminUser, Sender, Session
from app.errors import AppError
from app.schemas.manual_email import DraftPayload, DraftUpdatePayload, ManualEmailFilter
from app.services import manual_email as svc
from app.services.files import public_base_url

router = APIRouter(tags=["admin-manual-email"])
BASE = "/admin/notifications/manual-send"

_DRAFT_BODY_DOC: dict[str, Any] = {
    "requestBody": {
        "content": {
            "application/json": {"schema": DraftPayload.model_json_schema()},
            "multipart/form-data": {
                "schema": {
                    "type": "object",
                    "properties": {
                        "payload": {"type": "string", "description": "DraftPayload JSON"},
                        "file": {"type": "string", "format": "binary", "description": "CSV (이메일 열)"},
                    },
                }
            },
        }
    }
}


@router.post(f"{BASE}/recipients/search", summary="수동 발송 대상 조건 검색")
async def search_recipients(body: ManualEmailFilter, admin: AdminUser, session: Session) -> dict:
    """활성 일반 회원만 검색한다. marketing_preview=true면 수신 동의하지 않은 회원을 제외 대상으로 표시한다."""
    return await svc.search(session, body)


@router.post(f"{BASE}/recipients/unsubscribed/search", summary="수신거부 회원 검색")
async def search_unsubscribed(body: ManualEmailFilter, admin: AdminUser, session: Session) -> dict:
    """마케팅 메일 수신에 동의하지 않은 활성 회원. unsubscribed_from/to는 수신거부 링크를 누른 날(KST)."""
    return await svc.search_unsubscribed(session, body)


@router.get(f"{BASE}/recipients/export", summary="조건 검색 결과 CSV", response_class=Response)
async def export_recipients(
    admin: AdminUser, session: Session, f: Annotated[ManualEmailFilter, Query()]
) -> Response:
    content = await svc.export_csv(session, f)
    return Response(
        content=content.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="recipients.csv"'},
    )


def _base_url(request: Request) -> str:
    """메일 속 수신거부 링크의 Core 주소."""
    return public_base_url(str(request.base_url))


async def _read_draft_request(request: Request) -> tuple[DraftPayload, tuple[str, bytes] | None]:
    try:
        if request.headers.get("content-type", "").startswith("multipart/form-data"):
            form = await request.form()
            raw = form.get("payload")
            file = form.get("file")
            body = DraftPayload.model_validate_json(raw if isinstance(raw, str) else "{}")
            if not isinstance(file, UploadFile):
                raise AppError(422, "csv_required", "CSV 파일을 올려주세요.")
            data = await file.read(svc.MAX_CSV_BYTES + 1)
            return body, (file.filename or "upload.csv", data)
        return DraftPayload.model_validate(await request.json()), None
    except ValidationError as exc:
        raise RequestValidationError(exc.errors()) from exc
    except ValueError as exc:  # JSON 형식 오류
        raise AppError(422, "invalid_body", "요청 형식이 올바르지 않습니다.") from exc


@router.post(f"{BASE}/drafts", summary="수동 발송 임시 저장", openapi_extra=_DRAFT_BODY_DOC)
async def create_draft(request: Request, admin: AdminUser, session: Session) -> dict:
    """대상·제목·본문을 저장하고 대상 요약(전체·발송·제외 수)과 미리보기를 돌려준다."""
    body, csv_file = await _read_draft_request(request)
    draft = await svc.create_draft(session, body, admin.id, csv_file)
    await session.commit()
    await session.refresh(draft)
    return await svc.draft_out(session, draft)


@router.get(f"{BASE}/drafts", summary="작성 중인 수동 발송 메일")
async def list_drafts(admin: AdminUser, session: Session) -> dict:
    """아직 보내지 않은 메일. 최근 저장한 것부터 (30일이 지나면 보이지 않는다)."""
    return {"items": [await svc.draft_out(session, d) for d in await svc.list_drafts(session)]}


@router.patch(f"{BASE}/drafts/{{draft_id}}", summary="수동 발송 임시 저장 수정")
async def update_draft(draft_id: str, body: DraftUpdatePayload, admin: AdminUser, session: Session) -> dict:
    draft = await svc.get_draft(session, draft_id, lock=True)
    await svc.update_draft(session, draft, body, admin.id)
    await session.commit()
    await session.refresh(draft)
    return await svc.draft_out(session, draft)


@router.post(f"{BASE}/drafts/{{draft_id}}/send", summary="수동 발송")
async def send_draft(
    draft_id: str,
    request: Request,
    admin: AdminUser,
    session: Session,
    sender: Sender,
    background: BackgroundTasks,
) -> dict:
    """즉시 발송은 응답 뒤 바로 보내기 시작하고, 예약 발송(send_at)은 그 시각에 주기 작업이 보낸다.
    진행 상황은 jobs/{job_id}, 보낸 결과는 발송 이력(trace_id = job_id)에서 본다."""
    draft = await svc.get_draft(session, draft_id, lock=True)
    job, summary = await svc.create_job(session, draft, admin.id)
    await session.commit()
    if job.send_at is None:
        background.add_task(svc.run_job_in_background, sender, job.id, _base_url(request))
    return {
        "job_id": str(job.id),
        "trace_id": str(job.id),
        "recipient_count": summary["eligible"],
        "skipped_count": summary["skipped"],
        "scheduled_at": job.send_at.isoformat() if job.send_at else None,
        "status": job.status,
    }


@router.post(f"{BASE}/jobs/run-due", summary="예약 발송 지금 한 번 실행")
async def run_due_now(request: Request, admin: AdminUser, session: Session, sender: Sender) -> dict:
    """외부 스케줄러를 붙이기 전, 테스트 서버에서 손으로 돌릴 때 쓴다."""
    return await svc.run_due_jobs(session, sender, _base_url(request))


@router.get(f"{BASE}/jobs/{{job_id}}", summary="수동 발송 진행 상황")
async def get_job(job_id: str, admin: AdminUser, session: Session) -> dict:
    return svc.job_out(await svc.get_job(session, job_id))


@router.post(f"{BASE}/jobs/{{job_id}}/cancel", summary="예약 발송 취소")
async def cancel_job(job_id: str, admin: AdminUser, session: Session) -> dict:
    job = await svc.get_job(session, job_id)
    await svc.cancel_job(session, job)
    await session.commit()
    return svc.job_out(job)


@router.post("/internal/jobs/manual-emails", summary="예약 수동 발송 (외부 스케줄러용)")
async def run_manual_email_jobs(
    request: Request,
    session: Session, sender: Sender, x_system_api_key: Annotated[str | None, Header()] = None
) -> dict:
    """외부 스케줄러(cron)가 1분마다 부른다. X-System-Api-Key 헤더가 SYSTEM_API_KEY와 같아야 한다."""
    if not settings.system_api_key:
        raise AppError(503, "system_api_key_not_configured", "SYSTEM_API_KEY가 설정되지 않았습니다.")
    if not x_system_api_key or not hmac.compare_digest(x_system_api_key, settings.system_api_key):
        raise AppError(403, "invalid_system_api_key", "Permission denied")
    return await svc.run_due_jobs(session, sender, _base_url(request))
