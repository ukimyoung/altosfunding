"""관리자 트레이딩 계좌 조회 (트레이더 관리 > 챌린지·데모 계좌관리)."""

from tests.conftest import run_sql
from tests.test_admin_users import admin_headers  # noqa: F401
from tests.test_challenge_orders import (  # noqa: F401
    BUYER,
    POOL_START,
    _join,
    _work,
    buyer,
    fake_mt4,
    round_,
)
from tests.test_login import member  # noqa: F401

URL = "/api/v1/admin/accounts"


def test_admin_account_list_detail_stats(client, admin_headers, buyer, round_, fake_mt4):  # noqa: F811
    assert _join(client, buyer, round_["challenge_id"], quantity=2).status_code == 201
    _work()

    res = client.get(URL, headers=admin_headers, params={"tier": "CHALLENGE"})
    assert res.status_code == 200, res.text
    page = res.json()
    assert page["total"] == 2 and page["pages"] == 1
    row = page["items"][0]
    assert row["tier"] == "CHALLENGE" and row["status"] == "PENDING"
    assert row["user_email"] == BUYER and row["user_name"] == "김 철수" and row["user_grade"] == "NORMAL"
    assert row["mt4_login"] in (POOL_START, POOL_START + 1)
    assert row["mt4_password"]  # 관리자는 대회 시작 전에도 비밀번호를 본다
    assert row["capital"] == 100000 and row["balance"] == 100000 and row["total_profit"] == 0
    assert row["session_name"] == "Starter #1" and row["start_at"] and row["end_at"]
    assert row["product_name"] == "Challenge Starter"

    # 필터·검색
    def total(**params):
        return client.get(URL, headers=admin_headers, params={"tier": "CHALLENGE", **params}).json()["total"]

    assert total(tier="DEMO") == 0
    assert total(status="ACTIVE") == 0 and total(status="pending") == 2
    assert total(keyword=str(row["mt4_login"])) == 1
    assert total(keyword="철수") == 2 and total(keyword="buyer@") == 2 and total(keyword="nobody") == 0
    assert total(type_code=round_["product_id"]) == 2 and total(type_code="9999") == 0
    assert total(start_date="20000101", end_date="20000102") == 0
    assert total(start_date="20000101") == 2
    user_id = row["user_id"]
    assert client.get(URL, headers=admin_headers, params={"user_id": user_id}).json()["total"] == 2
    assert client.get(URL, headers=admin_headers, params={"tier": "XXX"}).status_code == 400

    # 상세: UUID 또는 MT4 번호
    detail = client.get(f"{URL}/{row['account_id']}", headers=admin_headers)
    assert detail.status_code == 200 and detail.json()["mt4_login"] == row["mt4_login"]
    by_login = client.get(f"{URL}/{row['mt4_login']}", headers=admin_headers).json()
    assert by_login["account_id"] == row["account_id"] and by_login["leverage"] == 100
    assert client.get(f"{URL}/12345", headers=admin_headers).status_code == 404
    assert client.get(f"{URL}/abc", headers=admin_headers).status_code == 404
    trades = client.get(f"{URL}/{row['account_id']}/trades", headers=admin_headers).json()
    assert trades["items"] == [] and trades["total"] == 0

    stats = client.get("/api/v1/admin/accounts-stats", headers=admin_headers, params={"tier": "CHALLENGE"}).json()
    assert stats == {"tier": "CHALLENGE", "total_accounts": 2, "in_progress_accounts": 0, "total_capital": 200000}
    assert client.post(f"/api/v1/admin/challenges/{round_['challenge_id']}/start", headers=admin_headers).status_code == 200
    stats = client.get("/api/v1/admin/accounts-stats", headers=admin_headers, params={"tier": "CHALLENGE"}).json()
    assert stats["in_progress_accounts"] == 2

    # 발급 실패(환불) 계좌는 빠진다
    run_sql("update core.trading_accounts set provision_status = 'FAILED' where mt4_login = $1", row["mt4_login"])
    assert total() == 1
    assert client.get("/api/v1/admin/accounts-stats", headers=admin_headers).json()["total_accounts"] == 1


def test_admin_accounts_require_admin(client, buyer):  # noqa: F811
    assert client.get(URL, headers=buyer).status_code == 403
    assert client.get("/api/v1/admin/accounts-stats", headers=buyer).status_code == 403


def _readonly_calls(fake):
    return [(int(p.split("/")[4]), b["value"]) for m, p, b in fake.calls if p.endswith("/readonly")]


def test_freeze_unfreeze_ban(client, admin_headers, buyer, round_, fake_mt4):  # noqa: F811
    from tests.test_challenge_orders import _join, _work

    assert _join(client, buyer, round_["challenge_id"], quantity=2).status_code == 201
    _work()
    items = client.get(URL, headers=admin_headers, params={"tier": "CHALLENGE"}).json()["items"]
    a, b = items[0], items[1]
    cid = round_["challenge_id"]

    # 대회 시작 전(PENDING)도 비활성 가능 → 시작해도 잠긴 채로 남는다
    res = client.post(f"{URL}/{a['account_id']}/freeze", headers=admin_headers, json={"reason": "점검"})
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "INACTIVE"
    assert client.post(f"/api/v1/admin/challenges/{cid}/start", headers=admin_headers).status_code == 200
    _work()
    assert fake_mt4.accounts[a["mt4_login"]]["isReadOnly"] is True
    assert fake_mt4.accounts[b["mt4_login"]]["isReadOnly"] is False
    detail = client.get(f"{URL}/{a['account_id']}", headers=admin_headers).json()
    assert detail["status"] == "INACTIVE" and detail["reason"] == "점검"

    # 활성 복귀 → 대회 진행 중이므로 ACTIVE, 거래 잠금 해제
    res = client.post(f"{URL}/{a['mt4_login']}/unfreeze", headers=admin_headers)
    assert res.status_code == 200 and res.json()["status"] == "ACTIVE"
    _work()
    assert fake_mt4.accounts[a["mt4_login"]]["isReadOnly"] is False
    assert client.post(f"{URL}/{a['account_id']}/unfreeze", headers=admin_headers).json()["error_code"] == "invalid_status"

    # 미결 포지션이 있으면 거절 (상태 그대로)
    fake_mt4.open_positions[b["mt4_login"]] = [{"ticket": 1}]
    res = client.post(f"{URL}/{b['account_id']}/freeze", headers=admin_headers)
    assert res.status_code == 400 and res.json()["error_code"] == "open_positions_exist"
    res = client.post(f"{URL}/{b['account_id']}/ban", headers=admin_headers, json={"reason": "부정 거래"})
    assert res.json()["error_code"] == "open_positions_exist"
    fake_mt4.open_positions.clear()

    # 영구정지: 사유 필수, 되돌릴 수 없음
    assert client.post(f"{URL}/{b['account_id']}/ban", headers=admin_headers, json={"reason": ""}).status_code == 422
    res = client.post(f"{URL}/{b['account_id']}/ban", headers=admin_headers, json={"reason": "부정 거래"})
    assert res.status_code == 200 and res.json()["status"] == "BANNED"
    _work()
    assert fake_mt4.accounts[b["mt4_login"]]["isReadOnly"] is True
    assert client.post(f"{URL}/{b['account_id']}/unfreeze", headers=admin_headers).json()["error_code"] == "invalid_status"
    assert client.post(f"{URL}/{b['account_id']}/ban", headers=admin_headers, json={"reason": "x"}).status_code == 400
    listed = client.get(URL, headers=admin_headers, params={"status": "BANNED"}).json()["items"]
    assert len(listed) == 1 and listed[0]["reason"] == "부정 거래"

    # 대회 종료 뒤 비활성 → 활성 복귀하면 CLOSED (잠금 유지)
    assert client.post(f"{URL}/{a['account_id']}/freeze", headers=admin_headers).json()["status"] == "INACTIVE"
    assert client.post(f"/api/v1/admin/challenges/{cid}/close", headers=admin_headers).status_code == 200
    _work()
    assert client.get(f"{URL}/{a['account_id']}", headers=admin_headers).json()["status"] == "INACTIVE"
    assert client.post(f"{URL}/{a['account_id']}/unfreeze", headers=admin_headers).json()["status"] == "CLOSED"
    _work()
    assert fake_mt4.accounts[a["mt4_login"]]["isReadOnly"] is True
    # BANNED는 대회 종료 때 CLOSED로 바뀌지 않는다
    assert client.get(f"{URL}/{b['account_id']}", headers=admin_headers).json()["status"] == "BANNED"

    history = run_sql("select action, from_status, to_status from core.trading_account_status_history order by id")
    assert [(h["action"], h["from_status"], h["to_status"]) for h in history] == [
        ("FREEZE", "PENDING", "INACTIVE"), ("UNFREEZE", "INACTIVE", "ACTIVE"), ("BAN", "ACTIVE", "BANNED"),
        ("FREEZE", "ACTIVE", "INACTIVE"), ("UNFREEZE", "INACTIVE", "CLOSED"),
    ]


def test_status_change_requires_issued_account(client, admin_headers, buyer, round_, fake_mt4):  # noqa: F811
    from tests.test_challenge_orders import _join

    assert _join(client, buyer, round_["challenge_id"]).status_code == 201  # 아직 발급 중
    item = client.get(URL, headers=admin_headers).json()["items"][0]
    res = client.post(f"{URL}/{item['account_id']}/freeze", headers=admin_headers)
    assert res.json()["error_code"] == "account_not_issued"


def test_create_demo_account(client, admin_headers, buyer, fake_mt4):  # noqa: F811
    from tests.test_catalog import _product
    from tests.test_challenge_orders import _work

    body = {"product_id": "DEMO_STD", "capital": 50000, "leverage": 200}
    # 데모 상품이 없으면 만들 수 없다
    assert client.post("/api/v1/demo/accounts", headers=buyer, json=body).json()["error_code"] == "demo_product_not_found"
    demo = _product(client, admin_headers, name="Demo Standard", tier_type="DEMO", capital=10000, price_usdt=0,
                    mt4_group="demo\\demo", mt4_login_pool_start=30000001, mt4_login_pool_end=30000009)
    assert demo.status_code == 200, demo.text
    demo_id = demo.json()["product_id"]

    assert client.post("/api/v1/demo/accounts", headers=buyer, json={**body, "leverage": 7}).json()["error_code"] == "invalid_leverage"
    assert client.post("/api/v1/demo/accounts", headers=buyer, json={**body, "capital": 123}).json()["error_code"] == "invalid_capital"
    challenge = _product(client, admin_headers, name="Challenge X", mt4_login_pool_start=40000001, mt4_login_pool_end=40000009)
    res = client.post("/api/v1/demo/accounts", headers=buyer, json={**body, "product_id": challenge.json()["product_id"]})
    assert res.json()["error_code"] == "invalid_product_tier"

    res = client.post("/api/v1/demo/accounts", headers=buyer, json=body)
    assert res.status_code == 201, res.text
    out = res.json()
    assert out["provision_status"] == "QUEUED" and out["mt4_login"] is None and out["product_id"] == demo_id
    assert fake_mt4.calls == []  # 요청 안에서는 MT4를 부르지 않는다

    _work()
    mine = client.get("/api/v1/accounts", headers=buyer, params={"tier": "DEMO"}).json()["items"]
    assert len(mine) == 1
    acc = mine[0]
    assert acc["status"] == "ACTIVE" and acc["provision_status"] == "DONE" and acc["mt4_login"] == 30000001
    assert acc["leverage_override"] == 200 and acc["capital"] == 50000 and acc["mt4_password"]
    mt4_acc = fake_mt4.accounts[30000001]
    assert mt4_acc["isReadOnly"] is False and mt4_acc["balance"] == 50000 and mt4_acc["leverage"] == 200
    assert mt4_acc["group"] == "demo\\demo"

    # 관리자 데모 계좌관리
    page = client.get(URL, headers=admin_headers, params={"tier": "DEMO"}).json()
    assert page["total"] == 1 and page["items"][0]["leverage_override"] == 200
    assert client.post(f"{URL}/30000001/freeze", headers=admin_headers).json()["status"] == "INACTIVE"
    assert client.post(f"{URL}/30000001/unfreeze", headers=admin_headers).json()["status"] == "ACTIVE"
    _work()
    assert fake_mt4.accounts[30000001]["isReadOnly"] is False
