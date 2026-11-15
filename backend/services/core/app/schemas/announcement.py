"""공지사항 스키마. 필드 이름은 기존 서버(openapi.json)와 같다."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

AnnouncementStatus = Literal["PUBLISHED", "CLOSED"]


# ── 요청 ────────────────────────────────────────────────────


class AnnouncementLocaleBody(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    content: str | None = None


class CategoryLocaleBody(BaseModel):
    name: str | None = Field(default=None, max_length=100)


class AnnouncementCategoryCreate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    locales: dict[str, CategoryLocaleBody] | None = None


class AnnouncementCategoryUpdate(AnnouncementCategoryCreate):
    pass


class ReorderRequest(BaseModel):
    ordered_ids: list[int] = Field(min_length=1)


class AnnouncementReorderRequest(BaseModel):
    ordered_ids: list[int] = Field(min_length=1)
    scope: Literal["global", "category"]
    category_id: int | None = None


class AnnouncementCreate(BaseModel):
    category_id: int
    status: AnnouncementStatus = "PUBLISHED"
    is_pinned: bool = False
    # title·content는 locales.en 대신 쓸 수 있다 (기존 서버와 같음).
    title: str | None = Field(default=None, max_length=255)
    content: str | None = None
    locales: dict[str, AnnouncementLocaleBody] | None = None


class AnnouncementUpdate(BaseModel):
    category_id: int | None = None
    status: AnnouncementStatus | None = None
    is_pinned: bool | None = None
    title: str | None = Field(default=None, max_length=255)
    content: str | None = None
    # 보내면 다른 언어 번역 전체를 이 값으로 바꾼다 (빠진 언어는 지운다).
    locales: dict[str, AnnouncementLocaleBody] | None = None


# ── 응답 ────────────────────────────────────────────────────


class AnnouncementCategoryAdminOut(BaseModel):
    id: int
    name: str
    sort_order: int
    announcement_count: int = 0
    locales: dict[str, dict[str, str]] = {}


class AnnouncementCategoryPublicOut(AnnouncementCategoryAdminOut):
    locale: str = "en"


class AnnouncementAdminListItem(BaseModel):
    id: int
    title: str
    category_id: int
    category_name: str
    status: str
    is_pinned: bool
    sort_order: int
    category_sort_order: int
    created_at: datetime
    updated_at: datetime
    created_by: str | None = None
    author_name: str | None = None
    locales: dict[str, dict[str, str]] = {}


class AnnouncementAdminOut(AnnouncementAdminListItem):
    content: str


class AnnouncementAdminPage(BaseModel):
    items: list[AnnouncementAdminListItem]
    total: int
    page: int
    size: int
    pages: int


class AnnouncementPublicOut(BaseModel):
    id: int
    category_id: int
    category: str
    status: str
    is_pinned: bool
    title: str
    content: str
    created_at: datetime
    updated_at: datetime
    created_by: str | None = None
    author_name: str | None = None
    locale: str = "en"
    locales: dict[str, dict[str, str]] = {}


class AnnouncementPublicDetailOut(AnnouncementPublicOut):
    previous_id: int | None = None
    previous_title: str | None = None
    next_id: int | None = None
    next_title: str | None = None


class AnnouncementPublicPage(BaseModel):
    items: list[AnnouncementPublicOut]
    total: int
    page: int
    size: int
    pages: int
