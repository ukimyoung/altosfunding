import pytest

from tests.conftest import run_sql
from tests.test_login import _login, member  # noqa: F401
from tests.test_signup import EMAIL


@pytest.fixture
def admin(client, member):  # noqa: F811
    run_sql("update core.users set role = 'ADMIN'")
    return {"Authorization": f"Bearer {_login(client, email=EMAIL).json()['access_token']}"}


def _ruleset(client, admin, **extra):
    res = client.post("/api/v1/admin/rulesets", headers=admin, json={"name": "Standard", **extra})
    assert res.status_code == 200, res.text
    return res.json()


def _product(client, admin, **extra):
    body = {"name": "Challenge $10K", "capital": 10000, "price_usdt": 99, "tier_type": "CHALLENGE",
            "mt4_group": "demo\\challenge", "leverage": 100,
            "mt4_login_pool_start": 1000000, "mt4_login_pool_end": 1099999, **extra}
    return client.post("/api/v1/catalog/products", headers=admin, json=body)


def test_ruleset_crud(client, admin):
    rs = _ruleset(client, admin, max_dd_vip_pct=12.5, retry_policy="ONCE")
    assert rs["id"].startswith("RS-")
    assert rs["max_dd_vip_pct"] == 12.5
    assert rs["dd_calc_method"] == "STATIC"
    assert rs["connected_products_count"] == 0

    res = client.patch(f"/api/v1/admin/rulesets/{rs['id']}", headers=admin,
                       json={"daily_loss_limit_pct": 4, "profit_target_pct": 8, "name": None})
    assert res.status_code == 200, res.text
    body = res.json()
    assert (body["daily_loss_limit_pct"], body["profit_target_pct"], body["name"]) == (4, 8, "Standard")

    res = client.patch(f"/api/v1/admin/rulesets/{rs['id']}", headers=admin, json={"dd_calc_method": "WRONG"})
    assert res.status_code == 422

    _product(client, admin, ruleset_id=rs["id"])
    page = client.get("/api/v1/admin/rulesets", headers=admin).json()
    assert page["total"] == 1 and page["items"][0]["connected_products_count"] == 1
    assert client.get("/api/v1/admin/rulesets/nope", headers=admin).status_code == 404


def test_product_create_list_update_status(client, admin):
    rs = _ruleset(client, admin)
    res = _product(client, admin, ruleset_id=rs["id"])
    assert res.status_code == 200, res.text
    p = res.json()
    assert p["product_id"] == "CHALLENGE_10K"
    assert p["ruleset_name"] == "Standard"
    assert p["capital"] == 10000 and p["price_usdt"] == 99

    # 같은 티어·자본금이면 뒤에 번호를 붙인다. 계좌번호 범위는 데모 서버 상품끼리 겹치면 안 된다.
    res = _product(client, admin, name="Challenge $10K B")
    assert res.status_code == 409 and res.json()["error_code"] == "login_pool_overlap"
    res = _product(client, admin, name="Challenge $10K B", mt4_login_pool_start=1100000, mt4_login_pool_end=1199999)
    assert res.json()["product_id"] == "CHALLENGE_10K_2"
    # 펀디드는 실서버라 범위가 겹쳐도 된다.
    funded = _product(client, admin, name="Funded $10K", tier_type="FUNDED").json()
    assert funded["product_id"] == "FUNDED_10K"

    res = client.put("/api/v1/catalog/products/CHALLENGE_10K", headers=admin,
                     json={"price_usdt": 79, "next_product_id": "FUNDED_10K", "margin_call_pct": None, "name": None})
    assert res.status_code == 200, res.text
    assert res.json()["price_usdt"] == 79 and res.json()["next_product_id"] == "FUNDED_10K"
    assert res.json()["name"] == "Challenge $10K"

    res = client.put("/api/v1/catalog/products/CHALLENGE_10K", headers=admin, json={"ruleset_id": "missing"})
    assert res.json()["error_code"] == "ruleset_not_found"

    res = client.patch("/api/v1/catalog/products/CHALLENGE_10K_2/status", headers=admin, json={"is_active": False})
    assert res.json()["is_active"] is False

    # 로그인 없이 목록 조회
    client.cookies.clear()
    page = client.get("/api/v1/catalog/products", params={"tier_type": "CHALLENGE"}).json()
    assert [p["product_id"] for p in page["items"]] == ["CHALLENGE_10K", "CHALLENGE_10K_2"]
    page = client.get("/api/v1/catalog/products", params={"tier_type": "CHALLENGE", "active_only": True}).json()
    assert page["total"] == 1


def test_product_validation_and_permissions(client, admin, member):  # noqa: F811
    res = _product(client, admin, mt4_login_pool_start=200, mt4_login_pool_end=100)
    assert res.json()["error_code"] == "invalid_login_pool"
    res = _product(client, admin, tier_type="GOLD")
    assert res.status_code == 422
    assert client.put("/api/v1/catalog/products/NOPE", headers=admin, json={"price_usdt": 1}).status_code == 404

    run_sql("update core.users set role = 'USER'")
    assert _product(client, admin).status_code == 403
    assert client.post("/api/v1/catalog/products", json={"name": "x", "capital": 1}).status_code == 401


def test_demo_options(client, db):
    res = client.get("/api/v1/demo/options")
    assert res.json() == {
        "allowed_leverages": [100, 200, 500],
        "allowed_capitals": [10000, 50000, 100000],
        "default_leverage": 100,
        "default_capital": 10000,
    }
    run_sql("update core.platform_config set value = '[50, 100]' where scope = 'DEMO' and key = 'allowed_leverages'")
    try:
        assert client.get("/api/v1/demo/options").json()["allowed_leverages"] == [50, 100]
    finally:
        run_sql("update core.platform_config set value = '[100, 200, 500]' where scope = 'DEMO' and key = 'allowed_leverages'")
