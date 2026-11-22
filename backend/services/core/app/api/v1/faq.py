"""FAQ API. 경로와 응답 형태는 기존 서버와 같다.

- 관리자: /admin/faq (백오피스 '운영 관리 > FAQ')
- 사용자: /support/faq (웹 Help Center FAQ·랜딩 FAQ, 로그인 없이 볼 수 있음)
"""

from typing import Annotated

from fastapi import APIRouter, Header, Query, Response

from app.api.v1.auth import Session
from app.deps import AdminUser
from app.schemas.faq import (
    FaqAdminDetailOut,
    FaqAdminPage,
    FaqCategoryAdminOut,
    FaqCategoryCreate,
    FaqCategoryPublicOut,
    FaqCategoryUpdate,
    FaqCreate,
    FaqPublicOut,
    FaqReorderRequest,
    FaqStatus,
    FaqUpdate,
)
from app.services import faq as svc
from app.services.announcement import pages_of, request_locale

admin_router = APIRouter(prefix="/admin/faq", tags=["admin-faq"])
public_router = APIRouter(prefix="/support/faq", tags=["support"])

Page = Annotated[int, Query(ge=1)]
Size = Annotated[int, Query(ge=1, le=100)]
AcceptLanguage = Annotated[str | None, Header(alias="Accept-Language")]


# ── 관리자: 카테고리 ────────────────────────────────────────
# 고정 경로(/categories, /reorder)를 /{faq_id}보다 먼저 둔다.


@admin_router.get("/categories", response_model=list[FaqCategoryAdminOut], summary="FAQ 카테고리 목록")
async def list_categories(admin: AdminUser, session: Session) -> list[FaqCategoryAdminOut]:
    """faq_count는 숨김을 포함한 FAQ 수."""
    return await svc.list_categories_admin(session)


@admin_router.post("/categories", response_model=FaqCategoryAdminOut, status_code=201, summary="FAQ 카테고리 추가")
async def create_category(body: FaqCategoryCreate, admin: AdminUser, session: Session) -> FaqCategoryAdminOut:
    """name 또는 locales.en.name이 필요하다. 다른 언어 이름은 locales에 넣는다."""
    out = await svc.create_category(session, body.name, body.locales)
    await session.commit()
    return out


@admin_router.put("/categories/reorder", status_code=204, summary="FAQ 카테고리 순서 저장")
async def reorder_categories(body: FaqReorderRequest, admin: AdminUser, session: Session) -> Response:
    await svc.reorder_categories(session, body.ordered_ids)
    await session.commit()
    return Response(status_code=204)


@admin_router.put("/categories/{category_id}", response_model=FaqCategoryAdminOut, summary="FAQ 카테고리 수정")
async def update_category(
    category_id: int, body: FaqCategoryUpdate, admin: AdminUser, session: Session
) -> FaqCategoryAdminOut:
    """locales에 보낸 언어만 바꾼다. 빈 이름을 보내면 그 언어 이름을 지운다."""
    out = await svc.update_category(session, category_id, body.name, body.locales)
    await session.commit()
    return out


@admin_router.delete("/categories/{category_id}", status_code=204, summary="FAQ 카테고리 삭제")
async def delete_category(category_id: int, admin: AdminUser, session: Session) -> Response:
    """FAQ가 남아 있으면 409 category_in_use."""
    await svc.delete_category(session, category_id)
    await session.commit()
    return Response(status_code=204)


# ── 관리자: FAQ ─────────────────────────────────────────────


@admin_router.put("/reorder", status_code=204, summary="FAQ 노출 순서 저장")
async def reorder_faqs(body: FaqReorderRequest, admin: AdminUser, session: Session) -> Response:
    """모든 FAQ(숨김 포함)를 원하는 순서로 한 번씩 보낸다."""
    await svc.reorder_faqs(session, body.ordered_ids)
    await session.commit()
    return Response(status_code=204)


@admin_router.get("", response_model=FaqAdminPage, summary="FAQ 목록")
async def list_faqs(
    admin: AdminUser,
    session: Session,
    keyword: str | None = None,
    q: Annotated[str | None, Query(include_in_schema=False)] = None,
    category_id: int | None = None,
    status: FaqStatus | None = None,
    page: Page = 1,
    size: Size = 20,
) -> FaqAdminPage:
    """노출 순서대로. keyword(또는 q)는 모든 언어의 질문·답변에서 찾는다."""
    items, total = await svc.list_faqs_admin(
        session, keyword=keyword or q, category_id=category_id, status=status, page=page, size=size
    )
    return FaqAdminPage(items=items, total=total, page=page, size=size, pages=pages_of(total, size))


@admin_router.post("", response_model=FaqAdminDetailOut, status_code=201, summary="FAQ 등록")
async def create_faq(body: FaqCreate, admin: AdminUser, session: Session) -> FaqAdminDetailOut:
    """영문 질문·답변(locales.en 또는 question·answer)은 필수다. 새 FAQ는 목록 맨 뒤에 붙는다."""
    faq_id = await svc.create_faq(session, body, admin)
    await session.commit()
    return await svc.get_faq_admin(session, faq_id)


@admin_router.get("/{faq_id}", response_model=FaqAdminDetailOut, summary="FAQ 상세")
async def get_faq(faq_id: int, admin: AdminUser, session: Session) -> FaqAdminDetailOut:
    return await svc.get_faq_admin(session, faq_id)


@admin_router.put("/{faq_id}", response_model=FaqAdminDetailOut, summary="FAQ 수정")
async def update_faq(faq_id: int, body: FaqUpdate, admin: AdminUser, session: Session) -> FaqAdminDetailOut:
    """locales를 보내면 다른 언어 번역 전체를 그 값으로 바꾼다."""
    await svc.update_faq(session, faq_id, body)
    await session.commit()
    return await svc.get_faq_admin(session, faq_id)


@admin_router.delete("/{faq_id}", status_code=204, summary="FAQ 삭제")
async def delete_faq(faq_id: int, admin: AdminUser, session: Session) -> Response:
    await svc.delete_faq(session, faq_id)
    await session.commit()
    return Response(status_code=204)


# ── 사용자 화면 ─────────────────────────────────────────────


@public_router.get("/categories", response_model=list[FaqCategoryPublicOut], summary="FAQ 카테고리 (게시중 count)")
async def list_public_categories(
    session: Session, accept_language: AcceptLanguage = None
) -> list[FaqCategoryPublicOut]:
    """게시중인 FAQ가 1건 이상 있는 카테고리만. 이름은 Accept-Language 언어로."""
    return await svc.list_categories_public(session, request_locale(accept_language))


@public_router.get("", response_model=list[FaqPublicOut], summary="FAQ 목록 (게시중)")
async def list_public_faqs(
    session: Session,
    accept_language: AcceptLanguage = None,
    category_id: int | None = None,
    q: str | None = None,
) -> list[FaqPublicOut]:
    """게시중인 FAQ 전체 (노출 순서, 페이지 없음). 질문·답변은 Accept-Language 언어(없으면 영어)."""
    return await svc.list_faqs_public(
        session, locale=request_locale(accept_language), keyword=q, category_id=category_id
    )
