import time

import pyotp
import pytest

from tests.conftest import run_sql
from tests.test_login import PASSWORD, _login, member  # noqa: F401
from tests.test_signup import EMAIL

NEW_PASSWORD = "N3wStr0ngPass!"


def _auth(client):
    token = _login(client).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _code(secret: str, steps_ahead: int = 0) -> str:
    totp = pyotp.TOTP(secret)
    return totp.at(time.time() + steps_ahead * totp.interval)


@pytest.fixture
def two_fa(client, member):  # noqa: F811
    headers = _auth(client)
    res = client.post("/api/v1/auth/2fa/setup", headers=headers)
    assert res.status_code == 200, res.text
    setup = res.json()
    assert setup["qr_uri"].startswith("otpauth://totp/")
    assert len(setup["backup_codes"]) == 10

    res = client.post("/api/v1/auth/2fa/verify", headers=headers, json={"code": "000000"})
    assert res.status_code == 400

    res = client.post("/api/v1/auth/2fa/verify", headers=headers, json={"code": _code(setup["secret"])})
    assert res.status_code == 200, res.text
    assert client.get("/api/v1/auth/me", headers=headers).json()["is_2fa_enabled"] is True
    return {**setup, "headers": headers}


def test_2fa_login_with_totp_and_backup_code(client, two_fa):
    res = _login(client)
    assert res.status_code == 200
    assert res.json()["requires_2fa"] is True
    assert "access_token" not in res.json()

    res = client.post("/api/v1/auth/2fa/login", json={"code": "123456"})
    assert res.status_code == 401
    assert res.json()["error_code"] == "invalid_2fa_code"

    res = client.post("/api/v1/auth/2fa/login", json={"code": _code(two_fa["secret"], 1)})
    assert res.status_code == 200, res.text
    assert res.json()["access_token"]
    assert "refreshToken=" in res.headers["set-cookie"]

    # 백업 코드는 한 번만 쓸 수 있다.
    backup = two_fa["backup_codes"][0]
    client.cookies.clear()
    _login(client)
    assert client.post("/api/v1/auth/2fa/login", json={"code": backup}).status_code == 200
    client.cookies.clear()
    _login(client)
    assert client.post("/api/v1/auth/2fa/login", json={"code": backup}).status_code == 401


def test_2fa_login_without_temp_token(client, two_fa):
    client.cookies.clear()
    res = client.post("/api/v1/auth/2fa/login", json={"code": "123456"})
    assert res.status_code == 401
    assert res.json()["error_code"] == "2fa_session_expired"


def test_2fa_totp_code_cannot_be_reused(client, two_fa):
    # verify에서 쓴 현재 코드는 로그인에 다시 쓸 수 없다.
    _login(client)
    res = client.post("/api/v1/auth/2fa/login", json={"code": _code(two_fa["secret"])})
    assert res.status_code == 401


def test_2fa_locks_after_repeated_failures(client, two_fa):
    _login(client)
    for _ in range(5):
        assert client.post("/api/v1/auth/2fa/login", json={"code": "111111"}).status_code == 401
    res = client.post("/api/v1/auth/2fa/login", json={"code": _code(two_fa["secret"], 1)})
    assert res.status_code == 429
    assert res.json()["error_code"] == "2fa_locked"


def test_2fa_regenerate_and_disable(client, two_fa):
    headers = two_fa["headers"]
    res = client.post(
        "/api/v1/auth/2fa/backup-codes/regenerate", headers=headers, json={"code": _code(two_fa["secret"], 1)}
    )
    assert res.status_code == 200, res.text
    new_codes = res.json()["backup_codes"]
    assert set(new_codes).isdisjoint(two_fa["backup_codes"])

    # 예전 백업 코드로는 끌 수 없고, 새 백업 코드로는 끌 수 있다.
    assert client.post("/api/v1/auth/2fa/disable", headers=headers, json={"code": two_fa["backup_codes"][0]}).status_code == 400
    res = client.post("/api/v1/auth/2fa/disable", headers=headers, json={"code": new_codes[0]})
    assert res.status_code == 200, res.text
    assert client.get("/api/v1/auth/me", headers=headers).json()["is_2fa_enabled"] is False
    assert run_sql("select count(*) as n from core.user_backup_codes")[0]["n"] == 0

    # 꺼진 뒤에는 바로 토큰이 나온다.
    assert _login(client).json()["access_token"]


def test_change_password_revokes_other_sessions(client, member):  # noqa: F811
    other = _login(client)
    other_refresh = other.cookies.get("refreshToken")
    client.cookies.clear()
    res = _login(client)
    headers = {"Authorization": f"Bearer {res.json()['access_token']}"}

    res = client.put("/api/v1/auth/password", headers=headers, json={"old_password": "wrong", "new_password": NEW_PASSWORD})
    assert res.status_code == 409
    assert res.json()["error_code"] == "invalid_current_password"

    res = client.put("/api/v1/auth/password", headers=headers, json={"old_password": PASSWORD, "new_password": NEW_PASSWORD})
    assert res.status_code == 200, res.text

    # 지금 기기의 refresh 토큰은 살아 있고, 다른 기기의 토큰은 끊긴다.
    assert client.post("/api/v1/auth/refresh").status_code == 200
    client.cookies.clear()
    client.cookies.set("refreshToken", other_refresh, path="/api/v1/auth")
    assert client.post("/api/v1/auth/refresh").status_code == 401

    assert _login(client).status_code == 409
    assert _login(client, password=NEW_PASSWORD).status_code == 200


def test_forgot_and_reset_password(client, member, sent_emails):  # noqa: F811
    sent_emails.clear()
    res = client.post("/api/v1/auth/password/forgot", json={"email": "nobody@example.com", "recaptcha_token": "t"})
    assert res.status_code == 200
    assert sent_emails == []

    res = client.post("/api/v1/auth/password/forgot", json={"email": EMAIL.upper(), "recaptcha_token": "t"})
    assert res.status_code == 200
    assert res.json()["message_key"] == "auth.password_reset_sent"
    assert len(sent_emails) == 1
    token = sent_emails[0]["reset_url"].split("token=")[1]

    res = client.post("/api/v1/auth/password/forgot", json={"email": EMAIL, "recaptcha_token": "t"})
    assert res.status_code == 400
    assert res.json()["error_code"] == "rate_limit_exceeded"

    session_refresh = _login(client).cookies.get("refreshToken")

    res = client.post("/api/v1/auth/password/reset", json={"token": "bad", "new_password": NEW_PASSWORD})
    assert res.json()["error_code"] == "invalid_reset_token"

    res = client.post("/api/v1/auth/password/reset", json={"token": token, "new_password": NEW_PASSWORD})
    assert res.status_code == 200, res.text
    res = client.post("/api/v1/auth/password/reset", json={"token": token, "new_password": NEW_PASSWORD})
    assert res.json()["error_code"] == "invalid_reset_token"

    client.cookies.clear()
    client.cookies.set("refreshToken", session_refresh, path="/api/v1/auth")
    assert client.post("/api/v1/auth/refresh").status_code == 401
    assert _login(client, password=NEW_PASSWORD).status_code == 200


def test_reset_token_expired(client, member, sent_emails):  # noqa: F811
    sent_emails.clear()
    client.post("/api/v1/auth/password/forgot", json={"email": EMAIL, "recaptcha_token": "t"})
    token = sent_emails[0]["reset_url"].split("token=")[1]
    run_sql("update core.password_reset_tokens set expires_at = now() - interval '1 minute'")
    res = client.post("/api/v1/auth/password/reset", json={"token": token, "new_password": NEW_PASSWORD})
    assert res.status_code == 400
    assert res.json()["error_code"] == "reset_token_expired"


def test_profile_withdraw_email_and_login_history(client, member):  # noqa: F811
    headers = _auth(client)
    res = client.put("/api/v1/auth/profile", headers=headers, json={"city": " Seoul ", "phone": "010-1234-5678"})
    assert res.status_code == 200, res.text
    assert res.json()["city"] == "Seoul"
    assert res.json()["first_name"] == "Gil"

    res = client.put("/api/v1/auth/profile", headers=headers, json={"referrer_code": "NOPE0000"})
    assert res.json()["error_code"] == "invalid_referrer_code"

    res = client.patch("/api/v1/auth/security/withdraw-email", headers=headers, json={"enabled": False})
    assert res.json() == {"ok": True, "is_email_enabled": False}

    _login(client)
    res = client.get("/api/v1/auth/login-history?size=1", headers=headers)
    body = res.json()
    assert body["total"] == 2
    assert body["pages"] == 2
    assert body["items"][0]["ip_address"] == "203.0.113.7"
