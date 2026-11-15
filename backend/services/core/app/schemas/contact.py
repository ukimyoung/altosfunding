"""문의(Contact Us) 스키마. 기존 서버(/support/contact, /admin/contacts)와 같은 형태."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

# 카테고리는 core.contact_categories의 code. 백오피스에서 추가·수정한다.
ContactCategory = str
ContactStatus = Literal["RECEIVED", "PROCESSING", "ANSWERED"]


class ContactSubmitRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    category: str = Field(min_length=1, max_length=40)
    subject: str = Field(min_length=1, max_length=500)
    message: str = Field(min_length=1, max_length=1000)
    recaptcha_token: str | None = None


class ContactSubmitResponse(BaseModel):
    id: int
    message_key: str


class InquiryListItem(BaseModel):
    id: int
    name: str
    email: str
    subject: str
    category: ContactCategory
    status: ContactStatus
    created_at: datetime


class InquiryListResponse(BaseModel):
    items: list[InquiryListItem]
    total: int
    page: int
    size: int
    pages: int
    unanswered_count: int


class InquiryDetailOut(InquiryListItem):
    message: str
    reply_draft: str | None = None
    reply_body: str | None = None
    replied_at: datetime | None = None
    replied_by: str | None = None
    replied_by_name: str | None = None
    user_id: str | None = None


class InquiryDraftRequest(BaseModel):
    reply_draft: str = Field(default="", max_length=10000)


class InquiryReplyRequest(BaseModel):
    reply_body: str = Field(min_length=1, max_length=10000)


# ── 카테고리 ────────────────────────────────────────────────


class ContactCategoryLocaleBody(BaseModel):
    name: str | None = Field(default=None, max_length=100)


class ContactCategoryCreate(BaseModel):
    """name 또는 locales.en.name이 필요하다."""

    name: str | None = Field(default=None, max_length=100)
    locales: dict[str, ContactCategoryLocaleBody] | None = None


class ContactCategoryUpdate(ContactCategoryCreate):
    pass


class ContactCategoryReorderRequest(BaseModel):
    ordered_ids: list[int] = Field(min_length=1)


class ContactCategoryAdminOut(BaseModel):
    id: int
    code: str
    name: str
    sort_order: int
    contact_count: int
    locales: dict[str, dict[str, str]]


class ContactCategoryPublicOut(BaseModel):
    code: str
    name: str
