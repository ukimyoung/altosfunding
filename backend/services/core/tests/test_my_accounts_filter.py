"""사용자 My Page > Challenge 목록의 Search & Filter (계좌 번호·계좌 유형·시작일·종료일·상태)."""

from datetime import UTC, datetime, timedelta

from tests.conftest import run_sql
from tests.test_admin_users import admin_headers  # noqa: F401
from tests.test_catalog import _product
from tests.test_challenge_orders import (  # noqa: F401
    POOL_START,
    _join,
    _work,
    buyer,
    fake_mt4,
    round_,
)
from tests.test_login import member  # noqa: F401

URL = "/api/v1/accounts"
PRIME_POOL = POOL_START + 100


def _prime_round(client, admin_headers):  # noqa: F811
    product = _product(client, admin_headers, name="Challenge Prime", price_usdt=100, capital=200000,
                       mt4_login_pool_start=PRIME_POOL, mt4_login_pool_end=PRIME_POOL + 9)
    assert product.status_code == 200, product.text
    start = datetime.now(UTC) + timedelta(days=1)
    res = client.post("/api/v1/admin/challenges", headers=admin_headers, json={
        "product_id": product.json()["product_id"], "name": "Prime #1", "group_size": 3,
        "start_at": start.isoformat(), "end_at": (start + timedelta(days=5)).isoformat(),
    })
    assert res.status_code == 200, res.text
    return res.json()["challenge_id"]


def test_challenge_list_filters(client, admin_headers, buyer, round_, fake_mt4):  # noqa: F811
    prime_id = _prime_round(client, admin_headers)
    assert _join(client, buyer, round_["challenge_id"], quantity=2).status_code == 201
    assert _join(client, buyer, prime_id).status_code == 201
    _work()

    def items(**params):
        res = client.get(URL, headers=buyer, params={"tier": "CHALLENGE", **params})
        assert res.status_code == 200, res.text
        return res.json()["items"]

    assert len(items()) == 3

    # 계좌 유형: 상품명에서 'Challenge '를 뺀 이름 (대소문자 무시)
    starter = items(product_type="Starter")
    assert len(starter) == 2 and {a["product_name"] for a in starter} == {"Challenge Starter"}
    prime = items(product_type="prime")
    assert len(prime) == 1 and prime[0]["product_name"] == "Challenge Prime"
    assert items(product_type="Elite") == [] and len(items(product_type="All")) == 3

    # 계좌 번호: MT4 번호 일부
    login = prime[0]["mt4_login"]
    assert [a["mt4_login"] for a in items(mt4_login=str(login))] == [login]
    assert len(items(mt4_login=str(POOL_START)[:5])) == 3 and len(items(mt4_login="1000000")) == 2
    assert items(mt4_login="99999999") == []

    # 상태
    assert len(items(status="PENDING")) == 3 and items(status="ACTIVE") == []
    run_sql(f"update core.trading_accounts set status = 'ACTIVE' where mt4_login = {login}")
    assert [a["mt4_login"] for a in items(status="ACTIVE")] == [login]

    # 기간: 계좌 시작일 기준 (X-Timezone 날짜). Prime 시작일을 2026-03-10 09:00 KST로 바꾼다.
    run_sql(f"update core.trading_accounts set start_at = '2026-03-10 00:00:00+00' where mt4_login = {login}")
    kst = {"X-Timezone": "Asia/Seoul"}

    def logins(**params):
        res = client.get(URL, headers={**buyer, **kst}, params={"tier": "CHALLENGE", **params})
        assert res.status_code == 200, res.text
        return [a["mt4_login"] for a in res.json()["items"]]

    assert logins(start_date="20260310", end_date="20260310") == [login]
    assert logins(start_date="2026-03-09", end_date="2026-03-11") == [login]
    assert logins(start_date="20260311", end_date="20260320") == []
    assert logins(end_date="20260309") == []
    assert len(logins(start_date="20260311")) == 2  # Starter 계좌는 내일 시작
    assert logins(end_date="20260310") == [login]
    # 여러 조건을 함께
    assert logins(product_type="Prime", status="ACTIVE", start_date="20260310") == [login]
    assert logins(product_type="Starter", start_date="20260310", end_date="20260310") == []
