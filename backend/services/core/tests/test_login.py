import pytest

from tests.conftest import run_sql
from tests.test_signup import EMAIL, _signup

PASSWORD = "Str0ngPass!"


@pytest.fixture
def member(client, sent_emails):
    res = _signup(client, sent_emails)
    assert res.status_code == 201, res.text
    return res.json()


def _login(client, email=EMAIL, password=PASSWORD):
    return client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password, "recaptcha_token": "token"},
        headers={"User-Agent": "pytest-browser", "X-Forwarded-For": "203.0.113.7, 10.0.0.1"},
    )


def test_login_returns_access_token_and_refresh_cookie(client, member):
    res = _login(client, email="TRADER@example.com")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["token_type"] == "bearer"
    assert body["user_id"] == member["id"]
    assert body["role"] == "USER"
    assert body["first_name"] == "Gil"
    assert body["refresh_token"] is None
    assert body["access_token"]

    cookie = res.headers["set-cookie"]
    assert "refreshToken=" in cookie
    assert "HttpOnly" in cookie
    assert "Path=/api/v1/auth" in cookie

    rows = run_sql("select ip_address, user_agent from core.login_history")
    assert [(r["ip_address"], r["user_agent"]) for r in rows] == [("203.0.113.7", "pytest-browser")]


def test_login_errors(client, member):
    res = _login(client, email="nobody@example.com")
    assert res.status_code == 404

    res = _login(client, password="wrong-password")
    assert res.status_code == 409
    assert res.json()["error_code"] == "invalid_credentials"

    run_sql("update core.users set status = 'BANNED'")
    res = _login(client)
    assert res.status_code == 409
    assert res.json()["error_code"] == "account_deactivated"


def test_me(client, member):
    token = _login(client).json()["access_token"]
    res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200, res.text
    me = res.json()
    assert me["id"] == member["id"]
    assert me["email"] == "trader@example.com"
    assert me["last_login_at"] is not None
    assert me["total_referrals"] == 0


def test_me_requires_valid_token(client, member):
    assert client.get("/api/v1/auth/me").status_code == 401
    res = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not-a-token"})
    assert res.status_code == 401
    assert res.json()["error_code"] == "invalid_token"


def test_refresh_rotates_token(client, member):
    _login(client)
    old_cookie = client.cookies.get("refreshToken")

    res = client.post("/api/v1/auth/refresh", json={})
    assert res.status_code == 200, res.text
    new_cookie = client.cookies.get("refreshToken")
    assert new_cookie and new_cookie != old_cookie

    token = res.json()["access_token"]
    assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 200


def test_refresh_reuse_revokes_all_sessions(client, member):
    _login(client)
    stolen = client.cookies.get("refreshToken")
    assert client.post("/api/v1/auth/refresh").status_code == 200
    current = client.cookies.get("refreshToken")

    # 이미 바뀐 토큰을 다시 쓰면 거절하고 모든 세션을 끊는다.
    client.cookies.clear()
    res = client.post("/api/v1/auth/refresh", json={"refresh_token": stolen})
    assert res.status_code == 401
    assert res.json()["error_code"] == "invalid_refresh_token"

    res = client.post("/api/v1/auth/refresh", json={"refresh_token": current})
    assert res.status_code == 401


def test_refresh_without_token(client):
    res = client.post("/api/v1/auth/refresh")
    assert res.status_code == 401


def test_logout_revokes_refresh_token(client, member):
    _login(client)
    token = client.cookies.get("refreshToken")

    res = client.post("/api/v1/auth/logout")
    assert res.status_code == 200
    assert res.json() == {"ok": True, "message_key": "auth.logout_success"}
    assert client.cookies.get("refreshToken") is None

    res = client.post("/api/v1/auth/refresh", json={"refresh_token": token})
    assert res.status_code == 401


def test_banned_user_cannot_refresh_or_use_token(client, member):
    token = _login(client).json()["access_token"]
    run_sql("update core.users set status = 'BANNED'")
    assert client.post("/api/v1/auth/refresh").status_code == 401
    res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 403


def test_two_factor_user_gets_temp_token_only(client, member):
    run_sql("update core.users set is_2fa_enabled = true")
    res = _login(client)
    assert res.status_code == 200
    body = res.json()
    assert body["requires_2fa"] is True
    assert body["user_id"] == member["id"]
    assert "access_token" not in body
    assert client.cookies.get("2fa_temp_token")
    assert client.cookies.get("refreshToken") is None
