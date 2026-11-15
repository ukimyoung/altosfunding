"""문의 카테고리. 백오피스 '운영 관리 > 문의하기 > 카테고리 관리'에서 추가·수정·삭제·순서 변경한다.

- code: 문의(contact_messages.category)에 저장되는 값. 영문 이름으로 만들고 이후 바꾸지 않는다.
- 이름: 기본 언어(en)는 name 컬럼, 다른 언어는 translations(jsonb). 공지 카테고리와 같은 방식.
"""

import re
from collections.abc import Mapping

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import AppError
from app.models import ContactCategory, ContactMessage
from app.schemas.contact import ContactCategoryAdminOut, ContactCategoryLocaleBody, ContactCategoryPublicOut

DEFAULT_LOCALE = "en"
_LOCALE_RE = re.compile(r"^[a-z]{2,3}(-[A-Za-z]{2,4})?$")


def _clean(value: str | None) -> str:
    return (value or "").strip()


def _locales(category: ContactCategory) -> dict[str, dict[str, str]]:
    locales = {DEFAULT_LOCALE: {"name": category.name}}
    for code, body in (category.translations or {}).items():
        if isinstance(body, Mapping) and body.get("name"):
            locales[code] = {"name": str(body["name"])}
    return locales


def localized_name(category: ContactCategory, locale: str) -> str:
    if locale != DEFAULT_LOCALE:
        body = (category.translations or {}).get(locale)
        if isinstance(body, Mapping) and body.get("name"):
            return str(body["name"])
    return category.name


def _out(category: ContactCategory, count: int) -> ContactCategoryAdminOut:
    return ContactCategoryAdminOut(
        id=category.id,
        code=category.code,
        name=category.name,
        sort_order=category.sort_order,
        contact_count=count,
        locales=_locales(category),
    )


def _apply_locales(
    category: ContactCategory, name: str | None, locales: dict[str, ContactCategoryLocaleBody] | None
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
        if not _LOCALE_RE.match(code):
            raise AppError(400, "invalid_locale", f"지원하지 않는 언어 코드입니다: {code}")
        if code == DEFAULT_LOCALE or body.name is None:
            continue
        value = _clean(body.name)
        if value:
            translations[code] = {"name": value}
        else:
            translations.pop(code, None)
    category.translations = translations


async def _counts(session: AsyncSession) -> dict[str, int]:
    rows = await session.execute(select(ContactMessage.category, func.count()).group_by(ContactMessage.category))
    return dict(rows.all())


async def _ensure_unique_name(session: AsyncSession, name: str, exclude_id: int | None = None) -> None:
    stmt = select(ContactCategory.id).where(func.lower(ContactCategory.name) == name.lower())
    if exclude_id is not None:
        stmt = stmt.where(ContactCategory.id != exclude_id)
    if await session.scalar(stmt) is not None:
        raise AppError(409, "category_exists", f"이미 있는 카테고리 이름입니다: {name}")


async def _new_code(session: AsyncSession, name: str) -> str:
    """영문 이름으로 code를 만든다. 'Bonus & Promotions' → 'bonus_promotions'. 겹치면 _2, _3을 붙인다."""
    base = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")[:30] or "category"
    existing = set(
        await session.scalars(select(ContactCategory.code).where(ContactCategory.code.like(f"{base}%")))
    )
    code, n = base, 2
    while code in existing:
        code, n = f"{base}_{n}", n + 1
    return code


async def _get(session: AsyncSession, category_id: int, lock: bool = False) -> ContactCategory:
    category = await session.get(ContactCategory, category_id, with_for_update=lock)
    if category is None:
        raise AppError(404, "contact_category_not_found", "카테고리를 찾을 수 없습니다.")
    return category


async def _ordered(session: AsyncSession) -> list[ContactCategory]:
    return list(await session.scalars(select(ContactCategory).order_by(ContactCategory.sort_order, ContactCategory.id)))


async def list_admin(session: AsyncSession) -> list[ContactCategoryAdminOut]:
    counts = await _counts(session)
    return [_out(c, counts.get(c.code, 0)) for c in await _ordered(session)]


async def list_public(session: AsyncSession, locale: str) -> list[ContactCategoryPublicOut]:
    return [ContactCategoryPublicOut(code=c.code, name=localized_name(c, locale)) for c in await _ordered(session)]


async def names_by_code(session: AsyncSession) -> dict[str, str]:
    return {c.code: c.name for c in await session.scalars(select(ContactCategory))}


async def ensure_exists(session: AsyncSession, code: str) -> None:
    if await session.scalar(select(ContactCategory.id).where(ContactCategory.code == code)) is None:
        raise AppError(400, "invalid_category", "문의 유형을 다시 선택해 주세요.")


async def create(
    session: AsyncSession, name: str | None, locales: dict[str, ContactCategoryLocaleBody] | None
) -> ContactCategoryAdminOut:
    category = ContactCategory(name="", translations={})
    _apply_locales(category, name if name is not None else "", locales)
    await _ensure_unique_name(session, category.name)
    category.code = await _new_code(session, category.name)
    max_order = await session.scalar(select(func.coalesce(func.max(ContactCategory.sort_order), 0)))
    category.sort_order = (max_order or 0) + 1
    session.add(category)
    await session.flush()
    return _out(category, 0)


async def update(
    session: AsyncSession, category_id: int, name: str | None, locales: dict[str, ContactCategoryLocaleBody] | None
) -> ContactCategoryAdminOut:
    category = await _get(session, category_id, lock=True)
    _apply_locales(category, name, locales)
    await _ensure_unique_name(session, category.name, exclude_id=category.id)
    await session.flush()
    return _out(category, (await _counts(session)).get(category.code, 0))


async def delete(session: AsyncSession, category_id: int) -> None:
    category = await _get(session, category_id, lock=True)
    count = await session.scalar(
        select(func.count()).select_from(ContactMessage).where(ContactMessage.category == category.code)
    )
    if count:
        raise AppError(409, "category_in_use", f"이 카테고리에 문의 {count}건이 있어 삭제할 수 없습니다.")
    await session.delete(category)


async def reorder(session: AsyncSession, ordered_ids: list[int]) -> None:
    categories = {c.id: c for c in await session.scalars(select(ContactCategory).with_for_update())}
    if len(ordered_ids) != len(set(ordered_ids)) or set(ordered_ids) != set(categories):
        raise AppError(400, "invalid_reorder", "모든 카테고리를 한 번씩 보내야 합니다.")
    for index, category_id in enumerate(ordered_ids, start=1):
        categories[category_id].sort_order = index
