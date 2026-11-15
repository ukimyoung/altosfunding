from tests.conftest import run_sql
from tests.test_catalog import admin  # noqa: F401
from tests.test_login import _login, member  # noqa: F401

SUBMIT = "/api/v1/support/contact"
ADMIN = "/api/v1/admin/contacts"


def _submit(client, headers=None, **extra):
    body = {
        "name": "Jane Trader",
        "email": "jane@example.com",
        "category": "billing",
        "subject": "Payment not reflected",
        "message": "I paid but my challenge is not active.",
        "recaptcha_token": "token",
        **extra,
    }
    return client.post(SUBMIT, json=body, headers=headers or {})


def test_submit_without_login(client, sent_emails):
    res = _submit(client, headers={"Accept-Language": "ko-KR,ko;q=0.9"})
    assert res.status_code == 201, res.text
    assert res.json()["message_key"] == "support.message_received"
    row = run_sql("select user_id, status, locale from core.contact_messages where id = $1", res.json()["id"])[0]
    assert row["user_id"] is None and row["status"] == "RECEIVED" and row["locale"] == "ko"
    assert sent_emails[-1]["purpose"] == "CONTACT_RECEIVED"

    # 잘못된 토큰은 비로그인으로 취급한다.
    assert _submit(client, headers={"Authorization": "Bearer nope"}).status_code == 201
    assert _submit(client, category="unknown").status_code == 422
    assert _submit(client, message="x" * 1001).status_code == 422


def test_submit_logged_in_links_user(client, member):  # noqa: F811
    headers = {"Authorization": f"Bearer {_login(client).json()['access_token']}"}
    res = _submit(client, headers=headers)
    assert res.status_code == 201
    row = run_sql("select user_id from core.contact_messages where id = $1", res.json()["id"])[0]
    assert row["user_id"] is not None


def test_admin_flow(client, admin, sent_emails):  # noqa: F811
    a = _submit(client).json()["id"]
    b = _submit(client, name="Kim", subject="MT4 login", category="technical").json()["id"]

    assert client.get(ADMIN).status_code == 401

    res = client.get(ADMIN, headers=admin).json()
    assert [i["id"] for i in res["items"]] == [b, a]
    assert res["total"] == 2 and res["pages"] == 1 and res["unanswered_count"] == 2

    assert client.get(ADMIN, headers=admin, params={"q": "mt4"}).json()["total"] == 1
    assert client.get(ADMIN, headers=admin, params={"q": "jane@example"}).json()["total"] == 0  # 이메일 제외
    assert client.get(ADMIN, headers=admin, params={"category": "billing"}).json()["items"][0]["id"] == a

    detail = client.get(f"{ADMIN}/{a}", headers=admin).json()
    assert detail["status"] == "RECEIVED" and detail["message"].startswith("I paid")

    res = client.patch(f"{ADMIN}/{a}/draft", headers=admin, json={"reply_draft": "Checking..."})
    assert res.status_code == 200 and res.json()["status"] == "PROCESSING"
    assert res.json()["reply_draft"] == "Checking..."

    assert client.post(f"{ADMIN}/{a}/reply", headers=admin, json={"reply_body": "   "}).status_code == 400
    res = client.post(f"{ADMIN}/{a}/reply", headers=admin, json={"reply_body": "Your challenge is active now."})
    assert res.status_code == 200, res.text
    out = res.json()
    assert out["status"] == "ANSWERED" and out["reply_draft"] is None and out["replied_at"]
    assert out["replied_by"] and out["replied_by_name"]
    assert sent_emails[-1]["purpose"] == "CONTACT_REPLIED" and sent_emails[-1]["email"] == "jane@example.com"

    again = client.post(f"{ADMIN}/{a}/reply", headers=admin, json={"reply_body": "again"})
    assert again.status_code == 409 and again.json()["error_code"] == "contact_already_answered"
    assert client.patch(f"{ADMIN}/{a}/draft", headers=admin, json={"reply_draft": "x"}).status_code == 409

    res = client.get(ADMIN, headers=admin, params={"status": "ANSWERED"}).json()
    assert res["total"] == 1 and res["unanswered_count"] == 1
    assert client.get(f"{ADMIN}/999999", headers=admin).status_code == 404
