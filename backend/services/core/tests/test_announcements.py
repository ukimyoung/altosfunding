import pytest

from tests.test_catalog import admin  # noqa: F401
from tests.test_login import member  # noqa: F401

ADMIN = "/api/v1/admin/announcements"
PUBLIC = "/api/v1/announcements"


def _category(client, admin, en="Maintenance", ko="점검"):  # noqa: F811
    res = client.post(f"{ADMIN}/categories", headers=admin,
                      json={"name": en, "locales": {"en": {"name": en}, "ko": {"name": ko}}})
    assert res.status_code == 201, res.text
    return res.json()


def _notice(client, admin, category_id, title="Server maintenance", ko_title="서버 점검", **extra):  # noqa: F811
    body = {
        "category_id": category_id,
        "status": "PUBLISHED",
        "is_pinned": False,
        "locales": {
            "en": {"title": title, "content": "<p>English body</p>"},
            "ko": {"title": ko_title, "content": "<p>한국어 본문</p>"},
        },
        **extra,
    }
    res = client.post(ADMIN, headers=admin, json=body)
    assert res.status_code == 201, res.text
    return res.json()


def test_category_crud_and_reorder(client, admin):  # noqa: F811
    a = _category(client, admin)
    b = _category(client, admin, "Update", "업데이트")
    assert a["locales"] == {"en": {"name": "Maintenance"}, "ko": {"name": "점검"}}
    assert (a["sort_order"], b["sort_order"]) == (1, 2)

    dup = client.post(f"{ADMIN}/categories", headers=admin, json={"name": "maintenance"})
    assert dup.status_code == 409 and dup.json()["error_code"] == "category_exists"
    assert client.post(f"{ADMIN}/categories", headers=admin, json={"locales": {"ko": {"name": "x"}}}).status_code == 400

    res = client.put(f"{ADMIN}/categories/{a['id']}", headers=admin,
                     json={"name": "Maintenance", "locales": {"ko": {"name": ""}}})
    assert res.status_code == 200 and res.json()["locales"] == {"en": {"name": "Maintenance"}}

    assert client.put(f"{ADMIN}/categories/reorder", headers=admin, json={"ordered_ids": [a["id"]]}).status_code == 400
    assert client.put(f"{ADMIN}/categories/reorder", headers=admin,
                      json={"ordered_ids": [b["id"], a["id"]]}).status_code == 204
    cats = client.get(f"{ADMIN}/categories", headers=admin).json()
    assert [c["id"] for c in cats] == [b["id"], a["id"]]

    _notice(client, admin, a["id"])
    res = client.delete(f"{ADMIN}/categories/{a['id']}", headers=admin)
    assert res.status_code == 409 and res.json()["error_code"] == "category_in_use"
    assert client.delete(f"{ADMIN}/categories/{b['id']}", headers=admin).status_code == 204


def test_admin_announcement_crud(client, admin):  # noqa: F811
    cat = _category(client, admin)
    other = _category(client, admin, "Update", "업데이트")
    created = _notice(client, admin, cat["id"], content=None)
    assert created["title"] == "Server maintenance"
    assert created["category_name"] == "Maintenance"
    assert created["author_name"] == "Gil Hong"
    assert created["locales"]["ko"] == {"title": "서버 점검", "content": "<p>한국어 본문</p>"}
    assert created["sort_order"] == 1

    # 영문 제목·본문은 필수, 본문의 script는 지운다.
    res = client.post(ADMIN, headers=admin, json={"category_id": cat["id"], "locales": {"ko": {"title": "a", "content": "b"}}})
    assert res.status_code == 400 and res.json()["error_code"] == "locales.en_required"
    res = client.post(ADMIN, headers=admin, json={"category_id": cat["id"], "title": "XSS",
                                                  "content": "<p onclick='x()'>hi</p><script>alert(1)</script>"})
    assert res.status_code == 201 and res.json()["content"] == "<p>hi</p>"
    assert client.post(ADMIN, headers=admin, json={"category_id": 999, "title": "a", "content": "b"}).status_code == 404

    # 수정: 번역은 보낸 값으로 바꾼다 (ko를 빼면 지워짐), 카테고리 이동.
    res = client.put(f"{ADMIN}/{created['id']}", headers=admin, json={
        "category_id": other["id"], "status": "CLOSED", "is_pinned": True,
        "locales": {"en": {"title": "Edited", "content": "<p>Edited body</p>"}},
    })
    assert res.status_code == 200, res.text
    body = res.json()
    assert (body["title"], body["status"], body["is_pinned"], body["category_id"]) == ("Edited", "CLOSED", True, other["id"])
    assert list(body["locales"]) == ["en"]
    assert client.put(f"{ADMIN}/{created['id']}", headers=admin, json={"status": "DRAFT"}).status_code == 422

    page = client.get(ADMIN, headers=admin, params={"status": "CLOSED"}).json()
    assert page["total"] == 1 and page["items"][0]["id"] == created["id"]
    assert client.get(ADMIN, headers=admin, params={"keyword": "XSS"}).json()["total"] == 1
    assert client.get(ADMIN, headers=admin, params={"q": "100%"}).json()["total"] == 0

    assert client.delete(f"{ADMIN}/{created['id']}", headers=admin).status_code == 204
    assert client.get(f"{ADMIN}/{created['id']}", headers=admin).status_code == 404


def test_reorder_announcements(client, admin):  # noqa: F811
    cat = _category(client, admin)
    n1 = _notice(client, admin, cat["id"], title="One")
    n2 = _notice(client, admin, cat["id"], title="Two")
    pinned = _notice(client, admin, cat["id"], title="Pinned", is_pinned=True)

    res = client.put(f"{ADMIN}/reorder", headers=admin, json={"ordered_ids": [n1["id"], pinned["id"], n2["id"]], "scope": "global"})
    assert res.status_code == 400 and res.json()["error_code"] == "pinned_not_reorderable"
    res = client.put(f"{ADMIN}/reorder", headers=admin, json={"ordered_ids": [n1["id"]], "scope": "global"})
    assert res.status_code == 400 and res.json()["error_code"] == "invalid_reorder"
    assert client.put(f"{ADMIN}/reorder", headers=admin,
                      json={"ordered_ids": [n2["id"], n1["id"]], "scope": "global"}).status_code == 204

    titles = [i["title"] for i in client.get(ADMIN, headers=admin).json()["items"]]
    assert titles == ["Pinned", "Two", "One"]

    assert client.put(f"{ADMIN}/reorder", headers=admin,
                      json={"ordered_ids": [n1["id"], n2["id"]], "scope": "category", "category_id": cat["id"]}).status_code == 204
    titles = [i["title"] for i in client.get(ADMIN, headers=admin, params={"category_id": cat["id"]}).json()["items"]]
    assert titles == ["Pinned", "One", "Two"]


def test_requires_admin(client, member):  # noqa: F811
    from tests.test_login import _login
    from tests.test_signup import EMAIL

    user = {"Authorization": f"Bearer {_login(client, email=EMAIL).json()['access_token']}"}
    assert client.get(ADMIN, headers=user).status_code == 403
    assert client.get(ADMIN).status_code == 401


def test_public_list_detail_and_locale(client, admin):  # noqa: F811
    cat = _category(client, admin)
    empty = _category(client, admin, "Policy", "정책")
    first = _notice(client, admin, cat["id"], title="First", ko_title="첫 공지")
    second = _notice(client, admin, cat["id"], title="Second", ko_title="두 번째 공지")
    closed = _notice(client, admin, cat["id"], title="Closed", status="CLOSED")
    _notice(client, admin, empty["id"], title="Hidden", status="CLOSED")

    # 로그인 없이 볼 수 있고, 게시중만 나온다.
    res = client.get(PUBLIC)
    assert res.status_code == 200
    page = res.json()
    assert page["total"] == 2 and [i["title"] for i in page["items"]] == ["First", "Second"]
    assert page["items"][0]["category"] == "Maintenance" and page["items"][0]["locale"] == "en"

    ko = client.get(PUBLIC, headers={"Accept-Language": "ko-KR,ko;q=0.9"}).json()
    assert [i["title"] for i in ko["items"]] == ["첫 공지", "두 번째 공지"]
    assert ko["items"][0]["category"] == "점검" and ko["items"][0]["content"] == "<p>한국어 본문</p>"
    assert client.get(PUBLIC, params={"keyword": "두 번째"}).json()["total"] == 1

    cats = client.get(PUBLIC + "/categories", headers={"Accept-Language": "ko"}).json()
    assert [(c["name"], c["announcement_count"]) for c in cats] == [("점검", 2)]

    detail = client.get(f"{PUBLIC}/{first['id']}", headers={"Accept-Language": "ko"}).json()
    assert detail["title"] == "첫 공지"
    assert (detail["previous_id"], detail["next_id"], detail["next_title"]) == (None, second["id"], "두 번째 공지")
    detail = client.get(f"{PUBLIC}/{second['id']}").json()
    assert (detail["previous_id"], detail["previous_title"], detail["next_id"]) == (first["id"], "First", None)

    assert client.get(f"{PUBLIC}/{closed['id']}").status_code == 404


@pytest.mark.parametrize("header,expected", [(None, "en"), ("ko", "ko"), ("ko-KR,ko;q=0.9", "ko"), ("*", "en")])
def test_request_locale(header, expected):
    from app.services.announcement import request_locale

    assert request_locale(header) == expected
