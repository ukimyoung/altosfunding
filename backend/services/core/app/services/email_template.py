"""메일 템플릿 관리(DB)와 렌더링.

백오피스 '운영 관리 > 이메일/알림 관리 > 템플릿 관리'에서 조회·수정·신규 등록한다.
메일을 보낼 때는 render()로 DB 템플릿을 읽어 만들고, 없거나 깨졌으면 코드 기본값(email_templates)으로 보낸다.
"""

import logging
import uuid
from typing import Any

from jinja2 import TemplateError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import AppError
from app.models import EmailTemplate, EmailTemplateContent
from app.schemas.email_template import (
    TemplateCreateRequest,
    TemplateDetail,
    TemplateListItem,
    TemplateLocaleContent,
    TemplateRule,
    TemplateUpdateRequest,
)
from app.services import email_templates as defaults
from app.services.email_templates import (
    DEFAULT_LOCALE,
    SUPPORTED_LOCALES,
    RenderedEmail,
)

logger = logging.getLogger(__name__)


async def _contents(session: AsyncSession, template_ids: list[str]) -> dict[str, dict[str, EmailTemplateContent]]:
    rows = await session.scalars(
        select(EmailTemplateContent).where(EmailTemplateContent.template_id.in_(template_ids))
    )
    out: dict[str, dict[str, EmailTemplateContent]] = {}
    for row in rows:
        out.setdefault(row.template_id, {})[row.locale] = row
    return out


def _item(t: EmailTemplate, contents: dict[str, EmailTemplateContent]) -> dict[str, Any]:
    return {
        "template_id": t.id,
        "template_name": t.name,
        "description": t.description,
        "is_system": t.is_system,
        "rule": TemplateRule(
            event_type=t.id,
            is_active=t.is_active,
            send_mode=t.send_mode,  # type: ignore[arg-type]
            delay_minutes=t.delay_minutes,
            event_name=t.description,
        ),
        "locales": {
            loc: TemplateLocaleContent(subject=c.subject, html_content=c.html_content)
            for loc, c in sorted(contents.items())
        },
    }


async def list_templates(session: AsyncSession) -> list[TemplateListItem]:
    templates = list(
        await session.scalars(select(EmailTemplate).order_by(EmailTemplate.is_system.desc(), EmailTemplate.created_at, EmailTemplate.id))
    )
    contents = await _contents(session, [t.id for t in templates])
    return [TemplateListItem(**_item(t, contents.get(t.id, {}))) for t in templates]


async def _get(session: AsyncSession, template_id: str, *, lock: bool = False) -> EmailTemplate:
    stmt = select(EmailTemplate).where(EmailTemplate.id == template_id)
    if lock:
        stmt = stmt.with_for_update()
    template = await session.scalar(stmt)
    if template is None:
        raise AppError(404, "template_not_found", "템플릿을 찾을 수 없습니다.")
    return template


async def get_detail(session: AsyncSession, template_id: str) -> TemplateDetail:
    template = await _get(session, template_id)
    contents = await _contents(session, [template.id])
    return TemplateDetail(
        **_item(template, contents.get(template.id, {})),
        variables=list(template.variables or []),
        updated_at=template.updated_at,
    )


def _check_syntax(template_id: str, locales: dict[str, TemplateLocaleContent]) -> None:
    for loc, body in locales.items():
        if loc not in SUPPORTED_LOCALES:
            raise AppError(400, "invalid_locale", f"지원하지 않는 언어입니다: {loc} (en, ko만 가능)")
        try:
            defaults.render_subject(body.subject, {})
            defaults.render_html(body.html_content, {})
        except TemplateError as exc:
            raise AppError(400, "invalid_template", f"[{loc}] 템플릿 문법 오류: {exc}") from exc


async def _save_contents(
    session: AsyncSession, template_id: str, locales: dict[str, TemplateLocaleContent]
) -> None:
    existing = (await _contents(session, [template_id])).get(template_id, {})
    for loc, body in locales.items():
        row = existing.get(loc)
        if row is None:
            session.add(
                EmailTemplateContent(
                    template_id=template_id, locale=loc, subject=body.subject.strip(), html_content=body.html_content
                )
            )
        else:
            row.subject = body.subject.strip()
            row.html_content = body.html_content


def _apply_meta(template: EmailTemplate, body: TemplateUpdateRequest, admin_id: uuid.UUID) -> None:
    name = body.template_name.strip()
    if not name:
        raise AppError(400, "validation_error", "템플릿 이름을 입력해 주세요.")
    template.name = name
    template.description = (body.description or "").strip() or None
    if body.rule.is_active is not None:
        template.is_active = body.rule.is_active
    template.send_mode = body.rule.send_mode
    template.delay_minutes = body.rule.delay_minutes if body.rule.send_mode == "delay" else 0
    template.updated_by = admin_id


async def update(
    session: AsyncSession, template_id: str, body: TemplateUpdateRequest, admin_id: uuid.UUID
) -> TemplateDetail:
    template = await _get(session, template_id, lock=True)
    _check_syntax(template_id, body.locales)
    _apply_meta(template, body, admin_id)
    await _save_contents(session, template_id, body.locales)
    await session.commit()
    return await get_detail(session, template_id)


async def create(session: AsyncSession, body: TemplateCreateRequest, admin_id: uuid.UUID) -> TemplateDetail:
    if DEFAULT_LOCALE not in body.locales:
        raise AppError(400, "locales.en_required", "영문(en) 제목과 본문은 필수입니다.")
    if await session.get(EmailTemplate, body.template_id) is not None:
        raise AppError(409, "template_id_exists", "이미 있는 템플릿 코드입니다.")
    _check_syntax(body.template_id, body.locales)
    template = EmailTemplate(id=body.template_id, is_system=False, is_active=True)
    template.variables = [v.strip() for v in body.variables if v.strip()]
    _apply_meta(template, body, admin_id)
    session.add(template)
    await session.flush()
    await _save_contents(session, template.id, body.locales)
    await session.commit()
    return await get_detail(session, template.id)


async def delete(session: AsyncSession, template_id: str) -> None:
    template = await _get(session, template_id, lock=True)
    if template.is_system:
        raise AppError(400, "system_template", "기본 템플릿은 삭제할 수 없습니다.")
    await session.delete(template)
    await session.commit()


def preview(content_html: str, subject: str | None, locale: str, sample: dict[str, str] | None) -> tuple[str, str | None]:
    """레이아웃을 씌운 미리보기. sample이 없으면 변수 자리를 {{ 변수 }} 그대로 보여 준다."""
    try:
        if sample is None:
            content = content_html
            rendered_subject = subject
        else:
            content = defaults.render_html(content_html, sample)
            rendered_subject = defaults.render_subject(subject, sample) if subject else None
    except TemplateError as exc:
        raise AppError(400, "invalid_template", f"템플릿 문법 오류: {exc}") from exc
    return defaults.layout(content, locale), rendered_subject


async def render(
    session: AsyncSession, template_id: str, locale: str, variables: dict[str, Any]
) -> RenderedEmail | None:
    """보낼 메일을 만든다. 사용 안 함으로 꺼 둔 템플릿이면 None (인증·보안 메일은 기본값으로 보낸다)."""
    lang = defaults.lang(locale)
    required = template_id in defaults.REQUIRED_TEMPLATE_IDS
    has_default = template_id in defaults.DEFAULT_TEMPLATES
    try:
        template = await session.get(EmailTemplate, template_id)
        if template is not None and (template.is_active or required):
            contents = (await _contents(session, [template_id])).get(template_id, {})
            body = contents.get(lang) or contents.get(DEFAULT_LOCALE)
            if body is not None:
                return defaults.build(body.subject, body.html_content, lang, variables)
        elif template is not None:
            return None
    except Exception:  # 관리자가 고친 템플릿이 깨져도 메일은 나가게 한다.
        logger.exception("메일 템플릿 렌더링 실패 (%s, %s) — 기본 템플릿으로 보냄", template_id, lang)
    if has_default:
        return defaults.render_default(template_id, lang, variables)
    logger.error("메일 템플릿이 없습니다: %s", template_id)
    return None
