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
    assert _submit(client, category="unknown").status_code == 400
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


CATS = f"{ADMIN}/categories"


def test_public_categories_localized(client):
    en = client.get(f"{SUBMIT}/categories").json()
    assert [c["code"] for c in en][:2] == ["billing", "technical"] and en[0]["name"] == "Billing & Payments"
    ko = client.get(f"{SUBMIT}/categories", headers={"Accept-Language": "ko-KR"}).json()
    assert ko[0]["name"] == "결제 및 청구"


def test_category_management(client, admin):  # noqa: F811
    assert client.get(CATS).status_code == 401
    cats = client.get(CATS, headers=admin).json()
    assert len(cats) == 7 and cats[0]["locales"]["ko"]["name"] == "결제 및 청구"

    res = client.post(CATS, headers=admin, json={"locales": {"en": {"name": "Bonus & Promotions"}, "ko": {"name": "보너스"}}})
    assert res.status_code == 201, res.text
    new = res.json()
    assert new["code"] == "bonus_promotions" and new["sort_order"] == 8 and new["contact_count"] == 0

    dup = client.post(CATS, headers=admin, json={"name": "bonus & promotions"})
    assert dup.status_code == 409 and dup.json()["error_code"] == "category_exists"
    assert client.post(CATS, headers=admin, json={"locales": {"ko": {"name": "x"}}}).status_code == 400

    # 새 카테고리로 문의를 남길 수 있고, 없는 카테고리는 막는다.
    assert _submit(client, category="bonus_promotions").status_code == 201
    bad = _submit(client, category="nope")
    assert bad.status_code == 400 and bad.json()["error_code"] == "invalid_category"

    # 이름을 바꿔도 code는 그대로다.
    res = client.put(f"{CATS}/{new['id']}", headers=admin, json={"name": "Promotions", "locales": {"ko": {"name": ""}}})
    assert res.status_code == 200
    assert res.json()["code"] == "bonus_promotions" and res.json()["locales"] == {"en": {"name": "Promotions"}}
    assert res.json()["contact_count"] == 1

    res = client.delete(f"{CATS}/{new['id']}", headers=admin)
    assert res.status_code == 409 and res.json()["error_code"] == "category_in_use"

    ids = [c["id"] for c in client.get(CATS, headers=admin).json()]
    assert client.put(f"{CATS}/reorder", headers=admin, json={"ordered_ids": ids[:2]}).status_code == 400
    assert client.put(f"{CATS}/reorder", headers=admin, json={"ordered_ids": list(reversed(ids))}).status_code == 204
    assert client.get(f"{SUBMIT}/categories").json()[0]["code"] == "bonus_promotions"

    general = next(c for c in client.get(CATS, headers=admin).json() if c["code"] == "general")
    assert client.delete(f"{CATS}/{general['id']}", headers=admin).status_code == 204
