"""메일 템플릿 관리 API (백오피스 '운영 관리 > 이메일/알림 관리 > 템플릿 관리').

경로·응답 형태는 기존 서버(/admin/templates)와 맞췄다. 기본 템플릿(is_system)은 수정만, 새로 등록한 템플릿은 삭제도 된다.
"""

from fastapi import APIRouter, Response, status

from app.api.v1.auth import Session
from app.deps import AdminUser
from app.schemas.email_template import (
    TemplateCreateRequest,
    TemplateDetail,
    TemplateListResponse,
    TemplatePreviewRequest,
    TemplatePreviewResponse,
    TemplateUpdateRequest,
)
from app.services import email_template as svc

router = APIRouter(prefix="/admin/templates", tags=["admin-email-templates"])


@router.get("", response_model=TemplateListResponse, summary="메일 템플릿 목록")
async def list_templates(admin: AdminUser, session: Session) -> TemplateListResponse:
    return TemplateListResponse(items=await svc.list_templates(session))


@router.post("", response_model=TemplateDetail, status_code=status.HTTP_201_CREATED, summary="메일 템플릿 신규 등록")
async def create_template(body: TemplateCreateRequest, admin: AdminUser, session: Session) -> TemplateDetail:
    """새 템플릿을 등록한다. 실제 발송은 서버 코드가 이 템플릿 코드(template_id)로 메일을 보낼 때 이뤄진다."""
    return await svc.create(session, body, admin.id)


# 고정 경로(/preview)를 /{template_id}보다 먼저 둔다.
@router.post("/preview", response_model=TemplatePreviewResponse, summary="메일 미리보기 (레이아웃 적용)")
async def preview_template(body: TemplatePreviewRequest, admin: AdminUser) -> TemplatePreviewResponse:
    html, subject = svc.preview(body.content_html, body.subject, body.locale, body.sample)
    return TemplatePreviewResponse(html=html, subject=subject)


@router.get("/{template_id}", response_model=TemplateDetail, summary="메일 템플릿 조회")
async def get_template(template_id: str, admin: AdminUser, session: Session) -> TemplateDetail:
    return await svc.get_detail(session, template_id)


@router.put("/{template_id}", response_model=TemplateDetail, summary="메일 템플릿 수정")
async def update_template(
    template_id: str, body: TemplateUpdateRequest, admin: AdminUser, session: Session
) -> TemplateDetail:
    return await svc.update(session, template_id, body, admin.id)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT, summary="메일 템플릿 삭제 (신규 등록분만)")
async def delete_template(template_id: str, admin: AdminUser, session: Session) -> Response:
    await svc.delete(session, template_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
