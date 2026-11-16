"""메일 템플릿 관리(DB) API와 DB 템플릿으로 메일 보내기."""

from pathlib import Path

from app.services import email_templates
from tests.conftest import MIGRATIONS_DIR, run_sql
from tests.test_admin_users import admin_headers  # noqa: F401
from tests.test_login import member  # noqa: F401
from tests.test_wallets import TRADER, trader  # noqa: F401

URL = "/api/v1/admin/templates"


def _send_withdraw_code(client, headers):
    body = {"email": TRADER, "purpose": "WITHDRAW_REQUEST"}
    return client.post("/api/v1/auth/email/send-verification", headers=headers, json=body)


def test_migration_seed_matches_code_defaults(client):
    """마이그레이션의 기본 템플릿과 코드 기본값(DEFAULT_TEMPLATES)이 같은지."""
    rows = run_sql("select template_id, locale, subject, html_content from core.email_template_contents")
    seeded = {(r["template_id"], r["locale"]): (r["subject"], r["html_content"]) for r in rows}
    expected = {
        (tid, loc): (body["subject"], body["html"])
        for tid, t in email_templates.DEFAULT_TEMPLATES.items()
        for loc, body in t["locales"].items()
    }
    assert seeded == expected
    assert Path(next(MIGRATIONS_DIR.glob("*_core_email_templates.sql"))).exists()


def test_list_detail_requires_admin(client, admin_headers, trader):  # noqa: F811
    assert client.get(URL, headers=trader).status_code == 403
    items = client.get(URL, headers=admin_headers).json()["items"]
    ids = [i["template_id"] for i in items]
    assert set(ids) == set(email_templates.DEFAULT_TEMPLATES)
    assert all(i["is_system"] for i in items)

    detail = client.get(f"{URL}/withdraw_verification_code", headers=admin_headers).json()
    assert detail["template_name"] == "출금 신청 인증코드"
    assert detail["rule"] == {
        "event_type": "withdraw_verification_code",
        "is_active": True,
        "send_mode": "instant",
        "delay_minutes": 0,
        "event_name": detail["description"],
    }
    assert set(detail["locales"]) == {"en", "ko"}
    assert detail["variables"] == ["verification_code", "expiry_minutes"]
    assert client.get(f"{URL}/nope", headers=admin_headers).json()["error_code"] == "template_not_found"


def test_edited_template_is_used_for_sending(client, admin_headers, trader, sent_emails):  # noqa: F811
    body = {
        "template_name": "출금 인증코드",
        "description": "설명",
        "rule": {"send_mode": "instant", "delay_minutes": 0},
        "locales": {"en": {"subject": "Code {{ verification_code }}", "html_content": "<p>Your code: {{ verification_code }}</p>"}},
    }
    res = client.put(f"{URL}/withdraw_verification_code", headers=admin_headers, json=body)
    assert res.status_code == 200, res.text
    assert res.json()["locales"]["en"]["subject"] == "Code {{ verification_code }}"
    # ko는 보내지 않았으므로 그대로
    assert res.json()["locales"]["ko"]["subject"] == "[Altos Funding] 출금 신청 인증코드"

    assert _send_withdraw_code(client, trader).status_code == 201
    sent = sent_emails[-1]
    assert sent["subject"] == f"Code {sent['code']}" and sent["purpose"] == "WITHDRAW_REQUEST"


def test_broken_or_disabled_template_falls_back(client, admin_headers, trader, sent_emails):  # noqa: F811
    bad = {
        "template_name": "x",
        "rule": {},
        "locales": {"en": {"subject": "s", "html_content": "{% if %}"}},
    }
    assert client.put(f"{URL}/withdraw_verification_code", headers=admin_headers, json=bad).json()["error_code"] == "invalid_template"
    assert client.put(f"{URL}/withdraw_verification_code", headers=admin_headers,
                      json={**bad, "locales": {"ja": {"subject": "s", "html_content": "<p>x</p>"}}}).json()["error_code"] == "invalid_locale"

    # 인증 메일은 꺼 두어도 기본 템플릿으로 보낸다.
    run_sql("update core.email_templates set is_active = false")
    assert _send_withdraw_code(client, trader).status_code == 201
    assert sent_emails[-1]["subject"] == "[Altos Funding] Withdrawal verification code"


def test_disabled_contact_template_is_not_sent(client, sent_emails):
    run_sql("update core.email_templates set is_active = false where id = 'contact_received'")
    body = {"name": "Jane", "email": "jane@example.com", "category": "general", "subject": "hi", "message": "hello"}
    assert client.post("/api/v1/support/contact", json=body).status_code == 201
    assert sent_emails == []


def test_create_and_delete_template(client, admin_headers):  # noqa: F811
    body = {
        "template_id": "withdrawal_completed",
        "template_name": "출금 완료 안내",
        "description": "출금 승인 직후",
        "rule": {"send_mode": "delay", "delay_minutes": 30},
        "variables": ["amount"],
        "locales": {
            "en": {"subject": "Withdrawal of {{ amount }} USDT completed", "html_content": "<p>{{ amount }} USDT</p>"},
            "ko": {"subject": "{{ amount }} USDT 출금 완료", "html_content": "<p>{{ amount }} USDT</p>"},
        },
    }
    res = client.post(URL, headers=admin_headers, json=body)
    assert res.status_code == 201, res.text
    out = res.json()
    assert out["is_system"] is False and out["rule"]["send_mode"] == "delay" and out["rule"]["delay_minutes"] == 30
    assert out["variables"] == ["amount"]
    assert client.post(URL, headers=admin_headers, json=body).json()["error_code"] == "template_id_exists"

    no_en = {**body, "template_id": "no_english", "locales": {"ko": body["locales"]["ko"]}}
    assert client.post(URL, headers=admin_headers, json=no_en).json()["error_code"] == "locales.en_required"
    bad_id = {**body, "template_id": "Bad-ID"}
    assert client.post(URL, headers=admin_headers, json=bad_id).status_code == 422

    ids = [i["template_id"] for i in client.get(URL, headers=admin_headers).json()["items"]]
    assert ids[-1] == "withdrawal_completed"

    assert client.delete(f"{URL}/password_reset", headers=admin_headers).json()["error_code"] == "system_template"
    assert client.delete(f"{URL}/withdrawal_completed", headers=admin_headers).status_code == 204
    assert run_sql("select count(*) n from core.email_template_contents where template_id = 'withdrawal_completed'")[0]["n"] == 0


def test_preview(client, admin_headers):  # noqa: F811
    raw = client.post(f"{URL}/preview", headers=admin_headers, json={"content_html": "<p>{{ name }}</p>"}).json()
    assert "<p>{{ name }}</p>" in raw["html"] and "Altos Funding" in raw["html"]

    body = {"content_html": "<p>{{ name }}</p>", "subject": "Hi {{ name }}", "locale": "ko", "sample": {"name": "<Kim>"}}
    out = client.post(f"{URL}/preview", headers=admin_headers, json=body).json()
    assert "<p>&lt;Kim&gt;</p>" in out["html"] and out["subject"] == "Hi <Kim>" and "본 메일은 발신 전용" in out["html"]
