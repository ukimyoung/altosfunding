"""MT4 번호 수동 블랙리스트: 등록·해제와 발급 때 제외."""

from tests.conftest import run_sql
from tests.test_admin_users import _create, admin_headers  # noqa: F401
from tests.test_challenge_orders import POOL_START, _join, _work, buyer, fake_mt4, round_  # noqa: F401
from tests.test_login import _login, member  # noqa: F401

URL = "/api/v1/admin/mt4/blacklist"


def _add(client, headers, login_from, login_to=None, server="demo", reason="테스트 차단"):
    return client.post(URL, headers=headers, json={
        "mt4_server": server, "login_from": login_from, "login_to": login_to, "reason": reason,
    })


def test_admin_blacklist_is_skipped_on_issue(client, admin_headers, buyer, round_, fake_mt4):  # noqa: F811
    res = _add(client, admin_headers, POOL_START, POOL_START + 1)
    assert res.status_code == 200, res.text
    assert res.json() == {"added": [POOL_START, POOL_START + 1], "converted": [], "skipped": []}

    order = _join(client, buyer, round_["challenge_id"]).json()
    _work()
    detail = client.get(f"/api/v1/challenges/orders/{order['order_id']}", headers=buyer).json()
    assert detail["status"] == "COMPLETED" and detail["accounts"][0]["mt4_login"] == POOL_START + 2
    assert POOL_START not in fake_mt4.accounts and POOL_START + 1 not in fake_mt4.accounts

    page = client.get("/api/v1/admin/mt4/logins", headers=admin_headers, params={"server": "demo"}).json()
    assert page["counts"]["BLACKLISTED"] == 2 and page["counts"]["IN_USE"] == 1
    admin_rows = [r for r in page["items"] if r["source"] == "ADMIN"]
    assert len(admin_rows) == 2 and admin_rows[0]["created_by_email"]
    assert admin_rows[0]["pool_products"][0]["passed"] is True  # 카운터가 이미 지나감

    # 사용 중인 번호는 건너뛰고, 이미 블랙리스트인 번호도 건너뛴다.
    res = _add(client, admin_headers, POOL_START + 1, POOL_START + 3).json()
    assert res["added"] == [POOL_START + 3]
    assert [(s["mt4_login"], s["status"]) for s in res["skipped"]] == [
        (POOL_START + 1, "BLACKLISTED"), (POOL_START + 2, "IN_USE"),
    ]

    # 다음 발급은 +3도 건너뛴다.
    order = _join(client, buyer, round_["challenge_id"]).json()
    _work()
    detail = client.get(f"/api/v1/challenges/orders/{order['order_id']}", headers=buyer).json()
    assert detail["accounts"][0]["mt4_login"] == POOL_START + 4

    pools = client.get("/api/v1/admin/mt4/login-pools", headers=admin_headers, params={"server": "demo"}).json()
    assert pools[0]["last_mt4_login"] == POOL_START + 4 and pools[0]["next_login"] == POOL_START + 5


def test_release_and_rules(client, admin_headers, buyer, round_, fake_mt4):  # noqa: F811
    assert _add(client, admin_headers, POOL_START + 5).status_code == 200
    # 정리 대상(ORPHANED)은 블랙리스트로 바뀐다.
    run_sql("insert into core.mt4_logins (mt4_server, mt4_login, status, reason) values ('demo', $1, 'ORPHANED', 'x')", POOL_START + 6)
    # 자동 블랙리스트는 해제할 수 없다.
    run_sql("insert into core.mt4_logins (mt4_server, mt4_login, status, reason) values ('demo', $1, 'BLACKLISTED', 'MT4에 이미 있는 번호')", POOL_START + 7)
    res = _add(client, admin_headers, POOL_START + 6).json()
    assert res["converted"] == [POOL_START + 6]

    assert client.delete(f"{URL}/demo/{POOL_START + 7}", headers=admin_headers).json()["error_code"] == "mt4_login_not_releasable"
    assert client.delete(f"{URL}/demo/{POOL_START + 9}", headers=admin_headers).status_code == 404
    assert client.delete(f"{URL}/demo/{POOL_START + 5}", headers=admin_headers).status_code == 204
    assert not run_sql("select 1 from core.mt4_logins where mt4_login = $1", POOL_START + 5)

    # 해제한 번호는 카운터가 아직 오지 않았으므로 다시 발급될 수 있다.
    run_sql("update core.products set last_mt4_login = $1", POOL_START + 4)
    order = _join(client, buyer, round_["challenge_id"]).json()
    _work()
    detail = client.get(f"/api/v1/challenges/orders/{order['order_id']}", headers=buyer).json()
    assert detail["accounts"][0]["mt4_login"] == POOL_START + 5

    # Funded(live) 서버는 따로 관리된다.
    assert _add(client, admin_headers, POOL_START + 5, server="live").json()["added"] == [POOL_START + 5]
    live = client.get("/api/v1/admin/mt4/logins", headers=admin_headers, params={"server": "live"}).json()
    assert live["total"] == 1 and live["items"][0]["mt4_server"] == "live"


def test_validation_and_auth(client, admin_headers, member):  # noqa: F811
    assert _add(client, admin_headers, 10, 5).json()["error_code"] == "invalid_login_range"
    assert _add(client, admin_headers, 1, 2000).json()["error_code"] == "login_range_too_large"
    assert _add(client, admin_headers, 1, reason="").status_code == 422
    assert _add(client, admin_headers, 1, server="xx").status_code == 422
    _create(client, admin_headers, email="plain@example.com")
    headers = {"Authorization": f"Bearer {_login(client, email='plain@example.com', password='Target123!').json()['access_token']}"}
    assert client.get("/api/v1/admin/mt4/logins", headers=headers).status_code in (401, 403)
