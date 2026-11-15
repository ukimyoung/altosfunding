"""공지사항 API. 경로와 응답 형태는 기존 서버와 같다.

- 관리자: /admin/announcements (백오피스 '운영 관리 > 공지사항')
- 사용자: /announcements (웹 'My Page > Announcements', 로그인 없이 볼 수 있음)
"""

from typing import Annotated

from fastapi import APIRouter, Header, Query, Response

from app.api.v1.auth import Session
from app.deps import AdminUser
from app.schemas.announcement import (
    AnnouncementAdminOut,
    AnnouncementAdminPage,
    AnnouncementCategoryAdminOut,
    AnnouncementCategoryCreate,
    AnnouncementCategoryPublicOut,
    AnnouncementCategoryUpdate,
    AnnouncementCreate,
    AnnouncementPublicDetailOut,
    AnnouncementPublicPage,
    AnnouncementReorderRequest,
    AnnouncementStatus,
    AnnouncementUpdate,
    ReorderRequest,
)
from app.services import announcement as svc

admin_router = APIRouter(prefix="/admin/announcements", tags=["admin-announcement"])
public_router = APIRouter(prefix="/announcements", tags=["announcement"])

Page = Annotated[int, Query(ge=1)]
Size = Annotated[int, Query(ge=1, le=100)]
AcceptLanguage = Annotated[str | None, Header(alias="Accept-Language")]


# ── 관리자: 카테고리 ────────────────────────────────────────
# 고정 경로(/categories, /reorder)를 /{announcement_id}보다 먼저 둔다.


@admin_router.get("/categories", response_model=list[AnnouncementCategoryAdminOut], summary="카테고리 목록")
async def list_categories(admin: AdminUser, session: Session) -> list[AnnouncementCategoryAdminOut]:
    return await svc.list_categories_admin(session)


@admin_router.post(
    "/categories", response_model=AnnouncementCategoryAdminOut, status_code=201, summary="카테고리 추가"
)
async def create_category(
    body: AnnouncementCategoryCreate, admin: AdminUser, session: Session
) -> AnnouncementCategoryAdminOut:
    """name 또는 locales.en.name이 필요하다. 다른 언어 이름은 locales에 넣는다."""
    out = await svc.create_category(session, body.name, body.locales)
    await session.commit()
    return out


@admin_router.put("/categories/reorder", status_code=204, summary="카테고리 순서 변경")
async def reorder_categories(body: ReorderRequest, admin: AdminUser, session: Session) -> Response:
    await svc.reorder_categories(session, body.ordered_ids)
    await session.commit()
    return Response(status_code=204)


@admin_router.put("/categories/{category_id}", response_model=AnnouncementCategoryAdminOut, summary="카테고리 수정")
async def update_category(
    category_id: int, body: AnnouncementCategoryUpdate, admin: AdminUser, session: Session
) -> AnnouncementCategoryAdminOut:
    """locales에 보낸 언어만 바꾼다. 빈 이름을 보내면 그 언어 이름을 지운다."""
    out = await svc.update_category(session, category_id, body.name, body.locales)
    await session.commit()
    return out


@admin_router.delete("/categories/{category_id}", status_code=204, summary="카테고리 삭제")
async def delete_category(category_id: int, admin: AdminUser, session: Session) -> Response:
    """공지가 남아 있으면 409 category_in_use."""
    await svc.delete_category(session, category_id)
    await session.commit()
    return Response(status_code=204)


# ── 관리자: 공지 ────────────────────────────────────────────


@admin_router.put("/reorder", status_code=204, summary="공지 노출 순서 변경")
async def reorder_announcements(body: AnnouncementReorderRequest, admin: AdminUser, session: Session) -> Response:
    """scope=global은 전체 목록, scope=category는 category_id 목록의 순서. 고정 공지는 빼고 보낸다."""
    await svc.reorder_announcements(session, body.ordered_ids, body.scope, body.category_id)
    await session.commit()
    return Response(status_code=204)


@admin_router.get("", response_model=AnnouncementAdminPage, summary="공지 목록")
async def list_announcements(
    admin: AdminUser,
    session: Session,
    q: str | None = None,
    keyword: Annotated[str | None, Query(include_in_schema=False)] = None,
    category_id: int | None = None,
    status: AnnouncementStatus | None = None,
    page: Page = 1,
    size: Size = 20,
) -> AnnouncementAdminPage:
    """q(또는 keyword)는 모든 언어의 제목·본문에서 찾는다."""
    items, total = await svc.list_announcements_admin(
        session, keyword=q or keyword, category_id=category_id, status=status, page=page, size=size
    )
    return AnnouncementAdminPage(items=items, total=total, page=page, size=size, pages=svc.pages_of(total, size))


@admin_router.post("", response_model=AnnouncementAdminOut, status_code=201, summary="공지 등록")
async def create_announcement(body: AnnouncementCreate, admin: AdminUser, session: Session) -> AnnouncementAdminOut:
    """영문 제목·본문(locales.en 또는 title·content)은 필수다. 본문 HTML은 저장 전에 정리한다."""
    announcement_id = await svc.create_announcement(session, body, admin)
    await session.commit()
    return await svc.get_announcement_admin(session, announcement_id)


@admin_router.get("/{announcement_id}", response_model=AnnouncementAdminOut, summary="공지 상세")
async def get_announcement(announcement_id: int, admin: AdminUser, session: Session) -> AnnouncementAdminOut:
    return await svc.get_announcement_admin(session, announcement_id)


@admin_router.put("/{announcement_id}", response_model=AnnouncementAdminOut, summary="공지 수정")
async def update_announcement(
    announcement_id: int, body: AnnouncementUpdate, admin: AdminUser, session: Session
) -> AnnouncementAdminOut:
    """locales를 보내면 다른 언어 번역 전체를 그 값으로 바꾼다."""
    await svc.update_announcement(session, announcement_id, body)
    await session.commit()
    return await svc.get_announcement_admin(session, announcement_id)


@admin_router.delete("/{announcement_id}", status_code=204, summary="공지 삭제")
async def delete_announcement(announcement_id: int, admin: AdminUser, session: Session) -> Response:
    await svc.delete_announcement(session, announcement_id)
    await session.commit()
    return Response(status_code=204)


# ── 사용자 화면 ─────────────────────────────────────────────


@public_router.get("/categories", response_model=list[AnnouncementCategoryPublicOut], summary="카테고리 목록")
async def list_public_categories(
    session: Session, accept_language: AcceptLanguage = None
) -> list[AnnouncementCategoryPublicOut]:
    """게시중인 공지가 있는 카테고리만. 이름은 Accept-Language 언어로."""
    return await svc.list_categories_public(session, svc.request_locale(accept_language))


@public_router.get("", response_model=AnnouncementPublicPage, summary="게시중인 공지 목록")
async def list_public_announcements(
    session: Session,
    accept_language: AcceptLanguage = None,
    keyword: str | None = None,
    category_id: int | None = None,
    page: Page = 1,
    size: Size = 20,
) -> AnnouncementPublicPage:
    """고정 공지가 먼저, 그다음 관리자가 정한 순서. 제목·본문은 Accept-Language 언어(없으면 영어)."""
    items, total = await svc.list_announcements_public(
        session,
        locale=svc.request_locale(accept_language),
        keyword=keyword,
        category_id=category_id,
        page=page,
        size=size,
    )
    return AnnouncementPublicPage(items=items, total=total, page=page, size=size, pages=svc.pages_of(total, size))


@public_router.get("/{announcement_id}", response_model=AnnouncementPublicDetailOut, summary="공지 상세")
async def get_public_announcement(
    announcement_id: int, session: Session, accept_language: AcceptLanguage = None
) -> AnnouncementPublicDetailOut:
    """게시중인 공지만. 이전·다음 글 id와 제목을 함께 준다."""
    return await svc.get_announcement_public(session, announcement_id, svc.request_locale(accept_language))
