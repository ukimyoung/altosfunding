"""FAQ 스키마. 필드 이름은 기존 서버(openapi.json)와 같다."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

FaqStatus = Literal["PUBLISHED", "HIDDEN"]


# ── 요청 ────────────────────────────────────────────────────


class FaqCategoryLocaleBody(BaseModel):
    name: str | None = Field(default=None, max_length=100)


class FaqCategoryCreate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    locales: dict[str, FaqCategoryLocaleBody] | None = None


class FaqCategoryUpdate(FaqCategoryCreate):
    pass


class FaqItemLocaleBody(BaseModel):
    question: str | None = Field(default=None, max_length=500)
    answer: str | None = None


class FaqCreate(BaseModel):
    category_id: int
    status: FaqStatus = "PUBLISHED"
    # question·answer는 locales.en 대신 쓸 수 있다 (기존 서버와 같음).
    question: str | None = Field(default=None, max_length=500)
    answer: str | None = None
    locales: dict[str, FaqItemLocaleBody] | None = None


class FaqUpdate(BaseModel):
    category_id: int | None = None
    status: FaqStatus | None = None
    question: str | None = Field(default=None, max_length=500)
    answer: str | None = None
    # 보내면 다른 언어 번역 전체를 이 값으로 바꾼다 (빠진 언어는 지운다).
    locales: dict[str, FaqItemLocaleBody] | None = None


class FaqReorderRequest(BaseModel):
    ordered_ids: list[int] = Field(min_length=1)


# ── 응답 ────────────────────────────────────────────────────


class FaqCategoryAdminOut(BaseModel):
    id: int
    name: str
    sort_order: int
    faq_count: int = 0
    locales: dict[str, dict[str, str]] = {}


class FaqCategoryPublicOut(FaqCategoryAdminOut):
    locale: str = "en"


class FaqAdminListItem(BaseModel):
    id: int
    sort_order: int
    question: str
    category_id: int
    category_name: str
    status: FaqStatus
    created_at: datetime
    updated_at: datetime
    created_by: str | None = None
    author_name: str | None = None
    locales: dict[str, dict[str, str]] = {}


class FaqAdminDetailOut(FaqAdminListItem):
    answer: str


class FaqAdminPage(BaseModel):
    items: list[FaqAdminListItem]
    total: int
    page: int
    size: int
    pages: int


class FaqPublicOut(BaseModel):
    id: int
    category_id: int
    category: str
    question: str
    answer: str
    sort_order: int
    locale: str = "en"
    locales: dict[str, dict[str, str]] = {}
