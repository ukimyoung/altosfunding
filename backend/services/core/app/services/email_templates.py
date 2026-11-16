"""메일 템플릿 렌더링과 기본 템플릿.

- 템플릿 본문은 DB(core.email_templates / core.email_template_contents)에 있고 백오피스
  '운영 관리 > 이메일/알림 관리 > 템플릿 관리'에서 수정·등록한다.
- 여기 DEFAULT_TEMPLATES는 Core 코드가 직접 보내는 기본 템플릿이다. 마이그레이션이 같은 내용을 DB에 넣고,
  DB에 템플릿이 없거나 관리자가 고친 템플릿이 렌더링에 실패하면 이 기본값으로 보낸다.
- 제목·본문은 Jinja2 문법({{ 변수 }})을 쓴다. 관리자가 고치는 내용이라 샌드박스 환경에서 렌더링한다.
- 본문(html)은 공통 레이아웃(헤더·푸터) 안에 들어갈 내용만 저장한다.
"""

import re
from dataclasses import dataclass
from html import escape, unescape
from typing import Any

from jinja2.sandbox import ImmutableSandboxedEnvironment
from markupsafe import Markup

from app.config import settings
from app.services.email_templates_legacy import LEGACY_TEMPLATES

SUPPORTED_LOCALES = ("en", "ko")
DEFAULT_LOCALE = "en"


@dataclass(frozen=True)
class RenderedEmail:
    subject: str
    html: str
    text: str


def lang(locale: str | None) -> str:
    return "ko" if (locale or "").lower().startswith("ko") else "en"


def _nl2br(value: Any) -> Markup:
    # Markup.join이 각 줄을 이스케이프한다.
    return Markup("<br>").join(str(value or "").split("\n"))


_html_env = ImmutableSandboxedEnvironment(autoescape=True)
_html_env.filters["nl2br"] = _nl2br
_text_env = ImmutableSandboxedEnvironment(autoescape=False)


def render_html(source: str, variables: dict[str, Any]) -> str:
    return _html_env.from_string(source).render(**variables)


def render_subject(source: str, variables: dict[str, Any]) -> str:
    return " ".join(_text_env.from_string(source).render(**variables).split())


_FOOTER = {
    "en": "This email is send-only. For inquiries, please contact",
    "ko": "본 메일은 발신 전용입니다. 문의:",
}


def layout(content_html: str, locale: str) -> str:
    """기존 서버 altos_modern 레이아웃(헤더·본문·푸터)에 본문을 넣는다."""
    lg = lang(locale)
    support = escape(settings.email_support_address)
    return f"""<!DOCTYPE html>
<html lang="{lg}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:'Helvetica Neue',Arial,sans-serif;background-color:#f4f6f9;color:#1a1a2e;margin:0;padding:20px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f9;">
<tr><td align="center" style="padding:20px 0;">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;text-align:left;margin:0 auto;">
<tr><td style="background-color:#16264f;padding:28px 40px;border-top-left-radius:12px;border-top-right-radius:12px;">
<h1 style="color:#ffffff;font-size:20px;font-weight:700;margin:0;">Altos Funding</h1>
</td></tr>
<tr><td style="padding:36px 40px;font-size:14px;line-height:1.75;color:#444444;background-color:#ffffff;">
{content_html}
</td></tr>
<tr><td style="background-color:#f5f4fb;padding:20px 40px;border-top:1px solid #e8e6f0;text-align:center;border-bottom-left-radius:12px;border-bottom-right-radius:12px;">
<p style="font-size:11px;color:#9a9ab0;line-height:1.7;margin:0;">&copy; Altos Funding. All rights reserved.<br>
{_FOOTER[lg]} <a href="mailto:{support}" style="color:#7c6af7;text-decoration:none;">{support}</a></p>
</td></tr>
</table></td></tr></table>
</body></html>"""


_BLOCK_END = re.compile(r"</(p|div|h[1-6]|li|tr|table|blockquote)>|<br\s*/?>|<hr\s*/?>", re.IGNORECASE)
_TAG = re.compile(r"<[^>]+>")


def html_to_text(html: str) -> str:
    """본문 HTML에서 텍스트 메일 내용을 만든다."""
    text = _BLOCK_END.sub("\n", html)
    text = unescape(_TAG.sub("", text))
    lines = [" ".join(line.split()) for line in text.splitlines()]
    out: list[str] = []
    for line in lines:
        if line or (out and out[-1]):
            out.append(line)
    return "\n".join(out).strip() + "\n\nAltos Funding"


def build(subject_src: str, html_src: str, locale: str, variables: dict[str, Any]) -> RenderedEmail:
    content = render_html(html_src, variables)
    return RenderedEmail(
        subject=render_subject(subject_src, variables),
        html=layout(content, locale),
        text=html_to_text(content),
    )


# ---------------------------------------------------------------------------
# 기본 템플릿 (코드가 보내는 메일). 마이그레이션 20261117010000_core_email_templates.sql과 내용이 같아야 한다.
# ---------------------------------------------------------------------------

_H2 = '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">'
_CODE = '<div style="text-align:center;margin:24px 0;"><span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#1a1a2e;">{{ verification_code }}</span></div>'
_BOX = '<div style="background-color:#f5f4fb;border-radius:8px;padding:16px;margin:8px 0 20px 0;">'
_BUTTON = '<div style="text-align:center;margin:24px 0;"><a href="{{ reset_url }}" style="display:inline-block;background-color:#0057ff;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">'

DEFAULT_TEMPLATES: dict[str, dict[str, Any]] = {
    "email_verification_requested": {
        "name": "회원가입 인증코드",
        "description": "회원가입 화면에서 인증코드 요청 시 즉시 발송",
        "variables": ["verification_code", "expiry_minutes"],
        "locales": {
            "en": {
                "subject": "[Altos Funding] Sign-up verification code",
                "html": f"{_H2}Email Verification</h2>\n<p>Please enter the verification code below to complete your sign-up.</p>\n{_CODE}\n<p>The verification code will expire after {{{{ expiry_minutes }}}} minutes. Do not share your code with anyone.</p>\n<p>If you did not request this, please ignore this email.</p>",
            },
            "ko": {
                "subject": "[Altos Funding] 회원가입 인증코드",
                "html": f"{_H2}이메일 인증</h2>\n<p>회원가입을 완료하려면 아래 인증코드를 입력해 주세요.</p>\n{_CODE}\n<p>인증코드는 {{{{ expiry_minutes }}}}분 동안 유효합니다. 다른 사람에게 코드를 알려 주지 마세요.</p>\n<p>직접 요청하지 않으셨다면 이 메일을 무시해 주세요.</p>",
            },
        },
    },
    "withdraw_verification_code": {
        "name": "출금 신청 인증코드",
        "description": "출금 신청 마지막 단계(Security Verification)에서 Send Code 클릭 시 즉시 발송",
        "variables": ["verification_code", "expiry_minutes"],
        "locales": {
            "en": {
                "subject": "[Altos Funding] Withdrawal verification code",
                "html": f"{_H2}Email Verification</h2>\n<p>A withdrawal request was started on your account. Enter the code below to confirm the withdrawal.</p>\n{_CODE}\n<p>The verification code will expire after {{{{ expiry_minutes }}}} minutes. Do not share your code with anyone.</p>\n<p>If you did not request a withdrawal, change your password immediately and contact support.</p>",
            },
            "ko": {
                "subject": "[Altos Funding] 출금 신청 인증코드",
                "html": f"{_H2}이메일 인증</h2>\n<p>회원님의 계정에서 출금 신청이 진행 중입니다. 출금을 확정하려면 아래 인증코드를 입력해 주세요.</p>\n{_CODE}\n<p>인증코드는 {{{{ expiry_minutes }}}}분 동안 유효합니다. 다른 사람에게 코드를 알려 주지 마세요.</p>\n<p>출금을 신청하지 않으셨다면 즉시 비밀번호를 변경하고 고객센터로 문의해 주세요.</p>",
            },
        },
    },
    "password_reset": {
        "name": "비밀번호 재설정",
        "description": "비밀번호 찾기에서 재설정 링크 요청 시 즉시 발송",
        "variables": ["reset_url", "expiry_minutes"],
        "locales": {
            "en": {
                "subject": "[Altos Funding] Reset your password",
                "html": f'{_H2}Password Reset</h2>\n<p>Click the button below to set a new password.</p>\n{_BUTTON}Reset Password</a></div>\n<p style="word-break:break-all;font-size:12px;color:#888888;">{{{{ reset_url }}}}</p>\n<p>This link expires in {{{{ expiry_minutes }}}} minutes. If you did not request this, please ignore this email.</p>',
            },
            "ko": {
                "subject": "[Altos Funding] 비밀번호 재설정 안내",
                "html": f'{_H2}비밀번호 재설정</h2>\n<p>아래 버튼을 눌러 새 비밀번호를 설정해 주세요.</p>\n{_BUTTON}비밀번호 재설정</a></div>\n<p style="word-break:break-all;font-size:12px;color:#888888;">{{{{ reset_url }}}}</p>\n<p>링크는 {{{{ expiry_minutes }}}}분 동안 유효합니다. 직접 요청하지 않으셨다면 이 메일을 무시해 주세요.</p>',
            },
        },
    },
    "contact_received": {
        "name": "문의 접수 안내",
        "description": "문의하기(Contact Us) 접수 직후 문의자에게 발송",
        "variables": ["name", "inquiry_subject", "contact_id"],
        "locales": {
            "en": {
                "subject": "[Altos Funding] We received your inquiry (#{{ contact_id }})",
                "html": "<p>Dear {{ name }},</p>\n<p>Your inquiry has been received. Our team will review it and reply by email.</p>\n<p><strong>Subject:</strong> {{ inquiry_subject }} (#{{ contact_id }})</p>",
            },
            "ko": {
                "subject": "[Altos Funding] 문의가 접수되었습니다 (#{{ contact_id }})",
                "html": "<p>{{ name }}님, 안녕하세요.</p>\n<p>문의가 정상적으로 접수되었습니다. 담당자가 확인 후 이메일로 답변드리겠습니다.</p>\n<p><strong>문의 제목:</strong> {{ inquiry_subject }} (#{{ contact_id }})</p>",
            },
        },
    },
    "contact_replied": {
        "name": "문의 답변 안내",
        "description": "백오피스에서 문의 답변 등록 시 문의자에게 발송",
        "variables": ["name", "inquiry_subject", "inquiry", "reply", "contact_id"],
        "locales": {
            "en": {
                "subject": "[Altos Funding] Reply to your inquiry (#{{ contact_id }})",
                "html": f"<p>Dear {{{{ name }}}},</p>\n<p>Here is our reply to your inquiry.</p>\n<p><strong>Your inquiry:</strong> {{{{ inquiry_subject }}}} (#{{{{ contact_id }}}})</p>\n{_BOX}{{{{ inquiry|nl2br }}}}</div>\n<p><strong>Our reply</strong></p>\n{_BOX}{{{{ reply|nl2br }}}}</div>",
            },
            "ko": {
                "subject": "[Altos Funding] 문의에 대한 답변입니다 (#{{ contact_id }})",
                "html": f"<p>{{{{ name }}}}님, 안녕하세요.</p>\n<p>보내 주신 문의에 답변드립니다.</p>\n<p><strong>문의 내용:</strong> {{{{ inquiry_subject }}}} (#{{{{ contact_id }}}})</p>\n{_BOX}{{{{ inquiry|nl2br }}}}</div>\n<p><strong>답변</strong></p>\n{_BOX}{{{{ reply|nl2br }}}}</div>",
            },
        },
    },
}

# 기존 서버에서 옮겨 온 템플릿(입출금·챌린지·KYC 등). 각 기능을 Core로 옮길 때 연결한다.
DEFAULT_TEMPLATES.update(LEGACY_TEMPLATES)

# 인증코드 목적 → 템플릿
VERIFICATION_TEMPLATE_IDS = {
    "SIGNUP": "email_verification_requested",
    "WITHDRAW_REQUEST": "withdraw_verification_code",
}

# 코드가 꼭 보내야 하는 메일(인증·보안). 템플릿을 꺼 두어도 기본값으로 보낸다.
REQUIRED_TEMPLATE_IDS = frozenset({"email_verification_requested", "withdraw_verification_code", "password_reset"})


def render_default(template_id: str, locale: str, variables: dict[str, Any]) -> RenderedEmail:
    locales = DEFAULT_TEMPLATES[template_id]["locales"]
    body = locales.get(lang(locale)) or locales[DEFAULT_LOCALE]
    return build(body["subject"], body["html"], lang(locale), variables)
