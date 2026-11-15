from urllib.parse import parse_qs, urlsplit

import pytest

from app.config import settings
from app.errors import AppError
from app.services import google_auth
from tests.conftest import run_sql
from tests.test_login import PASSWORD, _login, member  # noqa: F401
from tests.test_signup import EMAIL

WEB = "https://altosfunding.example"


@pytest.fixture(autouse=True)
def google_settings(monkeypatch):
    monkeypatch.setattr(settings, "google_client_id", "client-id")
    monkeypatch.setattr(settings, "google_client_secret", "client-secret")
    monkeypatch.setattr(settings, "google_redirect_uri", "https://api.example/api/v1/auth/google/callback")
    monkeypatch.setattr(settings, "web_base_url", WEB)
    monkeypatch.setattr(settings, "frontend_allowed_origins", "https://local.altosfunding.com:5173")


def _fake_google(monkeypatch, email="new.trader@gmail.com", **extra):
    async def fake_exchange(code):
        if code == "bad":
            raise AppError(400, "google_auth_failed", "Google 인증에 실패했습니다.")
        return google_auth.GoogleProfile(
            sub="google-sub-1",
            email=email,
            first_name=extra.get("first_name", "New"),
            last_name="Trader",
            avatar_url="https://lh3.googleusercontent.com/a/photo",
        )

    monkeypatch.setattr(google_auth, "exchange_code", fake_exchange)


def _start(client, state=None):
    params = {"prompt": "select_account"}
    if state:
        params["state"] = state
    res = client.get("/api/v1/auth/google/login", params=params, follow_redirects=False)
    assert res.status_code == 302, res.text
    location = urlsplit(res.headers["location"])
    assert location.netloc == "accounts.google.com"
    query = parse_qs(location.query)
    assert query["client_id"] == ["client-id"]
    assert query["prompt"] == ["select_account"]
    assert query["scope"] == ["openid email profile"]
    return query["state"][0]


def _callback(client, state, code="code"):
    return client.get(
        "/api/v1/auth/google/callback", params={"code": code, "state": state}, follow_redirects=False
    )


def test_new_google_user_is_signed_up_and_logged_in(client, monkeypatch, db):
    _fake_google(monkeypatch)
    state = _start(client, "https://local.altosfunding.com:5173/login")
    res = _callback(client, state)
    assert res.status_code == 302
    assert res.headers["location"] == "https://local.altosfunding.com:5173/my-page?login_success=true&welcome=true"
    assert "refreshToken=" in res.headers["set-cookie"]

    rows = run_sql("select email, auth_provider, password_hash, email_verified_at, first_name from core.users")
    assert len(rows) == 1
    assert rows[0]["email"] == "new.trader@gmail.com"
    assert rows[0]["auth_provider"] == "GOOGLE"
    assert rows[0]["password_hash"] is None
    assert rows[0]["email_verified_at"] is not None

    # refresh 쿠키로 access token을 받을 수 있다.
    res = client.post("/api/v1/auth/refresh")
    assert res.status_code == 200, res.text
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {res.json()['access_token']}"})
    assert me.json()["auth_provider"] == "GOOGLE"

    # 두 번째 로그인은 welcome 없이
    res = _callback(client, _start(client))
    assert res.headers["location"] == f"{WEB}/my-page?login_success=true"


def test_existing_email_member_can_use_google(client, monkeypatch, member):  # noqa: F811
    _fake_google(monkeypatch, email=EMAIL.upper())
    res = _callback(client, _start(client))
    assert res.headers["location"] == f"{WEB}/my-page?login_success=true"
    assert run_sql("select count(*) as n from core.users")[0]["n"] == 1
    # 비밀번호 로그인도 그대로 된다.
    assert _login(client).status_code == 200


def test_unknown_state_origin_falls_back_to_web(client, monkeypatch, db):
    _fake_google(monkeypatch)
    res = _callback(client, _start(client, "https://evil.example"))
    assert res.headers["location"].startswith(f"{WEB}/my-page")


def test_callback_rejects_forged_or_missing_state(client, monkeypatch, db):
    _fake_google(monkeypatch)
    state = _start(client)

    # nonce 쿠키가 없는 브라우저(다른 사람이 만든 링크)에서는 실패
    client.cookies.clear()
    res = _callback(client, state)
    assert res.headers["location"] == f"{WEB}/login?error=google_auth_failed&detail=invalid_state"

    res = _callback(client, "not-a-state")
    assert "detail=invalid_state" in res.headers["location"]
    assert run_sql("select count(*) as n from core.users")[0]["n"] == 0


def test_callback_google_error(client, monkeypatch, db):
    _fake_google(monkeypatch)
    res = _callback(client, _start(client), code="bad")
    assert res.headers["location"] == f"{WEB}/login?error=google_auth_failed&detail=google_auth_failed"

    res = client.get(
        "/api/v1/auth/google/callback", params={"error": "access_denied", "state": _start(client)}, follow_redirects=False
    )
    assert res.headers["location"].endswith("detail=access_denied")


def test_banned_member_cannot_use_google(client, monkeypatch, member):  # noqa: F811
    run_sql("update core.users set status = 'BANNED'")
    _fake_google(monkeypatch, email=EMAIL)
    res = _callback(client, _start(client))
    assert res.headers["location"].endswith("detail=account_deactivated")


def test_google_member_with_2fa_goes_to_2fa_page(client, monkeypatch, member):  # noqa: F811
    run_sql("update core.users set is_2fa_enabled = true")
    _fake_google(monkeypatch, email=EMAIL)
    res = _callback(client, _start(client))
    assert res.headers["location"] == f"{WEB}/login/2fa"
    assert "2fa_temp_token=" in res.headers["set-cookie"]
    assert "refreshToken=" not in res.headers["set-cookie"]


def test_google_login_not_configured(client, monkeypatch, db):
    monkeypatch.setattr(settings, "google_client_id", "")
    res = client.get("/api/v1/auth/google/login", follow_redirects=False)
    assert res.status_code == 503
    assert res.json()["error_code"] == "google_login_not_configured"
