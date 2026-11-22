"""FAQ·FAQ 카테고리. 동작은 기존 서버와 같다.

- 카테고리: 이름 중복 불가, FAQ가 남아 있으면 삭제 불가, 순서는 전체를 한 번에 저장.
- FAQ: 상태 PUBLISHED(게시중)·HIDDEN(숨김), 노출 순서는 전체 FAQ 하나의 순서(새 FAQ는 맨 뒤).
- 답변은 일반 텍스트다 (웹이 텍스트로 보여 준다).

언어 처리는 공지사항과 같다: en은 컬럼에, 다른 언어는 translations(jsonb)에 두고,
사용자 화면은 Accept-Language 언어로 보여 주며 번역이 없으면 en으로 보여 준다.
"""

from collections.abc import Mapping
from typing import Any

from sqlalchemy import Select, Text, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import AppError
from app.models import Faq, FaqCategory, User
from app.schemas.faq import (
    FaqAdminDetailOut,
    FaqAdminListItem,
    FaqCategoryAdminOut,
    FaqCategoryLocaleBody,
    FaqCategoryPublicOut,
    FaqItemLocaleBody,
    FaqPublicOut,
)
from app.services.announcement import _check_locale, _clean

DEFAULT_LOCALE = "en"
STATUS_PUBLISHED = "PUBLISHED"


# ── 카테고리 ────────────────────────────────────────────────


def _category_locales(category: FaqCategory) -> dict[str, dict[str, str]]:
    locales = {DEFAULT_LOCALE: {"name": category.name}}
    for code, body in (category.translations or {}).items():
        if isinstance(body, Mapping) and body.get("name"):
            locales[code] = {"name": str(body["name"])}
    return locales


def _category_name(name: str, translations: dict | None, locale: str) -> str:
    if locale != DEFAULT_LOCALE:
        body = (translations or {}).get(locale)
        if isinstance(body, Mapping) and body.get("name"):
            return str(body["name"])
    return name


def _category_out(category: FaqCategory, count: int) -> FaqCategoryAdminOut:
    return FaqCategoryAdminOut(
        id=category.id,
        name=category.name,
        sort_order=category.sort_order,
        faq_count=count,
        locales=_category_locales(category),
    )


def _apply_category_locales(
    category: FaqCategory, name: str | None, locales: dict[str, FaqCategoryLocaleBody] | None
) -> None:
    """en 이름은 name 컬럼으로, 나머지 언어는 translations에 합친다. 빈 이름을 보내면 그 언어를 지운다."""
    locales = locales or {}
    en_name = _clean(name) if name is not None else None
    if DEFAULT_LOCALE in locales and locales[DEFAULT_LOCALE].name is not None:
        en_name = _clean(locales[DEFAULT_LOCALE].name)
    if en_name is not None:
        if not en_name:
            raise AppError(400, "locales.en_required", "영문 카테고리 이름은 필수입니다.")
        category.name = en_name

    translations = dict(category.translations or {})
    for code, body in locales.items():
        _check_locale(code)
        if code == DEFAULT_LOCALE or body.name is None:
            continue
        value = _clean(body.name)
        if value:
            translations[code] = {"name": value}
        else:
            translations.pop(code, None)
    category.translations = translations


async def _count_by_category(session: AsyncSession, published_only: bool = False) -> dict[int, int]:
    stmt = select(Faq.category_id, func.count()).group_by(Faq.category_id)
    if published_only:
        stmt = stmt.where(Faq.status == STATUS_PUBLISHED)
    return dict((await session.execute(stmt)).all())


async def _ensure_unique_category_name(session: AsyncSession, name: str, exclude_id: int | None = None) -> None:
    stmt = select(FaqCategory.id).where(func.lower(FaqCategory.name) == name.lower())
    if exclude_id is not None:
        stmt = stmt.where(FaqCategory.id != exclude_id)
    # 이름을 바꾼 객체가 먼저 flush되면 UNIQUE 위반이 나므로 flush 없이 확인한다.
    with session.no_autoflush:
        exists = await session.scalar(stmt) is not None
    if exists:
        raise AppError(409, "category_exists", f"이미 있는 카테고리 이름입니다: {name}")


async def get_category(session: AsyncSession, category_id: int, lock: bool = False) -> FaqCategory:
    category = await session.get(FaqCategory, category_id, with_for_update=lock)
    if category is None:
        raise AppError(404, "faq_category_not_found", "FAQ 카테고리를 찾을 수 없습니다.")
    return category


async def list_categories_admin(session: AsyncSession) -> list[FaqCategoryAdminOut]:
    counts = await _count_by_category(session)
    rows = await session.scalars(select(FaqCategory).order_by(FaqCategory.sort_order, FaqCategory.id))
    return [_category_out(c, counts.get(c.id, 0)) for c in rows]


async def create_category(
    session: AsyncSession, name: str | None, locales: dict[str, FaqCategoryLocaleBody] | None
) -> FaqCategoryAdminOut:
    category = FaqCategory(name="", translations={})
    _apply_category_locales(category, name if name is not None else "", locales)
    await _ensure_unique_category_name(session, category.name)
    max_order = await session.scalar(select(func.coalesce(func.max(FaqCategory.sort_order), 0)))
    category.sort_order = (max_order or 0) + 1
    session.add(category)
    await session.flush()
    return _category_out(category, 0)


async def update_category(
    session: AsyncSession, category_id: int, name: str | None, locales: dict[str, FaqCategoryLocaleBody] | None
) -> FaqCategoryAdminOut:
    category = await get_category(session, category_id, lock=True)
    _apply_category_locales(category, name, locales)
    await _ensure_unique_category_name(session, category.name, exclude_id=category.id)
    await session.flush()
    counts = await _count_by_category(session)
    return _category_out(category, counts.get(category.id, 0))


async def delete_category(session: AsyncSession, category_id: int) -> None:
    category = await get_category(session, category_id, lock=True)
    count = await session.scalar(select(func.count()).select_from(Faq).where(Faq.category_id == category_id))
    if count:
        raise AppError(409, "category_in_use", f"이 카테고리에 FAQ {count}건이 있어 삭제할 수 없습니다.")
    await session.delete(category)


async def reorder_categories(session: AsyncSession, ordered_ids: list[int]) -> None:
    categories = {c.id: c for c in await session.scalars(select(FaqCategory).with_for_update())}
    if len(ordered_ids) != len(set(ordered_ids)) or set(ordered_ids) != set(categories):
        raise AppError(400, "invalid_reorder", "모든 카테고리를 한 번씩 보내야 합니다.")
    for index, category_id in enumerate(ordered_ids, start=1):
        categories[category_id].sort_order = index


async def list_categories_public(session: AsyncSession, locale: str) -> list[FaqCategoryPublicOut]:
    """게시중인 FAQ가 1건 이상 있는 카테고리만. faq_count는 게시중 FAQ 수."""
    counts = await _count_by_category(session, published_only=True)
    if not counts:
        return []
    rows = await session.scalars(
        select(FaqCategory)
        .where(FaqCategory.id.in_(list(counts)))
        .order_by(FaqCategory.sort_order, FaqCategory.id)
    )
    return [
        FaqCategoryPublicOut(
            id=c.id,
            name=_category_name(c.name, c.translations, locale),
            sort_order=c.sort_order,
            faq_count=counts[c.id],
            locale=locale,
            locales=_category_locales(c),
        )
        for c in rows
    ]


# ── FAQ ─────────────────────────────────────────────────────


def _faq_locales(item: Faq) -> dict[str, dict[str, str]]:
    locales = {DEFAULT_LOCALE: {"question": item.question, "answer": item.answer}}
    for code, body in (item.translations or {}).items():
        if isinstance(body, Mapping) and (body.get("question") or body.get("answer")):
            locales[code] = {"question": str(body.get("question") or ""), "answer": str(body.get("answer") or "")}
    return locales


def _localized(question: str, answer: str, translations: dict | None, locale: str) -> tuple[str, str]:
    """번역이 있으면 그 언어로, 없는 필드는 en으로."""
    if locale != DEFAULT_LOCALE:
        body = (translations or {}).get(locale)
        if isinstance(body, Mapping):
            return str(body.get("question") or question), str(body.get("answer") or answer)
    return question, answer


def _author_name(first: str | None, last: str | None, email: str | None) -> str | None:
    name = f"{first or ''} {last or ''}".strip()
    if name:
        return name
    return email.split("@")[0] if email else None


def _base_query() -> Select:
    return (
        select(Faq, FaqCategory.name, FaqCategory.translations, User.first_name, User.last_name, User.email)
        .join(FaqCategory, FaqCategory.id == Faq.category_id)
        .outerjoin(User, User.id == Faq.created_by)
    )


_ORDER = (Faq.sort_order.asc(), Faq.id.asc())


def _keyword_filter(keyword: str):
    """en 질문·답변과 모든 번역에서 찾는다 (기존 서버와 같음)."""
    escaped = keyword.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    pattern = f"%{escaped}%"
    return or_(
        Faq.question.ilike(pattern, escape="\\"),
        Faq.answer.ilike(pattern, escape="\\"),
        cast(Faq.translations, Text).ilike(pattern, escape="\\"),
    )


def _admin_fields(row: Any) -> dict[str, Any]:
    item: Faq = row[0]
    return {
        "id": item.id,
        "sort_order": item.sort_order,
        "question": item.question,
        "category_id": item.category_id,
        "category_name": row[1],
        "status": item.status,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
        "created_by": str(item.created_by) if item.created_by else None,
        "author_name": _author_name(row[3], row[4], row[5]),
        "locales": _faq_locales(item),
    }


async def list_faqs_admin(
    session: AsyncSession, *, keyword: str | None, category_id: int | None, status: str | None, page: int, size: int
) -> tuple[list[FaqAdminListItem], int]:
    stmt = _base_query()
    if category_id is not None:
        stmt = stmt.where(Faq.category_id == category_id)
    if status:
        stmt = stmt.where(Faq.status == status)
    if keyword and keyword.strip():
        stmt = stmt.where(_keyword_filter(keyword.strip()))
    total = await session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = (await session.execute(stmt.order_by(*_ORDER).offset((page - 1) * size).limit(size))).all()
    return [FaqAdminListItem(**_admin_fields(r)) for r in rows], total


async def get_faq_admin(session: AsyncSession, faq_id: int) -> FaqAdminDetailOut:
    row = (await session.execute(_base_query().where(Faq.id == faq_id))).first()
    if row is None:
        raise AppError(404, "faq_not_found", "FAQ를 찾을 수 없습니다.")
    return FaqAdminDetailOut(**_admin_fields(row), answer=row[0].answer)


async def _get_faq(session: AsyncSession, faq_id: int) -> Faq:
    item = await session.get(Faq, faq_id, with_for_update=True)
    if item is None:
        raise AppError(404, "faq_not_found", "FAQ를 찾을 수 없습니다.")
    return item


def _apply_faq_locales(
    item: Faq, *, question: str | None, answer: str | None, locales: dict[str, FaqItemLocaleBody] | None
) -> None:
    """en은 컬럼으로, 나머지 언어는 translations로. 질문·답변이 모두 빈 언어는 저장하지 않는다.

    locales를 보내면 다른 언어 번역 전체를 그 값으로 바꾼다 (백오피스는 내용이 있는 언어만 보낸다).
    """
    en = (locales or {}).get(DEFAULT_LOCALE)
    en_question = en.question if en and en.question is not None else question
    en_answer = en.answer if en and en.answer is not None else answer
    if en_question is not None:
        item.question = _clean(en_question)
    if en_answer is not None:
        item.answer = _clean(en_answer)
    if not item.question or not item.answer:
        raise AppError(400, "locales.en_required", "영문 질문과 답변은 필수입니다.")

    if locales is None:
        return
    translations: dict[str, dict[str, str]] = {}
    for code, body in locales.items():
        _check_locale(code)
        if code == DEFAULT_LOCALE:
            continue
        loc_question = _clean(body.question)
        loc_answer = _clean(body.answer)
        if loc_question or loc_answer:
            translations[code] = {"question": loc_question, "answer": loc_answer}
    item.translations = translations


async def _next_sort_order(session: AsyncSession) -> int:
    return (await session.scalar(select(func.coalesce(func.max(Faq.sort_order), 0))) or 0) + 1


async def create_faq(session: AsyncSession, body: Any, admin: User) -> int:
    await get_category(session, body.category_id)
    item = Faq(
        category_id=body.category_id,
        status=body.status,
        question="",
        answer="",
        translations={},
        created_by=admin.id,
    )
    _apply_faq_locales(item, question=body.question, answer=body.answer, locales=body.locales)
    # 새 FAQ는 목록 맨 뒤 순서를 받는다.
    item.sort_order = await _next_sort_order(session)
    session.add(item)
    await session.flush()
    return item.id


async def update_faq(session: AsyncSession, faq_id: int, body: Any) -> None:
    item = await _get_faq(session, faq_id)
    if body.category_id is not None and body.category_id != item.category_id:
        await get_category(session, body.category_id)
        item.category_id = body.category_id
    if body.status is not None:
        item.status = body.status
    _apply_faq_locales(item, question=body.question, answer=body.answer, locales=body.locales)
    await session.flush()


async def delete_faq(session: AsyncSession, faq_id: int) -> None:
    await session.delete(await _get_faq(session, faq_id))


async def reorder_faqs(session: AsyncSession, ordered_ids: list[int]) -> None:
    """모든 FAQ(숨김 포함)를 원하는 순서로 한 번씩 보낸다."""
    faqs = {f.id: f for f in await session.scalars(select(Faq).with_for_update())}
    if len(ordered_ids) != len(set(ordered_ids)) or set(ordered_ids) != set(faqs):
        raise AppError(400, "invalid_reorder", "모든 FAQ를 한 번씩 보내야 합니다.")
    for index, faq_id in enumerate(ordered_ids, start=1):
        faqs[faq_id].sort_order = index


# ── 사용자 화면 ─────────────────────────────────────────────


async def list_faqs_public(
    session: AsyncSession, *, locale: str, keyword: str | None, category_id: int | None
) -> list[FaqPublicOut]:
    """게시중인 FAQ 전체 (노출 순서대로, 페이지 없음)."""
    stmt = _base_query().where(Faq.status == STATUS_PUBLISHED)
    if category_id is not None:
        stmt = stmt.where(Faq.category_id == category_id)
    if keyword and keyword.strip():
        stmt = stmt.where(_keyword_filter(keyword.strip()))
    out: list[FaqPublicOut] = []
    for row in (await session.execute(stmt.order_by(*_ORDER))).all():
        item: Faq = row[0]
        question, answer = _localized(item.question, item.answer, item.translations, locale)
        out.append(
            FaqPublicOut(
                id=item.id,
                category_id=item.category_id,
                category=_category_name(row[1], row[2], locale),
                question=question,
                answer=answer,
                sort_order=item.sort_order,
                locale=locale,
                locales=_faq_locales(item),
            )
        )
    return out
