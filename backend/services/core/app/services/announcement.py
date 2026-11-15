"""공지사항·공지 카테고리.

언어 처리: 기본 언어(en)의 제목·본문·카테고리 이름은 컬럼에, 다른 언어는 translations(jsonb)에 둔다.
응답의 locales는 {"en": {...}, "ko": {...}}처럼 값이 있는 언어만 담는다.
사용자 화면은 Accept-Language의 언어로 보여 주고, 번역이 없으면 en으로 보여 준다.
"""

import math
import re
from collections.abc import Mapping
from typing import Any

import nh3
from sqlalchemy import Select, Text, cast, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import AppError
from app.models import Announcement, AnnouncementCategory, User
from app.schemas.announcement import (
    AnnouncementAdminListItem,
    AnnouncementAdminOut,
    AnnouncementCategoryAdminOut,
    AnnouncementCategoryPublicOut,
    AnnouncementLocaleBody,
    AnnouncementPublicDetailOut,
    AnnouncementPublicOut,
    CategoryLocaleBody,
)

DEFAULT_LOCALE = "en"
STATUS_PUBLISHED = "PUBLISHED"
_LOCALE_RE = re.compile(r"^[a-z]{2,3}(-[A-Za-z]{2,4})?$")


def pages_of(total: int, size: int) -> int:
    return math.ceil(total / size) if total else 0


# ── 언어 ────────────────────────────────────────────────────


def request_locale(accept_language: str | None) -> str:
    """Accept-Language의 첫 언어. 'ko-KR,ko;q=0.9' → 'ko'. 없으면 en."""
    if not accept_language:
        return DEFAULT_LOCALE
    first = accept_language.split(",")[0].split(";")[0].strip().lower()
    primary = first.split("-")[0]
    return primary if re.fullmatch(r"[a-z]{2,3}", primary) else DEFAULT_LOCALE


def _check_locale(code: str) -> None:
    if not _LOCALE_RE.match(code):
        raise AppError(400, "invalid_locale", f"지원하지 않는 언어 코드입니다: {code}")


def _clean(value: str | None) -> str:
    return (value or "").strip()


def sanitize_html(content: str) -> str:
    """관리자가 쓴 본문은 사용자 화면에 HTML로 그대로 나가므로 script·이벤트 속성 등을 걷어낸다."""
    return nh3.clean(content).strip()


def _has_text(html: str) -> bool:
    text = re.sub(r"<[^>]*>", "", html).replace("&nbsp;", "").strip()
    return bool(text) or "<img" in html


# ── 카테고리 ────────────────────────────────────────────────


def _category_locales(category: AnnouncementCategory) -> dict[str, dict[str, str]]:
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


def _category_out(category: AnnouncementCategory, count: int) -> AnnouncementCategoryAdminOut:
    return AnnouncementCategoryAdminOut(
        id=category.id,
        name=category.name,
        sort_order=category.sort_order,
        announcement_count=count,
        locales=_category_locales(category),
    )


def _apply_category_locales(
    category: AnnouncementCategory,
    name: str | None,
    locales: dict[str, CategoryLocaleBody] | None,
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
    stmt = select(Announcement.category_id, func.count()).group_by(Announcement.category_id)
    if published_only:
        stmt = stmt.where(Announcement.status == STATUS_PUBLISHED)
    return dict((await session.execute(stmt)).all())


async def _ensure_unique_category_name(session: AsyncSession, name: str, exclude_id: int | None = None) -> None:
    stmt = select(AnnouncementCategory.id).where(func.lower(AnnouncementCategory.name) == name.lower())
    if exclude_id is not None:
        stmt = stmt.where(AnnouncementCategory.id != exclude_id)
    if await session.scalar(stmt) is not None:
        raise AppError(409, "category_exists", f"이미 있는 카테고리 이름입니다: {name}")


async def get_category(session: AsyncSession, category_id: int, lock: bool = False) -> AnnouncementCategory:
    category = await session.get(AnnouncementCategory, category_id, with_for_update=lock)
    if category is None:
        raise AppError(404, "announcement_category_not_found", "카테고리를 찾을 수 없습니다.")
    return category


async def list_categories_admin(session: AsyncSession) -> list[AnnouncementCategoryAdminOut]:
    counts = await _count_by_category(session)
    rows = await session.scalars(
        select(AnnouncementCategory).order_by(AnnouncementCategory.sort_order, AnnouncementCategory.id)
    )
    return [_category_out(c, counts.get(c.id, 0)) for c in rows]


async def create_category(
    session: AsyncSession, name: str | None, locales: dict[str, CategoryLocaleBody] | None
) -> AnnouncementCategoryAdminOut:
    category = AnnouncementCategory(name="", translations={})
    _apply_category_locales(category, name if name is not None else "", locales)
    await _ensure_unique_category_name(session, category.name)
    max_order = await session.scalar(select(func.coalesce(func.max(AnnouncementCategory.sort_order), 0)))
    category.sort_order = (max_order or 0) + 1
    session.add(category)
    await session.flush()
    return _category_out(category, 0)


async def update_category(
    session: AsyncSession, category_id: int, name: str | None, locales: dict[str, CategoryLocaleBody] | None
) -> AnnouncementCategoryAdminOut:
    category = await get_category(session, category_id, lock=True)
    _apply_category_locales(category, name, locales)
    await _ensure_unique_category_name(session, category.name, exclude_id=category.id)
    await session.flush()
    counts = await _count_by_category(session)
    return _category_out(category, counts.get(category.id, 0))


async def delete_category(session: AsyncSession, category_id: int) -> None:
    category = await get_category(session, category_id, lock=True)
    count = await session.scalar(
        select(func.count()).select_from(Announcement).where(Announcement.category_id == category_id)
    )
    if count:
        raise AppError(409, "category_in_use", f"이 카테고리에 공지 {count}건이 있어 삭제할 수 없습니다.")
    await session.delete(category)


async def reorder_categories(session: AsyncSession, ordered_ids: list[int]) -> None:
    categories = {c.id: c for c in await session.scalars(select(AnnouncementCategory).with_for_update())}
    if len(ordered_ids) != len(set(ordered_ids)) or set(ordered_ids) != set(categories):
        raise AppError(400, "invalid_reorder", "모든 카테고리를 한 번씩 보내야 합니다.")
    for index, category_id in enumerate(ordered_ids, start=1):
        categories[category_id].sort_order = index


async def list_categories_public(session: AsyncSession, locale: str) -> list[AnnouncementCategoryPublicOut]:
    """게시중인 공지가 1건 이상 있는 카테고리만."""
    counts = await _count_by_category(session, published_only=True)
    if not counts:
        return []
    rows = await session.scalars(
        select(AnnouncementCategory)
        .where(AnnouncementCategory.id.in_(list(counts)))
        .order_by(AnnouncementCategory.sort_order, AnnouncementCategory.id)
    )
    return [
        AnnouncementCategoryPublicOut(
            id=c.id,
            name=_category_name(c.name, c.translations, locale),
            sort_order=c.sort_order,
            announcement_count=counts[c.id],
            locale=locale,
            locales=_category_locales(c),
        )
        for c in rows
    ]


# ── 공지 ────────────────────────────────────────────────────


def _announcement_locales(item: Announcement) -> dict[str, dict[str, str]]:
    locales = {DEFAULT_LOCALE: {"title": item.title, "content": item.content}}
    for code, body in (item.translations or {}).items():
        if isinstance(body, Mapping) and (body.get("title") or body.get("content")):
            locales[code] = {"title": str(body.get("title") or ""), "content": str(body.get("content") or "")}
    return locales


def _localized(item_title: str, item_content: str, translations: dict | None, locale: str) -> tuple[str, str]:
    """번역이 있으면 그 언어로, 없는 필드는 en으로."""
    if locale != DEFAULT_LOCALE:
        body = (translations or {}).get(locale)
        if isinstance(body, Mapping):
            return str(body.get("title") or item_title), str(body.get("content") or item_content)
    return item_title, item_content


def _author_name(first: str | None, last: str | None, email: str | None) -> str | None:
    name = f"{first or ''} {last or ''}".strip()
    if name:
        return name
    return email.split("@")[0] if email else None


def _base_query() -> Select:
    return (
        select(
            Announcement,
            AnnouncementCategory.name,
            AnnouncementCategory.translations,
            User.first_name,
            User.last_name,
            User.email,
        )
        .join(AnnouncementCategory, AnnouncementCategory.id == Announcement.category_id)
        .outerjoin(User, User.id == Announcement.created_by)
    )


def _order(category_id: int | None) -> tuple:
    """고정 공지가 먼저, 그다음 노출 순서, 같으면 최신순. 카테고리 필터가 있으면 카테고리별 순서."""
    order_col = Announcement.category_sort_order if category_id is not None else Announcement.sort_order
    return (Announcement.is_pinned.desc(), order_col.asc(), Announcement.created_at.desc(), Announcement.id.desc())


def _keyword_filter(keyword: str):
    """en 제목·본문과 모든 번역에서 찾는다."""
    escaped = keyword.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    pattern = f"%{escaped}%"
    return or_(
        Announcement.title.ilike(pattern, escape="\\"),
        Announcement.content.ilike(pattern, escape="\\"),
        cast(Announcement.translations, Text).ilike(pattern, escape="\\"),
    )


def _admin_fields(row: Any) -> dict[str, Any]:
    item: Announcement = row[0]
    return {
        "id": item.id,
        "title": item.title,
        "category_id": item.category_id,
        "category_name": row[1],
        "status": item.status,
        "is_pinned": item.is_pinned,
        "sort_order": item.sort_order,
        "category_sort_order": item.category_sort_order,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
        "created_by": str(item.created_by) if item.created_by else None,
        "author_name": _author_name(row[3], row[4], row[5]),
        "locales": _announcement_locales(item),
    }


def _public_out(row: Any, locale: str, cls: type[AnnouncementPublicOut] = AnnouncementPublicOut) -> Any:
    item: Announcement = row[0]
    title, content = _localized(item.title, item.content, item.translations, locale)
    return cls(
        id=item.id,
        category_id=item.category_id,
        category=_category_name(row[1], row[2], locale),
        status=item.status,
        is_pinned=item.is_pinned,
        title=title,
        content=content,
        created_at=item.created_at,
        updated_at=item.updated_at,
        created_by=str(item.created_by) if item.created_by else None,
        author_name=_author_name(row[3], row[4], row[5]),
        locale=locale,
        locales=_announcement_locales(item),
    )


async def _paginate(session: AsyncSession, stmt: Select, page: int, size: int) -> tuple[list[Any], int]:
    total = await session.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = (await session.execute(stmt.offset((page - 1) * size).limit(size))).all()
    return list(rows), total


async def list_announcements_admin(
    session: AsyncSession,
    *,
    keyword: str | None,
    category_id: int | None,
    status: str | None,
    page: int,
    size: int,
) -> tuple[list[AnnouncementAdminListItem], int]:
    stmt = _base_query()
    if category_id is not None:
        stmt = stmt.where(Announcement.category_id == category_id)
    if status:
        stmt = stmt.where(Announcement.status == status)
    if keyword and keyword.strip():
        stmt = stmt.where(_keyword_filter(keyword.strip()))
    rows, total = await _paginate(session, stmt.order_by(*_order(category_id)), page, size)
    return [AnnouncementAdminListItem(**_admin_fields(r)) for r in rows], total


async def _get_row(session: AsyncSession, announcement_id: int, published_only: bool = False) -> Any:
    stmt = _base_query().where(Announcement.id == announcement_id)
    if published_only:
        stmt = stmt.where(Announcement.status == STATUS_PUBLISHED)
    row = (await session.execute(stmt)).first()
    if row is None:
        raise AppError(404, "announcement_not_found", "공지를 찾을 수 없습니다.")
    return row


async def get_announcement_admin(session: AsyncSession, announcement_id: int) -> AnnouncementAdminOut:
    row = await _get_row(session, announcement_id)
    return AnnouncementAdminOut(**_admin_fields(row), content=row[0].content)


async def _get_announcement(session: AsyncSession, announcement_id: int) -> Announcement:
    item = await session.get(Announcement, announcement_id, with_for_update=True)
    if item is None:
        raise AppError(404, "announcement_not_found", "공지를 찾을 수 없습니다.")
    return item


def _apply_announcement_locales(
    item: Announcement,
    *,
    title: str | None,
    content: str | None,
    locales: dict[str, AnnouncementLocaleBody] | None,
    replace_translations: bool,
) -> None:
    """en은 컬럼으로, 나머지 언어는 translations로. 제목·본문이 모두 빈 언어는 저장하지 않는다."""
    en = (locales or {}).get(DEFAULT_LOCALE)
    en_title = en.title if en and en.title is not None else title
    en_content = en.content if en and en.content is not None else content
    if en_title is not None:
        item.title = _clean(en_title)
    if en_content is not None:
        item.content = sanitize_html(en_content)
    if not item.title or not _has_text(item.content or ""):
        raise AppError(400, "locales.en_required", "영문 제목과 본문은 필수입니다.")

    if locales is None:
        return
    translations = {} if replace_translations else dict(item.translations or {})
    for code, body in locales.items():
        _check_locale(code)
        if code == DEFAULT_LOCALE:
            continue
        loc_title = _clean(body.title)
        loc_content = sanitize_html(body.content or "")
        if loc_title or _has_text(loc_content):
            translations[code] = {"title": loc_title, "content": loc_content}
        else:
            translations.pop(code, None)
    item.translations = translations


async def _next_order(session: AsyncSession, column, category_id: int | None = None) -> int:
    stmt = select(func.coalesce(func.max(column), 0)).where(Announcement.is_pinned.is_(False))
    if category_id is not None:
        stmt = stmt.where(Announcement.category_id == category_id)
    return (await session.scalar(stmt) or 0) + 1


async def create_announcement(session: AsyncSession, body: Any, admin: User) -> int:
    await get_category(session, body.category_id)
    item = Announcement(
        category_id=body.category_id,
        status=body.status,
        is_pinned=body.is_pinned,
        title="",
        content="",
        translations={},
        created_by=admin.id,
    )
    _apply_announcement_locales(
        item, title=body.title, content=body.content, locales=body.locales, replace_translations=True
    )
    # 새 공지는 고정이 아니면 목록 맨 뒤 순서를 받는다.
    if not item.is_pinned:
        item.sort_order = await _next_order(session, Announcement.sort_order)
        item.category_sort_order = await _next_order(session, Announcement.category_sort_order, body.category_id)
    session.add(item)
    await session.flush()
    return item.id


async def update_announcement(session: AsyncSession, announcement_id: int, body: Any) -> None:
    item = await _get_announcement(session, announcement_id)
    data = body.model_dump(exclude_unset=True)
    was_pinned = item.is_pinned
    old_category_id = item.category_id

    if data.get("category_id") is not None and data["category_id"] != old_category_id:
        await get_category(session, data["category_id"])
        item.category_id = data["category_id"]
    if data.get("status") is not None:
        item.status = data["status"]
    if data.get("is_pinned") is not None:
        item.is_pinned = data["is_pinned"]

    _apply_announcement_locales(
        item, title=body.title, content=body.content, locales=body.locales, replace_translations=True
    )

    # 고정을 풀었거나 카테고리를 옮기면 해당 목록의 맨 뒤로 보낸다.
    if not item.is_pinned:
        if was_pinned:
            item.sort_order = await _next_order(session, Announcement.sort_order)
        if was_pinned or item.category_id != old_category_id:
            item.category_sort_order = await _next_order(
                session, Announcement.category_sort_order, item.category_id
            )
    await session.flush()


async def delete_announcement(session: AsyncSession, announcement_id: int) -> None:
    await session.delete(await _get_announcement(session, announcement_id))


async def reorder_announcements(
    session: AsyncSession, ordered_ids: list[int], scope: str, category_id: int | None
) -> None:
    """고정 공지를 뺀 공지 전부를 원하는 순서로 보낸다 (전체 목록 또는 한 카테고리)."""
    if len(ordered_ids) != len(set(ordered_ids)):
        raise AppError(400, "invalid_reorder", "같은 공지를 두 번 보낼 수 없습니다.")
    stmt = select(Announcement.id).where(Announcement.is_pinned.is_(False))
    column = Announcement.sort_order
    if scope == "category":
        if category_id is None:
            raise AppError(400, "invalid_reorder", "카테고리 순서를 바꿀 때는 category_id가 필요합니다.")
        await get_category(session, category_id)
        stmt = stmt.where(Announcement.category_id == category_id)
        column = Announcement.category_sort_order

    pinned = await session.scalar(
        select(func.count()).where(Announcement.id.in_(ordered_ids), Announcement.is_pinned.is_(True))
    )
    if pinned:
        raise AppError(400, "pinned_not_reorderable", "고정 공지는 순서를 바꿀 수 없습니다.")
    expected = set(await session.scalars(stmt.with_for_update()))
    if set(ordered_ids) != expected:
        raise AppError(400, "invalid_reorder", "고정되지 않은 공지를 모두 한 번씩 보내야 합니다.")
    for index, announcement_id in enumerate(ordered_ids, start=1):
        await session.execute(
            update(Announcement).where(Announcement.id == announcement_id).values({column.key: index})
        )


# ── 사용자 화면 ─────────────────────────────────────────────


async def list_announcements_public(
    session: AsyncSession,
    *,
    locale: str,
    keyword: str | None,
    category_id: int | None,
    page: int,
    size: int,
) -> tuple[list[AnnouncementPublicOut], int]:
    stmt = _base_query().where(Announcement.status == STATUS_PUBLISHED)
    if category_id is not None:
        stmt = stmt.where(Announcement.category_id == category_id)
    if keyword and keyword.strip():
        stmt = stmt.where(_keyword_filter(keyword.strip()))
    rows, total = await _paginate(session, stmt.order_by(*_order(category_id)), page, size)
    return [_public_out(r, locale) for r in rows], total


async def get_announcement_public(
    session: AsyncSession, announcement_id: int, locale: str
) -> AnnouncementPublicDetailOut:
    row = await _get_row(session, announcement_id, published_only=True)
    out: AnnouncementPublicDetailOut = _public_out(row, locale, AnnouncementPublicDetailOut)

    # 이전·다음 글은 전체 목록 순서(고정 → 노출 순서 → 최신순) 기준이다.
    order = _order(None)
    nav = (
        select(
            Announcement.id.label("id"),
            func.lag(Announcement.id).over(order_by=order).label("prev_id"),
            func.lead(Announcement.id).over(order_by=order).label("next_id"),
        )
        .where(Announcement.status == STATUS_PUBLISHED)
        .subquery()
    )
    nav_row = (await session.execute(select(nav.c.prev_id, nav.c.next_id).where(nav.c.id == announcement_id))).first()
    if nav_row is None:
        return out
    neighbor_ids = [i for i in (nav_row.prev_id, nav_row.next_id) if i is not None]
    titles: dict[int, str] = {}
    if neighbor_ids:
        for n_id, n_title, n_tr in await session.execute(
            select(Announcement.id, Announcement.title, Announcement.translations).where(
                Announcement.id.in_(neighbor_ids)
            )
        ):
            titles[n_id] = _localized(n_title, "", n_tr, locale)[0]
    out.previous_id = nav_row.prev_id
    out.previous_title = titles.get(nav_row.prev_id) if nav_row.prev_id else None
    out.next_id = nav_row.next_id
    out.next_title = titles.get(nav_row.next_id) if nav_row.next_id else None
    return out
