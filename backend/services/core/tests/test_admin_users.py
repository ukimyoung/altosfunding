import pytest

from tests.conftest import run_sql
from tests.test_login import PASSWORD, _login, member  # noqa: F401

ADMIN_EMAIL = "admin@example.com"


@pytest.fixture
def admin_headers(client, member):  # noqa: F811
    # 회원 한 명을 관리자로 바꿔 두고, 다른 회원을 관리 대상으로 쓴다.
    run_sql("update core.users set role = 'ADMIN', email = $1", ADMIN_EMAIL)
    token = _login(client, email=ADMIN_EMAIL).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _create(client, headers, email="target@example.com", **extra):
    body = {"email": email, "password": "Target123!", "first_name": "Tar", "grade": "NORMAL",
            "status": "ACTIVE", "kyc_status": "NONE", "role": "USER", **extra}
    res = client.post("/api/v1/admin/users", headers=headers, json=body)
    assert res.status_code == 200, res.text
    return res.json()


def test_non_admin_is_forbidden(client, member):  # noqa: F811
    token = _login(client).json()["access_token"]
    res = client.get("/api/v1/admin/users", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 403


def test_create_list_detail_and_summary(client, admin_headers):
    created = _create(client, admin_headers, grade="VIP", kyc_status="APPROVED", admin_note="memo")
    assert created["email_verified"] is True
    assert created["admin_note"] == "memo"
    assert created["kyc_approved_at"]

    res = client.post("/api/v1/admin/users", headers=admin_headers,
                      json={"email": "TARGET@example.com", "password": "Target123!"})
    assert res.json()["error_code"] == "email_already_exists"

    res = client.get("/api/v1/admin/users", headers=admin_headers, params={"keyword": "target", "grade": "VIP"})
    body = res.json()
    assert body["total"] == 1 and body["pages"] == 1
    assert body["items"][0]["id"] == created["id"]

    assert client.get(f"/api/v1/admin/users/{created['id']}", headers=admin_headers).json()["email"] == "target@example.com"
    assert client.get("/api/v1/admin/users/00000000-0000-0000-0000-000000000000", headers=admin_headers).status_code == 404

    summary = client.get("/api/v1/admin/users/summary", headers=admin_headers).json()
    assert summary["total_users"] == 1  # 관리자는 세지 않는다
    assert summary["vip_users"] == 1
    assert summary["kyc"]["approved"] == 1

    # 새로 만든 회원은 바로 로그인할 수 있다.
    assert _login(client, email="target@example.com", password="Target123!").status_code == 200


def test_suspend_ban_activate_and_history(client, admin_headers):
    target = _create(client, admin_headers)
    login = _login(client, email="target@example.com", password="Target123!")
    target_token = login.json()["access_token"]
    target_refresh = login.cookies.get("refreshToken")

    res = client.post(f"/api/v1/admin/users/{target['id']}/suspend", headers=admin_headers, json={"reason": "check"})
    assert res.json()["status"] == "INACTIVE"
    # 이미 받은 access token도 바로 막히고, refresh token도 폐기된다.
    assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {target_token}"}).status_code == 403
    client.cookies.clear()
    client.cookies.set("refreshToken", target_refresh, path="/api/v1/auth")
    assert client.post("/api/v1/auth/refresh").status_code != 200
    assert _login(client, email="target@example.com", password="Target123!").status_code == 409

    res = client.post(f"/api/v1/admin/users/{target['id']}/ban", headers=admin_headers, json={"reason": "fraud", "admin_note": "n"})
    assert res.json()["status"] == "BANNED"
    res = client.post(f"/api/v1/admin/users/{target['id']}/activate", headers=admin_headers)
    assert res.json()["status"] == "ACTIVE"
    assert _login(client, email="target@example.com", password="Target123!").status_code == 200

    history = client.get(f"/api/v1/admin/users/{target['id']}/status-history", headers=admin_headers).json()
    assert [(h["from_status"], h["to_status"]) for h in history["items"]] == [
        ("BANNED", "ACTIVE"), ("INACTIVE", "BANNED"), ("ACTIVE", "INACTIVE"),
    ]
    assert history["items"][2]["reason"] == "check"


def test_admin_cannot_be_blocked(client, admin_headers):
    admin_id = client.get("/api/v1/auth/me", headers=admin_headers).json()["id"]
    res = client.post(f"/api/v1/admin/users/{admin_id}/ban", headers=admin_headers, json={"reason": "x"})
    assert res.json()["error_code"] == "cannot_block_admin"


def test_update_profile_and_reset_password(client, admin_headers):
    target = _create(client, admin_headers)
    res = client.patch(f"/api/v1/admin/users/{target['id']}/profile", headers=admin_headers,
                       json={"phone": "010", "grade": "VIP", "kyc_status": "REJECTED", "status": "INACTIVE"})
    assert res.status_code == 200, res.text
    body = res.json()
    assert (body["phone"], body["grade"], body["kyc_status"], body["status"]) == ("010", "VIP", "REJECTED", "INACTIVE")

    res = client.patch(f"/api/v1/admin/users/{target['id']}/profile", headers=admin_headers, json={"status": "WITHDRAWN"})
    assert res.status_code == 422

    client.post(f"/api/v1/admin/users/{target['id']}/activate", headers=admin_headers)
    res = client.post(f"/api/v1/admin/users/{target['id']}/reset-password", headers=admin_headers,
                      json={"new_password": "Changed123!"})
    assert res.json() == {"ok": True}
    assert _login(client, email="target@example.com", password="Changed123!").status_code == 200


def test_admin_withdraw_user(client, admin_headers):
    target = _create(client, admin_headers)
    res = client.post(f"/api/v1/admin/users/{target['id']}/withdraw", headers=admin_headers)
    assert res.json()["status"] == "WITHDRAWN"
    assert client.get("/api/v1/admin/users", headers=admin_headers).json()["total"] == 1
    assert client.get("/api/v1/admin/users", headers=admin_headers, params={"status": "WITHDRAWN"}).json()["total"] == 1
    assert client.post(f"/api/v1/admin/users/{target['id']}/withdraw", headers=admin_headers).status_code == 409


def test_self_withdraw(client, member, sent_emails):  # noqa: F811
    res = _login(client)
    headers = {"Authorization": f"Bearer {res.json()['access_token']}"}
    res = client.post("/api/v1/auth/account/withdraw", headers=headers)
    assert res.status_code == 200, res.text
    assert res.json()["message_key"] == "auth.account_withdrawn"

    row = run_sql("select email, status, password_hash, phone, withdrawn_at from core.users")[0]
    assert row["status"] == "WITHDRAWN"
    assert row["email"].endswith("@deleted.local")
    assert row["password_hash"] is None and row["withdrawn_at"] is not None

    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401
    assert client.post("/api/v1/auth/refresh").status_code != 200
    assert _login(client).status_code == 404


def test_me_hides_admin_note(client, member):  # noqa: F811
    run_sql("update core.users set admin_note = 'secret'")
    token = _login(client).json()["access_token"]
    assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).json()["admin_note"] is None
