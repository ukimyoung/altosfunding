"""제휴사 회원 Member ID 로그인·계정 활성화·이메일 규칙."""

import pytest

from tests.conftest import run_sql
from tests.test_admin_users import admin_headers  # noqa: F401
from tests.test_google_login import (  # noqa: F401
    _callback,
    _fake_google,
    _start,
    google_settings,
)
from tests.test_login import PASSWORD, _login, member  # noqa: F401
from tests.test_signup import _signup

SHARED = "abc123@gmail.com"


def _partner(member_id: str, email: str | None = SHARED, status: str = "active", name: str = "HONG GILDONG") -> None:
    run_sql(
        "insert into core.partner_members (member_id, site, name, email, phone, status, joined_at, partner_updated_at)"
        " values ($1, '10power', $2, $3, '01012345678', $4, now(), now())",
        member_id,
        name,
        email,
        status,
    )


def _send_code(client, member_id: str):
    return client.post(
        "/api/v1/auth/partner/activation/send-code", json={"member_id": member_id, "recaptcha_token": "t"}
    )


def _complete(client, member_id: str, code: str, password: str = PASSWORD, **extra):
    return client.post(
        "/api/v1/auth/partner/activation/complete",
        json={"member_id": member_id, "code": code, "password": password, "agree_to_terms": True, **extra},
    )


def _activate(client, sent_emails, member_id: str):
    res = _send_code(client, member_id)
    assert res.status_code == 200, res.text
    res = _complete(client, member_id, sent_emails[-1]["code"])
    assert res.status_code == 201, res.text
    return res.json()


def _auth(client, identifier: str) -> dict:
    token = _login(client, email=identifier).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_first_login_requires_activation(client, db):
    _partner("ukim")
    res = _login(client, email="ukim", password="anything")
    assert res.status_code == 409
    body = res.json()
    assert body["error_code"] == "partner_activation_required"
    assert body["data"] == {"member_id": "ukim", "masked_email": "a***@gmail.com"}

    assert _login(client, email="nobody").json()["error_code"] == "not_found"


def test_partner_without_email_or_deleted_cannot_activate(client, db):
    _partner("noemail", email=None)
    _partner("gone", status="deleted")
    res = _login(client, email="noemail")
    assert (res.status_code, res.json()["error_code"]) == (409, "partner_email_required")
    assert _send_code(client, "noemail").json()["error_code"] == "partner_email_required"
    res = _login(client, email="gone")
    assert (res.status_code, res.json()["error_code"]) == (409, "account_deactivated")


@pytest.mark.parametrize("status", ["unconfirmed", "suspended"])
def test_partner_status_does_not_block(client, sent_emails, db, status):
    _partner("ukim", status=status)
    _activate(client, sent_emails, "ukim")
    assert _login(client, email="ukim").status_code == 200


def test_activation_creates_separate_accounts_for_shared_email(client, sent_emails, db):
    _partner("ukim")
    _partner("yoy")

    res = _send_code(client, "UKIM")  # 대소문자 무시
    assert res.status_code == 200, res.text
    assert res.json() == {"member_id": "ukim", "masked_email": "a***@gmail.com", "expiry_minutes": 30}
    ukim_code = sent_emails[-1]["code"]
    assert sent_emails[-1]["email"] == SHARED
    # 같은 이메일의 다른 회원이 바로 코드를 받아도 서로의 코드가 섞이지 않는다.
    assert _send_code(client, "yoy").status_code == 200
    yoy_code = sent_emails[-1]["code"]

    if ukim_code != yoy_code:
        assert _complete(client, "yoy", ukim_code).json()["error_code"] == "invalid_verification_code"
    res = _complete(client, "ukim", ukim_code)
    assert res.status_code == 201, res.text
    assert res.json()["access_token"]
    assert "refreshToken=" in res.headers["set-cookie"]
    assert _complete(client, "yoy", yoy_code).status_code == 201

    rows = run_sql(
        "select partner_member_id, email, auth_provider, first_name, phone, email_verified_at is not null as verified"
        " from core.users order by partner_member_id"
    )
    assert [r["partner_member_id"] for r in rows] == ["ukim", "yoy"]
    assert {r["email"] for r in rows} == {SHARED}
    assert all(r["auth_provider"] == "PARTNER" and r["verified"] for r in rows)
    assert rows[0]["first_name"] == "HONG GILDONG"
    assert rows[0]["phone"] == "+821012345678"  # 제휴사 국내 번호는 +82로 저장

    # 이후에는 Member ID + 비밀번호로 로그인
    assert _login(client, email="ukim").status_code == 200
    assert _login(client, email="Yoy").status_code == 200
    assert _login(client, email="ukim", password="wrong-password").json()["error_code"] == "invalid_credentials"
    # 제휴 계정만 쓰는 이메일로는 로그인할 수 없다
    res = _login(client, email=SHARED)
    assert (res.status_code, res.json()["error_code"]) == (404, "partner_use_member_id")

    me = client.get("/api/v1/auth/me", headers=_auth(client, "ukim")).json()
    assert me["is_partner_member"] is True
    assert me["partner_member_id"] == "ukim"
    assert me["can_change_password"] is True

    # 다시 활성화할 수 없다
    assert _send_code(client, "ukim").json()["error_code"] == "partner_already_activated"


def test_activation_requires_terms_and_valid_code(client, sent_emails, db):
    _partner("ukim")
    _send_code(client, "ukim")
    code = sent_emails[-1]["code"]
    assert _complete(client, "ukim", code, agree_to_terms=False).json()["error_code"] == "tos_not_accepted"
    wrong = "000000" if code != "000000" else "111111"
    assert _complete(client, "ukim", wrong).json()["error_code"] == "invalid_verification_code"
    assert run_sql("select count(*) as n from core.users")[0]["n"] == 0
    assert _complete(client, "ukim", code).status_code == 201


def test_signup_rejects_email_used_by_partner_account(client, sent_emails, db):
    _partner("ukim")
    # 활성화 전(partner_members에만 있음)이면 일반 가입 가능 — 여기서는 활성화 후 거부를 확인한다.
    _activate(client, sent_emails, "ukim")
    res = client.post(
        "/api/v1/auth/email/send-verification", json={"email": SHARED, "purpose": "SIGNUP", "recaptcha_token": "t"}
    )
    assert (res.status_code, res.json()["error_code"]) == (409, "email_already_exists")


def test_partner_can_activate_when_standard_account_has_same_email(client, sent_emails, db):
    assert _signup(client, sent_emails, email=SHARED).status_code == 201
    _partner("ukim")
    _activate(client, sent_emails, "ukim")
    rows = run_sql("select partner_member_id from core.users where email = $1 order by created_at", SHARED)
    assert [r["partner_member_id"] for r in rows] == [None, "ukim"]
    # 이메일 로그인은 일반 계정으로
    res = _login(client, email=SHARED)
    assert res.status_code == 200
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {res.json()['access_token']}"}).json()
    assert me["is_partner_member"] is False


def test_google_does_not_attach_to_partner_account(client, monkeypatch, sent_emails, db):
    _partner("ukim")
    _activate(client, sent_emails, "ukim")
    _fake_google(monkeypatch, email=SHARED)
    res = _callback(client, _start(client))
    assert res.status_code == 302
    assert "error=google_auth_failed&detail=partner_use_member_id" in res.headers["location"]
    assert run_sql("select count(*) as n from core.users")[0]["n"] == 1


def test_forgot_password_with_member_id(client, sent_emails, db):
    _partner("ukim")
    _partner("yoy")
    _activate(client, sent_emails, "ukim")
    sent_emails.clear()

    client.post("/api/v1/auth/password/forgot", json={"email": "yoy", "recaptcha_token": "t"})  # 활성화 전
    client.post("/api/v1/auth/password/forgot", json={"email": SHARED, "recaptcha_token": "t"})  # 제휴 계정 이메일
    assert sent_emails == []

    res = client.post("/api/v1/auth/password/forgot", json={"email": "UKIM", "recaptcha_token": "t"})
    assert res.status_code == 200
    assert len(sent_emails) == 1
    assert sent_emails[0]["email"] == SHARED
    token = sent_emails[0]["reset_url"].split("token=")[1]
    res = client.post("/api/v1/auth/password/reset", json={"token": token, "new_password": "N3wPassword!"})
    assert res.status_code == 200
    assert _login(client, email="ukim", password="N3wPassword!").status_code == 200


def test_partner_can_change_email(client, sent_emails, db):
    _partner("ukim")
    _activate(client, sent_emails, "ukim")
    headers = _auth(client, "ukim")

    res = client.post("/api/v1/auth/email/change/send-code", json={"new_email": SHARED}, headers=headers)
    assert res.json()["error_code"] == "same_email"
    res = client.post("/api/v1/auth/email/change/send-code", json={"new_email": "New@Example.com"}, headers=headers)
    assert res.status_code == 200, res.text
    assert sent_emails[-1]["email"] == "new@example.com"
    code = sent_emails[-1]["code"]

    res = client.post("/api/v1/auth/email/change", json={"new_email": "other@example.com", "code": code}, headers=headers)
    assert res.status_code == 400
    res = client.post("/api/v1/auth/email/change", json={"new_email": "new@example.com", "code": code}, headers=headers)
    assert res.status_code == 200, res.text
    assert res.json()["email"] == "new@example.com"
    assert _login(client, email="ukim").status_code == 200


def test_standard_member_cannot_change_email(client, sent_emails, db):
    assert _signup(client, sent_emails).status_code == 201
    headers = _auth(client, "trader@example.com")
    res = client.post("/api/v1/auth/email/change/send-code", json={"new_email": "x@example.com"}, headers=headers)
    assert (res.status_code, res.json()["error_code"]) == (403, "email_change_not_allowed")


def test_withdrawn_partner_can_activate_again(client, sent_emails, admin_headers):  # noqa: F811
    _partner("ukim")
    user = _activate(client, sent_emails, "ukim")
    res = client.post(f"/api/v1/admin/users/{user['user_id']}/withdraw", headers=admin_headers)
    assert res.status_code == 200, res.text
    row = run_sql("select partner_member_id, withdrawn_partner_member_id from core.users where id = $1::uuid", user["user_id"])[0]
    assert (row["partner_member_id"], row["withdrawn_partner_member_id"]) == (None, "ukim")

    assert _login(client, email="ukim").json()["error_code"] == "partner_activation_required"
    _activate(client, sent_emails, "ukim")
    assert run_sql("select count(*) as n from core.users where partner_member_id = 'ukim'")[0]["n"] == 1
