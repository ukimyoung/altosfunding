"""메일 제목·본문(HTML/텍스트) 만들기.

기존 서버 알림 서비스의 altos_modern 레이아웃과 인증코드 메일 문구를 옮겨 왔다.
locale은 ko/en 두 가지만 쓰고, 그 밖의 값은 en으로 본다.
"""

from dataclasses import dataclass
from html import escape

from app.config import settings


@dataclass(frozen=True)
class RenderedEmail:
    subject: str
    html: str
    text: str


def _lang(locale: str) -> str:
    return "ko" if (locale or "").lower().startswith("ko") else "en"


_FOOTER = {
    "en": "This email is send-only. For inquiries, please contact",
    "ko": "본 메일은 발신 전용입니다. 문의:",
}


def _layout(subtitle: str, content_html: str, lang: str) -> str:
    support = escape(settings.email_support_address)
    return f"""<!DOCTYPE html>
<html lang="{lang}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:'Helvetica Neue',Arial,sans-serif;background-color:#f4f6f9;color:#1a1a2e;margin:0;padding:20px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f9;">
<tr><td align="center" style="padding:20px 0;">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;text-align:left;margin:0 auto;">
<tr><td style="background-color:#16264f;padding:28px 40px;border-top-left-radius:12px;border-top-right-radius:12px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="middle"><h1 style="color:#ffffff;font-size:20px;font-weight:700;margin:0;">Altos Funding</h1>
<p style="color:rgba(160,180,230,0.75);font-size:10px;letter-spacing:1.5px;text-transform:uppercase;margin:2px 0 0 0;">{escape(subtitle)}</p></td>
</tr></table></td></tr>
<tr><td style="padding:36px 40px;font-size:14px;line-height:1.75;color:#444444;background-color:#ffffff;">
{content_html}
</td></tr>
<tr><td style="background-color:#f5f4fb;padding:20px 40px;border-top:1px solid #e8e6f0;text-align:center;border-bottom-left-radius:12px;border-bottom-right-radius:12px;">
<p style="font-size:11px;color:#9a9ab0;line-height:1.7;margin:0;">&copy; Altos Funding. All rights reserved.<br>
{_FOOTER[lang]} <a href="mailto:{support}" style="color:#7c6af7;text-decoration:none;">{support}</a></p>
</td></tr>
</table></td></tr></table>
</body></html>"""


# 인증코드 메일: 목적별 제목·안내 문구
_CODE_TEXT = {
    "en": {
        "subtitle": "Email Verification",
        "subjects": {
            "SIGNUP": "[Altos Funding] Sign-up verification code",
            "WITHDRAW_REQUEST": "[Altos Funding] Withdrawal verification code",
        },
        "default_subject": "[Altos Funding] Verification code",
        "intros": {
            "SIGNUP": "Please enter the verification code below to complete your sign-up.",
            "WITHDRAW_REQUEST": "A withdrawal request was started on your account. Enter the code below to confirm the withdrawal.",
        },
        "default_intro": "Please enter the verification code below to complete authentication.",
        "heading": "Email Verification",
        "expiry": "The verification code will expire after {minutes} minutes. Do not share your code with anyone.",
        "ignore": "If you did not request this, please ignore this email.",
        "withdraw_warning": "If you did not request a withdrawal, change your password immediately and contact support.",
        "text_code": "Your verification code is: {code}",
    },
    "ko": {
        "subtitle": "Email Verification",
        "subjects": {
            "SIGNUP": "[Altos Funding] 회원가입 인증코드",
            "WITHDRAW_REQUEST": "[Altos Funding] 출금 신청 인증코드",
        },
        "default_subject": "[Altos Funding] 인증코드",
        "intros": {
            "SIGNUP": "회원가입을 완료하려면 아래 인증코드를 입력해 주세요.",
            "WITHDRAW_REQUEST": "회원님의 계정에서 출금 신청이 진행 중입니다. 출금을 확정하려면 아래 인증코드를 입력해 주세요.",
        },
        "default_intro": "인증을 완료하려면 아래 인증코드를 입력해 주세요.",
        "heading": "이메일 인증",
        "expiry": "인증코드는 {minutes}분 동안 유효합니다. 다른 사람에게 코드를 알려 주지 마세요.",
        "ignore": "직접 요청하지 않으셨다면 이 메일을 무시해 주세요.",
        "withdraw_warning": "출금을 신청하지 않으셨다면 즉시 비밀번호를 변경하고 고객센터로 문의해 주세요.",
        "text_code": "인증코드: {code}",
    },
}


def verification_code(code: str, purpose: str, locale: str, ttl_minutes: int) -> RenderedEmail:
    lang = _lang(locale)
    t = _CODE_TEXT[lang]
    subject = t["subjects"].get(purpose, t["default_subject"])
    intro = t["intros"].get(purpose, t["default_intro"])
    notice = t["withdraw_warning"] if purpose == "WITHDRAW_REQUEST" else t["ignore"]
    expiry = t["expiry"].format(minutes=ttl_minutes)

    content = f"""<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">{escape(t["heading"])}</h2>
<p>{escape(intro)}</p>
<div style="text-align:center;margin:24px 0;">
<span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#1a1a2e;">{escape(code)}</span>
</div>
<p>{escape(expiry)}</p>
<p>{escape(notice)}</p>"""
    text = "\n\n".join([intro, t["text_code"].format(code=code), expiry, notice, "Altos Funding"])
    return RenderedEmail(subject=subject, html=_layout(t["subtitle"], content, lang), text=text)


def password_reset(reset_url: str, locale: str, ttl_minutes: int) -> RenderedEmail:
    lang = _lang(locale)
    if lang == "ko":
        subject = "[Altos Funding] 비밀번호 재설정 안내"
        heading, intro, button = "비밀번호 재설정", "아래 버튼을 눌러 새 비밀번호를 설정해 주세요.", "비밀번호 재설정"
        expiry = f"링크는 {ttl_minutes}분 동안 유효합니다. 직접 요청하지 않으셨다면 이 메일을 무시해 주세요."
    else:
        subject = "[Altos Funding] Reset your password"
        heading, intro, button = "Password Reset", "Click the button below to set a new password.", "Reset Password"
        expiry = (
            f"This link expires in {ttl_minutes} minutes. "
            "If you did not request this, please ignore this email."
        )
    url = escape(reset_url)
    content = f"""<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">{escape(heading)}</h2>
<p>{escape(intro)}</p>
<div style="text-align:center;margin:24px 0;">
<a href="{url}" style="display:inline-block;background-color:#0057ff;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">{escape(button)}</a>
</div>
<p style="word-break:break-all;font-size:12px;color:#888888;">{url}</p>
<p>{escape(expiry)}</p>"""
    text = "\n\n".join([intro, reset_url, expiry, "Altos Funding"])
    return RenderedEmail(subject=subject, html=_layout("Password Reset", content, lang), text=text)


def _paragraphs(value: str) -> str:
    return escape(value).replace("\n", "<br>")


def contact_received(name: str, subject: str, contact_id: int, locale: str) -> RenderedEmail:
    lang = _lang(locale)
    if lang == "ko":
        mail_subject = f"[Altos Funding] 문의가 접수되었습니다 (#{contact_id})"
        greeting = f"{name}님, 안녕하세요."
        body = "문의가 정상적으로 접수되었습니다. 담당자가 확인 후 이메일로 답변드리겠습니다."
        label = "문의 제목"
    else:
        mail_subject = f"[Altos Funding] We received your inquiry (#{contact_id})"
        greeting = f"Dear {name},"
        body = "Your inquiry has been received. Our team will review it and reply by email."
        label = "Subject"
    content = f"""<p>{escape(greeting)}</p>
<p>{escape(body)}</p>
<p><strong>{escape(label)}:</strong> {escape(subject)} (#{contact_id})</p>"""
    text = "\n\n".join([greeting, body, f"{label}: {subject} (#{contact_id})", "Altos Funding"])
    return RenderedEmail(subject=mail_subject, html=_layout("Contact", content, lang), text=text)


def contact_replied(
    name: str, subject: str, inquiry: str, reply: str, contact_id: int, locale: str
) -> RenderedEmail:
    lang = _lang(locale)
    if lang == "ko":
        mail_subject = f"[Altos Funding] 문의에 대한 답변입니다 (#{contact_id})"
        greeting = f"{name}님, 안녕하세요."
        body = "보내 주신 문의에 답변드립니다."
        q_label, a_label = "문의 내용", "답변"
    else:
        mail_subject = f"[Altos Funding] Reply to your inquiry (#{contact_id})"
        greeting = f"Dear {name},"
        body = "Here is our reply to your inquiry."
        q_label, a_label = "Your inquiry", "Our reply"
    box = "background-color:#f5f4fb;border-radius:8px;padding:16px;margin:8px 0 20px 0;"
    content = f"""<p>{escape(greeting)}</p>
<p>{escape(body)}</p>
<p><strong>{escape(q_label)}:</strong> {escape(subject)} (#{contact_id})</p>
<div style="{box}">{_paragraphs(inquiry)}</div>
<p><strong>{escape(a_label)}</strong></p>
<div style="{box}">{_paragraphs(reply)}</div>"""
    text = "\n\n".join(
        [greeting, body, f"{q_label}: {subject} (#{contact_id})", inquiry, f"{a_label}:", reply, "Altos Funding"]
    )
    return RenderedEmail(subject=mail_subject, html=_layout("Contact", content, lang), text=text)
