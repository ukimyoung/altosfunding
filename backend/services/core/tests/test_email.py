"""SES 메일 발송기와 메일 템플릿. 실제 AWS에는 접속하지 않고 가짜 SES 클라이언트를 쓴다."""

import asyncio

import pytest

from app.services import email_templates
from app.services.email import EmailSendError, SesEmailSender, get_email_sender
from tests.conftest import run_sql
from tests.test_admin_users import admin_headers  # noqa: F401
from tests.test_login import member  # noqa: F401
from tests.test_wallets import TRADER, trader  # noqa: F401


class FakeSes:
    def __init__(self, fail: bool = False) -> None:
        self.fail = fail
        self.calls: list[dict] = []

    def send_email(self, **params):
        self.calls.append(params)
        if self.fail:
            raise RuntimeError("MessageRejected: Email address is not verified.")
        return {"MessageId": "fake-id"}


def test_ses_sender_builds_message(monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "email_from_address", "noreply@altosfunding.com")
    fake = FakeSes()
    sender = SesEmailSender(client=fake)
    mail = email_templates.render_default(
        "withdraw_verification_code", "ko", {"verification_code": "123456", "expiry_minutes": 30}
    )
    asyncio.run(sender.send("user@example.com", mail, "withdraw_verification_code"))

    params = fake.calls[0]
    assert params["Source"] == "Altos Funding <noreply@altosfunding.com>"
    assert params["Destination"] == {"ToAddresses": ["user@example.com"]}
    assert params["Message"]["Subject"]["Data"] == "[Altos Funding] 출금 신청 인증코드"
    assert "123456" in params["Message"]["Body"]["Html"]["Data"]
    assert "123456" in params["Message"]["Body"]["Text"]["Data"]
    assert "30분" in params["Message"]["Body"]["Text"]["Data"]
    assert params["Tags"] == [{"Name": "kind", "Value": "withdraw_verification_code"}]
    assert "ConfigurationSetName" not in params


def test_ses_sender_failure_raises():
    sender = SesEmailSender(client=FakeSes(fail=True))
    mail = email_templates.render_default("password_reset", "en", {"reset_url": "https://x/r?t=1", "expiry_minutes": 30})
    with pytest.raises(EmailSendError):
        asyncio.run(sender.send("user@example.com", mail, "password_reset"))


def test_templates_escape_and_locale():
    mail = email_templates.render_default(
        "withdraw_verification_code", "en-US", {"verification_code": "654321", "expiry_minutes": 30}
    )
    assert mail.subject == "[Altos Funding] Withdrawal verification code"
    assert "30 minutes" in mail.html and "did not request a withdrawal" in mail.html

    signup = email_templates.render_default("email_verification_requested", "ko", {"verification_code": "1", "expiry_minutes": 30})
    assert signup.subject == "[Altos Funding] 회원가입 인증코드"

    replied = email_templates.render_default(
        "contact_replied",
        "en",
        {"name": "<b>Kim</b>", "inquiry_subject": "s", "inquiry": "q\nline", "reply": "<script>x</script>", "contact_id": 7},
    )
    assert "<script>" not in replied.html and "&lt;script&gt;" in replied.html
    assert "&lt;b&gt;Kim&lt;/b&gt;" in replied.html
    assert "q<br>line" in replied.html
    assert replied.subject == "[Altos Funding] Reply to your inquiry (#7)"


def test_sandbox_blocks_unsafe_template():
    from jinja2.exceptions import SecurityError

    with pytest.raises(SecurityError):
        email_templates.render_html("{{ ''.__class__.__mro__[1].__subclasses__() }}", {})


def test_ses_backend_requires_from_address(monkeypatch):
    from app.config import settings
    from app.services import email

    email._ses_sender.cache_clear()
    monkeypatch.setattr(settings, "email_backend", "ses")
    monkeypatch.setattr(settings, "email_from_address", "")
    with pytest.raises(RuntimeError):
        get_email_sender()
    email._ses_sender.cache_clear()


def test_withdraw_code_send_failure_allows_retry(client, trader, monkeypatch):  # noqa: F811
    """메일 발송이 실패하면 502를 돌려주고, 재발송 제한(60초)에 걸리지 않게 코드를 지운다."""
    from app.main import app

    failing = SesEmailSender(client=FakeSes(fail=True))
    app.dependency_overrides[get_email_sender] = lambda: failing
    try:
        send = "/api/v1/auth/email/send-verification"
        body = {"email": TRADER, "purpose": "WITHDRAW_REQUEST"}
        res = client.post(send, headers=trader, json=body)
        assert res.status_code == 502 and res.json()["error_code"] == "email_send_failed"
        assert run_sql("select count(*) n from core.email_verifications where purpose = 'WITHDRAW_REQUEST'")[0]["n"] == 0

        ok = SesEmailSender(client=FakeSes())
        app.dependency_overrides[get_email_sender] = lambda: ok
        assert client.post(send, headers=trader, json=body).status_code == 201
        assert run_sql("select count(*) n from core.email_verifications where purpose = 'WITHDRAW_REQUEST'")[0]["n"] == 1
    finally:
        app.dependency_overrides.pop(get_email_sender, None)
