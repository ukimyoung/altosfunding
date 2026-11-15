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

    # 거래 활동 조건: 최대 거래 계약수·일관성, 미활동 일수는 30일 이하
    assert rs["max_mini_contracts"] is None and rs["max_micro_contracts"] is None and rs["consistency_pct"] is None
    res = client.patch(f"/api/v1/admin/rulesets/{rs['id']}", headers=admin,
                       json={"max_mini_contracts": 3, "max_micro_contracts": 10, "consistency_pct": 40})
    assert (res.json()["max_mini_contracts"], res.json()["max_micro_contracts"], res.json()["consistency_pct"]) == (3, 10, 40)
    res = client.patch(f"/api/v1/admin/rulesets/{rs['id']}", headers=admin, json={"max_mini_contracts": None})
    assert res.json()["max_mini_contracts"] is None and res.json()["max_micro_contracts"] == 10
    assert client.patch(f"/api/v1/admin/rulesets/{rs['id']}", headers=admin,
                        json={"inactivity_days": 31}).status_code == 422
    assert client.patch(f"/api/v1/admin/rulesets/{rs['id']}", headers=admin,
                        json={"max_micro_contracts": 0}).status_code == 422

    _product(client, admin, ruleset_id=rs["id"])
    page = client.get("/api/v1/admin/rulesets", headers=admin).json()
    assert page["total"] == 1 and page["items"][0]["connected_products_count"] == 1
    assert client.get("/api/v1/admin/rulesets/nope", headers=admin).status_code == 404


def test_product_create_list_update_status(client, admin):
    rs = _ruleset(client, admin)
    res = _product(client, admin, ruleset_id=rs["id"])
    assert res.status_code == 200, res.text
    p = res.json()
    assert p["product_id"] == "1001"
    assert p["ruleset_name"] == "Standard"
    assert p["capital"] == 10000 and p["price_usdt"] == 99

    # 상품코드는 티어 1자리 + 일련번호 3자리. 계좌번호 범위는 데모 서버 상품끼리 겹치면 안 된다.
    res = _product(client, admin, name="Challenge $10K B")
    assert res.status_code == 409 and res.json()["error_code"] == "login_pool_overlap"
    res = _product(client, admin, name="Challenge $10K B", mt4_login_pool_start=1100000, mt4_login_pool_end=1199999)
    assert res.json()["product_id"] == "1002"
    # 펀디드는 실서버라 범위가 겹쳐도 된다.
    funded = _product(client, admin, name="Funded $10K", tier_type="FUNDED").json()
    assert funded["product_id"] == "2001"

    res = client.put("/api/v1/catalog/products/1001", headers=admin,
                     json={"price_usdt": 79, "next_product_id": "2001", "margin_call_pct": None, "name": None})
    assert res.status_code == 200, res.text
    assert res.json()["price_usdt"] == 79 and res.json()["next_product_id"] == "2001"
    assert res.json()["name"] == "Challenge $10K"
    assert res.json()["discount_price_usdt"] is None

    # 할인가격: 원가격 이하만 허용, null로 보내면 할인 해제
    res = client.put("/api/v1/catalog/products/1001", headers=admin, json={"discount_price_usdt": 59})
    assert res.status_code == 200 and res.json()["discount_price_usdt"] == 59
    res = client.put("/api/v1/catalog/products/1001", headers=admin, json={"discount_price_usdt": 80})
    assert res.json()["error_code"] == "invalid_discount_price"
    res = client.put("/api/v1/catalog/products/1001", headers=admin, json={"price_usdt": 50})
    assert res.json()["error_code"] == "invalid_discount_price"
    res = client.put("/api/v1/catalog/products/1001", headers=admin, json={"discount_price_usdt": None})
    assert res.status_code == 200 and res.json()["discount_price_usdt"] is None

    # 상품코드 앞자리가 티어라 티어는 바꿀 수 없다. 추천 여부는 바꿀 수 있다.
    res = client.put("/api/v1/catalog/products/1001", headers=admin, json={"tier_type": "FUNDED"})
    assert res.json()["error_code"] == "tier_type_immutable"
    res = client.put("/api/v1/catalog/products/1001", headers=admin, json={"is_recommended": True})
    assert res.status_code == 200 and res.json()["is_recommended"] is True

    res = client.put("/api/v1/catalog/products/1001", headers=admin, json={"ruleset_id": "missing"})
    assert res.json()["error_code"] == "ruleset_not_found"

    res = client.patch("/api/v1/catalog/products/1002/status", headers=admin, json={"is_active": False})
    assert res.json()["is_active"] is False

    # 로그인 없이 목록 조회
    client.cookies.clear()
    page = client.get("/api/v1/catalog/products", params={"tier_type": "CHALLENGE"}).json()
    assert [p["product_id"] for p in page["items"]] == ["1001", "1002"]
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


def _restore_demo_config():
    run_sql("""
        update core.platform_config set value = case key
          when 'allowed_leverages' then '[100, 200, 500]'::jsonb
          when 'allowed_capitals' then '[10000, 50000, 100000]'::jsonb
          when 'default_leverage' then '100'::jsonb
          when 'default_capital' then '10000'::jsonb
        end
        where scope = 'DEMO'
    """)


def test_admin_platform_config_demo(client, admin):
    try:
        items = client.get("/api/v1/admin/platform-config/DEMO", headers=admin).json()
        assert {i["key"]: i["value"] for i in items} == {
            "allowed_capitals": [10000, 50000, 100000],
            "allowed_leverages": [100, 200, 500],
            "default_capital": 10000,
            "default_leverage": 100,
        }
        assert {i["key"]: i["value_type"] for i in items}["allowed_leverages"] == "JSON"

        res = client.put("/api/v1/admin/platform-config/DEMO/allowed_leverages", headers=admin,
                         json={"value": [50, 100, 300], "value_type": "JSON"})
        assert res.status_code == 200, res.text
        assert res.json()["value"] == [50, 100, 300]
        # 기존 서버 클라이언트처럼 문자열로 보내도 받는다.
        res = client.put("/api/v1/admin/platform-config/DEMO/default_leverage", headers=admin,
                         json={"value": "300", "value_type": "INTEGER"})
        assert res.status_code == 200 and res.json()["value"] == 300
        res = client.put("/api/v1/admin/platform-config/DEMO/allowed_capitals", headers=admin,
                         json={"value": [5000, 25000.5], "value_type": "JSON"})
        assert res.status_code == 200 and res.json()["value"] == [5000, 25000.5]

        # 기본값(10000)이 목록에서 빠졌으면 첫 값을 기본값으로 내려준다.
        assert client.get("/api/v1/demo/options").json() == {
            "allowed_leverages": [50, 100, 300],
            "allowed_capitals": [5000, 25000.5],
            "default_leverage": 300,
            "default_capital": 5000,
        }

        bad = [
            ("allowed_leverages", {"value": [], "value_type": "JSON"}),
            ("allowed_leverages", {"value": [100, 100], "value_type": "JSON"}),
            ("allowed_leverages", {"value": [100.5], "value_type": "JSON"}),
            ("allowed_leverages", {"value": [0, 100], "value_type": "JSON"}),
            ("allowed_capitals", {"value": ["abc"], "value_type": "JSON"}),
            ("allowed_capitals", {"value": "[1,", "value_type": "JSON"}),
            ("default_capital", {"value": -1, "value_type": "INTEGER"}),
            ("default_leverage", {"value": True, "value_type": "BOOLEAN"}),
            ("unknown_key", {"value": 1, "value_type": "INTEGER"}),
        ]
        for key, body in bad:
            res = client.put(f"/api/v1/admin/platform-config/DEMO/{key}", headers=admin, json=body)
            assert res.status_code == 422, (key, body, res.text)
        assert client.put("/api/v1/admin/platform-config/NOPE/x", headers=admin,
                          json={"value": 1}).status_code == 422
    finally:
        _restore_demo_config()


def test_admin_platform_config_requires_admin(client, member):  # noqa: F811
    assert client.get("/api/v1/admin/platform-config/DEMO").status_code == 401
    token = _login(client, email=EMAIL).json()["access_token"]
    res = client.put("/api/v1/admin/platform-config/DEMO/default_leverage",
                     headers={"Authorization": f"Bearer {token}"}, json={"value": 200, "value_type": "INTEGER"})
    assert res.status_code == 403


def test_product_code_migration(client, admin):
    """예전 'CHALLENGE_10K' 형식 ID를 4자리 상품코드로 바꾸는 마이그레이션을 검증한다."""
    from pathlib import Path

    from tests.conftest import MIGRATIONS_DIR

    sql = (Path(MIGRATIONS_DIR) / "20261116000000_core_product_numeric_code.sql").read_text()
    run_sql("alter table core.products drop constraint products_id_code_check")
    run_sql("""insert into core.products (id, name, capital, tier_type, mt4_login_pool_start, mt4_login_pool_end, created_at)
               values ('CHALLENGE_10K', 'A', 10000, 'CHALLENGE', 1, 10, now() - interval '2 day'),
                      ('CHALLENGE_10K_2', 'B', 10000, 'CHALLENGE', 11, 20, now() - interval '1 day'),
                      ('FUNDED_10K', 'C', 10000, 'FUNDED', 1, 10, now())""")
    run_sql("update core.products set next_product_id = 'FUNDED_10K' where id = 'CHALLENGE_10K'")
    run_sql("""insert into core.challenge_schedules (name_template, product_id, interval_days, duration_days)
               values ('Daily', 'CHALLENGE_10K_2', 1, 1)""")
    import asyncio

    import asyncpg

    from tests.conftest import TEST_DATABASE_URL, _asyncpg_dsn

    async def _apply():
        conn = await asyncpg.connect(_asyncpg_dsn(TEST_DATABASE_URL))
        try:
            await conn.execute(sql[sql.index("create temporary table"):])
        finally:
            await conn.close()

    # FK를 다시 거는 앞부분은 이미 적용되어 있으므로 코드 변환 부분부터 실행한다.
    asyncio.run(_apply())

    rows = run_sql("select name, id, next_product_id from core.products order by id")
    assert [(r["name"], r["id"], r["next_product_id"]) for r in rows] == [
        ("A", "1001", "2001"), ("B", "1002", None), ("C", "2001", None)]
    assert run_sql("select product_id from core.challenge_schedules")[0]["product_id"] == "1002"


def test_funded_related_challenge(client, admin):
    challenge = _product(client, admin).json()["product_id"]
    other = _product(client, admin, name="C2", mt4_login_pool_start=1100000, mt4_login_pool_end=1199999).json()
    body = {"tier_type": "FUNDED", "name": "Funded", "mt4_login_pool_start": 2000000, "mt4_login_pool_end": 2099999}
    res = _product(client, admin, related_id=challenge, **body)
    assert res.status_code == 200, res.text
    funded = res.json()
    assert funded["related_id"] == challenge

    # 챌린지 상품 하나에는 펀디드 상품 하나만
    body2 = {**body, "name": "Funded 2", "mt4_login_pool_start": 2100000, "mt4_login_pool_end": 2199999}
    res = _product(client, admin, related_id=challenge, **body2)
    assert res.status_code == 409 and res.json()["error_code"] == "related_product_taken"
    # 챌린지 상품이 아니면 안 된다 / 챌린지 상품에는 지정할 수 없다
    assert _product(client, admin, related_id=funded["product_id"], **body2).status_code == 400
    assert _product(client, admin, related_id=challenge, name="C3", mt4_login_pool_start=1200000,
                    mt4_login_pool_end=1299999).status_code == 400
    assert _product(client, admin, related_id="1999", **body2).status_code == 400

    url = f"/api/v1/catalog/products/{funded['product_id']}"
    res = client.put(url, headers=admin, json={"related_id": other["product_id"]})
    assert res.status_code == 200 and res.json()["related_id"] == other["product_id"]
    res = client.put(url, headers=admin, json={"related_id": None})
    assert res.status_code == 200 and res.json()["related_id"] is None
