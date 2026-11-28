"""제휴 회원 사전 가입 (백오피스 '회원사전가입') → 첫 로그인 활성화."""

from app.services.partner_account import partner_phone
from tests.conftest import run_sql
from tests.test_admin_users import admin_headers  # noqa: F401
from tests.test_login import PASSWORD, _login, member  # noqa: F401
from tests.test_partner_login import _activate, _complete, _partner, _send_code

URL = "/api/v1/admin/partner-members/pre-register"


def _pre(client, headers, *member_ids):
    res = client.post(URL, json={"member_ids": list(member_ids)}, headers=headers)
    assert res.status_code == 200, res.text
    return res.json()


def _user(member_id: str) -> dict:
    rows = run_sql("select * from core.users where partner_member_id = $1", member_id)
    return rows[0] if rows else {}


def test_phone_with_country_code_and_zero() -> None:
    assert partner_phone("82-010 2456 2800") == "+821024562800"
    assert partner_phone("82-01075860997") == "+821075860997"
    assert partner_phone("+82-010-2696-2493") == "+821026962493"
    assert partner_phone("010-1234-5678") == "+821012345678"
    assert partner_phone("+82 10 4444 5555") == "+82 10 4444 5555"


def test_pre_register_creates_pending_accounts(client, admin_headers, sent_emails):  # noqa: F811
    _partner("ukim", email="Ukim@Example.com".lower())
    _partner("noemail", email=None)
    _partner("gone", status="deleted")
    run_sql("update core.partner_members set phone = '82-010 2456 2800' where member_id = 'ukim'")
    before = len(sent_emails)

    res = _pre(client, admin_headers, "ukim", "UKIM", "noemail", "gone", "nobody")
    assert res["created"] == ["ukim"]
    assert res["created_inactive"] == ["gone"]
    assert {(s["member_id"], s["reason"]) for s in res["skipped"]} == {("noemail", "no_email"), ("nobody", "not_found")}
    assert len(sent_emails) == before  # 환영 메일은 활성화할 때

    u = _user("ukim")
    assert (u["auth_provider"], u["status"], u["password_hash"], u["activated_at"]) == ("PARTNER", "ACTIVE", None, None)
    assert (u["email"], u["first_name"], u["phone"]) == ("ukim@example.com", "HONG GILDONG", "+821024562800")
    assert u["email_verified_at"] is None and u["agreed_to_terms"] is False and u["pre_registered_at"] is not None
    assert len(u["uid"]) == 10 and u["referral_code"]
    assert run_sql("select count(*) n from core.member_relations where member_id = $1", u["id"])[0]["n"] == 1
    assert _user("gone")["status"] == "INACTIVE"

    # 다시 실행하면 건너뛴다
    again = _pre(client, admin_headers, "ukim")
    assert again["created"] == [] and again["skipped"] == [{"member_id": "ukim", "reason": "already_exists"}]

    # 회원 목록: '비활성'(활성화 전) 표시, 제휴사 회원 목록: 계정 상태 필터·요약
    users = client.get("/api/v1/admin/users", params={"keyword": "ukim"}, headers=admin_headers).json()["items"]
    assert [(x["partner_member_id"], x["is_partner_pending"]) for x in users] == [("ukim", True)]
    pending = client.get(
        "/api/v1/admin/partner-members", params={"account": "pending"}, headers=admin_headers
    ).json()["items"]
    assert {m["member_id"] for m in pending} == {"ukim", "gone"}
    assert all(m["activated_at"] is None and m["pre_registered_at"] for m in pending)
    # 멤버십 상태 = 제휴사 membership_active 값 그대로 (_partner 기본값 false)
    assert all(m["membership_active_partner"] is False for m in pending)
    none = client.get("/api/v1/admin/partner-members", params={"account": "none"}, headers=admin_headers).json()
    assert [m["member_id"] for m in none["items"]] == ["noemail"]
    summary = client.get("/api/v1/admin/partner-members/summary", headers=admin_headers).json()
    assert (summary["linked"], summary["pending"]) == (2, 2)


def test_pending_account_activates_in_place(client, admin_headers, sent_emails):  # noqa: F811
    _partner("ukim")
    _pre(client, admin_headers, "ukim")
    before = _user("ukim")

    # 비밀번호가 없으니 로그인은 활성화 단계로 안내, 비밀번호 찾기는 메일을 보내지 않는다
    res = _login(client, email="ukim", password="anything")
    assert (res.status_code, res.json()["error_code"]) == (409, "partner_activation_required")
    n = len(sent_emails)
    assert client.post("/api/v1/auth/password/forgot", json={"email": "ukim", "recaptcha_token": "t"}).status_code < 300
    assert len(sent_emails) == n

    body = _activate(client, sent_emails, "ukim")
    after = _user("ukim")
    assert (after["id"], after["uid"], after["referral_code"]) == (before["id"], before["uid"], before["referral_code"])
    assert after["activated_at"] is not None and after["password_hash"] and after["email_verified_at"]
    assert after["agreed_to_terms"] is True
    assert body["access_token"]
    assert run_sql("select count(*) n from core.users where partner_member_id = 'ukim'")[0]["n"] == 1

    assert _login(client, email="ukim").status_code == 200
    assert _send_code(client, "ukim").json()["error_code"] == "partner_already_activated"
    users = client.get("/api/v1/admin/users", params={"keyword": "ukim"}, headers=admin_headers).json()["items"]
    assert users[0]["is_partner_pending"] is False


def test_blocked_pending_account_cannot_activate(client, admin_headers, sent_emails):  # noqa: F811
    _partner("gone", status="deleted")
    _partner("banned")
    _pre(client, admin_headers, "gone", "banned")
    run_sql("update core.users set status = 'BANNED' where partner_member_id = 'banned'")
    for member_id in ("gone", "banned"):
        res = _login(client, email=member_id)
        assert (res.status_code, res.json()["error_code"]) == (409, "account_deactivated"), member_id
        assert _send_code(client, member_id).json()["error_code"] == "account_deactivated"
    assert _complete(client, "banned", "123456").json()["error_code"] == "account_deactivated"


def test_partner_can_change_password(client, sent_emails):
    _partner("ukim")
    _activate(client, sent_emails, "ukim")
    token = _login(client, email="ukim").json()["access_token"]
    res = client.put(
        "/api/v1/auth/password",
        json={"old_password": PASSWORD, "new_password": "NewPassw0rd!"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200, res.text
    assert _login(client, email="ukim", password="NewPassw0rd!").status_code == 200
