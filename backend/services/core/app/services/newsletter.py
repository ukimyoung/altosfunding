"""마케팅 메일 수신거부.

수동 발송 마케팅 메일 아래에 회원별 '수신거부' 링크를 넣는다. 링크에는 회원 id와 서명(HMAC)이 들어가
로그인 없이 누르기만 하면 subscribed_newsletter=false가 된다.
"""

import hmac
import uuid
from datetime import UTC, datetime
from html import escape
from urllib.parse import urlencode

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User
from app.security import hash_code

PATH = "/api/v1/newsletter/unsubscribe"

_FOOTER = {
    "en": "You received this email because you subscribed to Altos Funding news. "
    '<a href="{url}" style="color:#7c6af7;">Unsubscribe</a>',
    "ko": 'Altos Funding 소식 수신에 동의하셔서 보내 드린 메일입니다. <a href="{url}" style="color:#7c6af7;">수신거부</a>',
}

_PAGE = {
    "en": ("Unsubscribed", "You will no longer receive marketing emails from Altos Funding."),
    "ko": ("수신거부 완료", "앞으로 Altos Funding 마케팅 메일을 보내지 않습니다."),
}
_INVALID = {
    "en": ("Invalid link", "This unsubscribe link is invalid or has expired."),
    "ko": ("잘못된 링크", "수신거부 링크가 올바르지 않습니다."),
}


def token(user_id: uuid.UUID) -> str:
    return hash_code(f"newsletter-unsubscribe:{user_id}")[:32]


def unsubscribe_url(base_url: str, user_id: uuid.UUID) -> str:
    return f"{base_url.rstrip('/')}{PATH}?{urlencode({'u': str(user_id), 't': token(user_id)})}"


def footer_html(base_url: str, user_id: uuid.UUID, locale: str) -> str:
    url = escape(unsubscribe_url(base_url, user_id), quote=True)
    text = _FOOTER.get(locale, _FOOTER["en"]).format(url=url)
    return f'<p style="margin-top:32px;font-size:11px;color:#9a9ab0;line-height:1.6;">{text}</p>'


async def unsubscribe(session: AsyncSession, user_id: str, sig: str) -> User | None:
    """서명이 맞으면 수신거부 처리한 회원, 틀리면 None."""
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return None
    if not sig or not hmac.compare_digest(token(uid), sig):
        return None
    user = await session.get(User, uid)
    if user is None:
        return None
    if user.subscribed_newsletter or user.newsletter_unsubscribed_at is None:
        user.subscribed_newsletter = False
        user.newsletter_unsubscribed_at = datetime.now(UTC)
    return user


def result_page(ok: bool, locale: str | None) -> str:
    lg = "ko" if locale == "ko" else "en"
    title, message = (_PAGE if ok else _INVALID)[lg]
    return f"""<!DOCTYPE html><html lang="{lg}"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0"><title>{title}</title></head>
<body style="font-family:'Helvetica Neue',Arial,sans-serif;background:#f4f6f9;color:#1a1a2e;margin:0;padding:60px 16px;">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:36px 32px;text-align:center;">
<h1 style="font-size:20px;margin:0 0 12px;">{title}</h1><p style="font-size:14px;color:#555;margin:0;">{message}</p>
</div></body></html>"""
