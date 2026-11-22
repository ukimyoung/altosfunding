from tests.test_catalog import admin  # noqa: F401
from tests.test_login import member  # noqa: F401

ADMIN = "/api/v1/admin/faq"
PUBLIC = "/api/v1/support/faq"


def _category(client, admin, en="Payment", ko="결제"):  # noqa: F811
    res = client.post(f"{ADMIN}/categories", headers=admin,
                      json={"name": en, "locales": {"en": {"name": en}, "ko": {"name": ko}}})
    assert res.status_code == 201, res.text
    return res.json()


def _faq(client, admin, category_id, question="How do I pay?", ko_question="결제는 어떻게 하나요?", **extra):  # noqa: F811
    body = {
        "category_id": category_id,
        "status": "PUBLISHED",
        "locales": {
            "en": {"question": question, "answer": "Use USDT."},
            "ko": {"question": ko_question, "answer": "USDT로 결제합니다."},
        },
        **extra,
    }
    res = client.post(ADMIN, headers=admin, json=body)
    assert res.status_code == 201, res.text
    return res.json()


def test_category_crud_and_reorder(client, admin):  # noqa: F811
    a = _category(client, admin)
    b = _category(client, admin, "Account", "계정")
    assert a["locales"] == {"en": {"name": "Payment"}, "ko": {"name": "결제"}}
    assert (a["sort_order"], b["sort_order"], a["faq_count"]) == (1, 2, 0)

    dup = client.post(f"{ADMIN}/categories", headers=admin, json={"name": "payment"})
    assert dup.status_code == 409 and dup.json()["error_code"] == "category_exists"
    res = client.post(f"{ADMIN}/categories", headers=admin, json={"locales": {"ko": {"name": "x"}}})
    assert res.status_code == 400 and res.json()["error_code"] == "locales.en_required"

    res = client.put(f"{ADMIN}/categories/{a['id']}", headers=admin,
                     json={"name": "Payments", "locales": {"ko": {"name": ""}}})
    assert res.status_code == 200 and res.json()["locales"] == {"en": {"name": "Payments"}}
    assert client.put(f"{ADMIN}/categories/{a['id']}", headers=admin, json={"name": "Account"}).status_code == 409

    assert client.put(f"{ADMIN}/categories/reorder", headers=admin, json={"ordered_ids": [a["id"]]}).status_code == 400
    assert client.put(f"{ADMIN}/categories/reorder", headers=admin,
                      json={"ordered_ids": [b["id"], a["id"]]}).status_code == 204
    cats = client.get(f"{ADMIN}/categories", headers=admin).json()
    assert [c["id"] for c in cats] == [b["id"], a["id"]]

    _faq(client, admin, a["id"], status="HIDDEN")
    cats = {c["id"]: c for c in client.get(f"{ADMIN}/categories", headers=admin).json()}
    assert cats[a["id"]]["faq_count"] == 1  # 숨김도 센다
    res = client.delete(f"{ADMIN}/categories/{a['id']}", headers=admin)
    assert res.status_code == 409 and res.json()["error_code"] == "category_in_use"
    assert client.delete(f"{ADMIN}/categories/{b['id']}", headers=admin).status_code == 204
    assert client.delete(f"{ADMIN}/categories/{b['id']}", headers=admin).status_code == 404


def test_admin_faq_crud(client, admin):  # noqa: F811
    cat = _category(client, admin)
    other = _category(client, admin, "Account", "계정")
    created = _faq(client, admin, cat["id"])
    assert (created["question"], created["answer"]) == ("How do I pay?", "Use USDT.")
    assert created["category_name"] == "Payment" and created["status"] == "PUBLISHED"
    assert created["author_name"] == "Gil Hong" and created["sort_order"] == 1
    assert created["locales"]["ko"] == {"question": "결제는 어떻게 하나요?", "answer": "USDT로 결제합니다."}

    # question·answer 필드로도 등록할 수 있고, 새 FAQ는 맨 뒤 순서.
    second = client.post(ADMIN, headers=admin, json={"category_id": cat["id"], "question": "Q2", "answer": "A2"})
    assert second.status_code == 201 and second.json()["sort_order"] == 2

    res = client.post(ADMIN, headers=admin, json={"category_id": cat["id"], "locales": {"ko": {"question": "a", "answer": "b"}}})
    assert res.status_code == 400 and res.json()["error_code"] == "locales.en_required"
    assert client.post(ADMIN, headers=admin, json={"category_id": 999, "question": "a", "answer": "b"}).status_code == 404

    # 수정: 번역은 보낸 값으로 바꾼다 (ko를 빼면 지워짐), 카테고리 이동, 숨김.
    res = client.put(f"{ADMIN}/{created['id']}", headers=admin, json={
        "category_id": other["id"], "status": "HIDDEN",
        "locales": {"en": {"question": "Edited?", "answer": "Edited."}},
    })
    assert res.status_code == 200, res.text
    body = res.json()
    assert (body["question"], body["status"], body["category_id"]) == ("Edited?", "HIDDEN", other["id"])
    assert list(body["locales"]) == ["en"]
    assert client.put(f"{ADMIN}/{created['id']}", headers=admin, json={"status": "DRAFT"}).status_code == 422
    # 상태만 바꾸면 질문·답변은 그대로.
    res = client.put(f"{ADMIN}/{created['id']}", headers=admin, json={"status": "PUBLISHED"})
    assert res.json()["question"] == "Edited?"

    page = client.get(ADMIN, headers=admin, params={"category_id": other["id"]}).json()
    assert page["total"] == 1 and page["items"][0]["id"] == created["id"] and page["pages"] == 1
    assert client.get(ADMIN, headers=admin, params={"status": "HIDDEN"}).json()["total"] == 0
    assert client.get(ADMIN, headers=admin, params={"q": "A2"}).json()["total"] == 1
    assert client.get(ADMIN, headers=admin, params={"keyword": "edited"}).json()["total"] == 1
    assert client.get(ADMIN, headers=admin, params={"q": "100%"}).json()["total"] == 0
    assert client.get(ADMIN, headers=admin, params={"size": 1, "page": 2}).json()["items"][0]["question"] == "Q2"

    assert client.delete(f"{ADMIN}/{created['id']}", headers=admin).status_code == 204
    assert client.get(f"{ADMIN}/{created['id']}", headers=admin).status_code == 404


def test_reorder_faqs(client, admin):  # noqa: F811
    cat = _category(client, admin)
    f1 = _faq(client, admin, cat["id"], question="One")
    f2 = _faq(client, admin, cat["id"], question="Two")
    f3 = _faq(client, admin, cat["id"], question="Three", status="HIDDEN")

    res = client.put(f"{ADMIN}/reorder", headers=admin, json={"ordered_ids": [f1["id"], f2["id"]]})
    assert res.status_code == 400 and res.json()["error_code"] == "invalid_reorder"
    assert client.put(f"{ADMIN}/reorder", headers=admin,
                      json={"ordered_ids": [f3["id"], f2["id"], f1["id"]]}).status_code == 204
    assert [i["question"] for i in client.get(ADMIN, headers=admin).json()["items"]] == ["Three", "Two", "One"]


def test_requires_admin(client, member):  # noqa: F811
    from tests.test_login import _login
    from tests.test_signup import EMAIL

    user = {"Authorization": f"Bearer {_login(client, email=EMAIL).json()['access_token']}"}
    assert client.get(ADMIN, headers=user).status_code == 403
    assert client.get(f"{ADMIN}/categories").status_code == 401


def test_public_list_and_locale(client, admin):  # noqa: F811
    cat = _category(client, admin)
    hidden_only = _category(client, admin, "Account", "계정")
    _faq(client, admin, cat["id"], question="First", ko_question="첫 질문")
    _faq(client, admin, cat["id"], question="Second", ko_question="두 번째 질문")
    _faq(client, admin, cat["id"], question="Hidden", status="HIDDEN")
    _faq(client, admin, hidden_only["id"], question="Hidden 2", status="HIDDEN")

    # 로그인 없이 볼 수 있고, 게시중만 나온다.
    res = client.get(PUBLIC)
    assert res.status_code == 200
    items = res.json()
    assert [i["question"] for i in items] == ["First", "Second"]
    assert items[0]["category"] == "Payment" and items[0]["locale"] == "en" and items[0]["answer"] == "Use USDT."

    ko = client.get(PUBLIC, headers={"Accept-Language": "ko-KR,ko;q=0.9"}).json()
    assert [i["question"] for i in ko] == ["첫 질문", "두 번째 질문"]
    assert ko[0]["category"] == "결제" and ko[0]["answer"] == "USDT로 결제합니다."
    # 번역이 없는 언어는 영어로.
    assert client.get(PUBLIC, headers={"Accept-Language": "ja"}).json()[0]["question"] == "First"
    assert [i["question"] for i in client.get(PUBLIC, params={"q": "두 번째"}).json()] == ["Second"]
    assert client.get(PUBLIC, params={"category_id": hidden_only["id"]}).json() == []

    cats = client.get(PUBLIC + "/categories", headers={"Accept-Language": "ko"}).json()
    assert [(c["name"], c["faq_count"], c["locale"]) for c in cats] == [("결제", 2, "ko")]
