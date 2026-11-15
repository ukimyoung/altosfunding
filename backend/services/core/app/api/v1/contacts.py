"""문의(Contact Us) API. 경로와 응답 형태는 기존 서버와 같다.

- 사용자: POST /support/contact (웹 'My Page > Contact Us', 랜딩 푸터. 로그인 없이도 가능, reCAPTCHA 확인)
- 관리자: /admin/contacts (백오피스 '운영 관리 > 문의하기')
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query, Request

from app.api.v1.auth import Session, _client_ip
from app.deps import AdminUser, OptionalUser
from app.schemas.contact import (
    ContactCategory,
    ContactStatus,
    ContactSubmitRequest,
    ContactSubmitResponse,
    InquiryDetailOut,
    InquiryDraftRequest,
    InquiryListResponse,
    InquiryReplyRequest,
)
from app.services import contact as svc
from app.services.announcement import request_locale
from app.services.email import EmailSender, get_email_sender
from app.services.recaptcha import verify_recaptcha

public_router = APIRouter(prefix="/support", tags=["support"])
admin_router = APIRouter(prefix="/admin/contacts", tags=["admin-contacts"])

Sender = Annotated[EmailSender, Depends(get_email_sender)]


@public_router.post("/contact", status_code=201, response_model=ContactSubmitResponse, summary="문의 제출")
async def submit_contact(
    body: ContactSubmitRequest,
    request: Request,
    session: Session,
    sender: Sender,
    user: OptionalUser,
    accept_language: Annotated[str | None, Header(alias="Accept-Language")] = None,
) -> ContactSubmitResponse:
    """로그인하지 않아도 된다. 로그인한 상태면 문의에 회원을 연결한다."""
    await verify_recaptcha(body.recaptcha_token, _client_ip(request))
    contact = await svc.submit(session, sender, body, user, request_locale(accept_language))
    return ContactSubmitResponse(id=contact.id, message_key="support.message_received")


@admin_router.get("", response_model=InquiryListResponse, summary="문의 목록")
async def list_contacts(
    admin: AdminUser,
    session: Session,
    q: Annotated[str | None, Query(description="이름 또는 제목 검색 (이메일 제외)")] = None,
    category: ContactCategory | None = None,
    status: ContactStatus | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> InquiryListResponse:
    """필터는 AND. unanswered_count는 필터와 상관없이 전체 미답변(접수+처리중) 수."""
    return InquiryListResponse(
        **await svc.list_admin(session, keyword=q, category=category, status=status, page=page, size=size)
    )


@admin_router.get("/{contact_id}", response_model=InquiryDetailOut, summary="문의 상세")
async def get_contact(contact_id: int, admin: AdminUser, session: Session) -> InquiryDetailOut:
    return await svc.get_admin(session, contact_id)


@admin_router.patch("/{contact_id}/draft", response_model=InquiryDetailOut, summary="답변 임시저장")
async def save_draft(
    contact_id: int, body: InquiryDraftRequest, admin: AdminUser, session: Session
) -> InquiryDetailOut:
    """접수(RECEIVED) 문의는 처리중(PROCESSING)이 된다. 답변 완료 문의는 409."""
    return await svc.save_draft(session, contact_id, body.reply_draft)


@admin_router.post("/{contact_id}/reply", response_model=InquiryDetailOut, summary="답변 전송")
async def reply_contact(
    contact_id: int, body: InquiryReplyRequest, admin: AdminUser, session: Session, sender: Sender
) -> InquiryDetailOut:
    """답변을 저장하고 답변 완료(ANSWERED)로 바꾼 뒤 문의자에게 답변 메일을 보낸다."""
    return await svc.reply(session, sender, contact_id, body.reply_body, admin)
