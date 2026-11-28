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


def test_funded_list_filters(client, admin_headers, buyer, round_, fake_mt4):  # noqa: F811
    """My Page > Funded: 펀딩 유형(Starter·Professional·Elite·Prime)은 원래 챌린지 상품 기준."""
    prime_id = _prime_round(client, admin_headers)
    assert _join(client, buyer, round_["challenge_id"]).status_code == 201
    assert _join(client, buyer, prime_id).status_code == 201
    _work()
    # 펀디드 상품 이름은 유형과 다르다 ('Funded 100K'). Starter 쪽은 연관 챌린지 상품도 지정하지 않는다.
    funded = _product(client, admin_headers, name="Funded 100K", tier_type="FUNDED", capital=100000, price_usdt=0,
                      mt4_login_pool_start=21000001, mt4_login_pool_end=21000009)
    assert funded.status_code == 200, funded.text
    fid = funded.json()["product_id"]
    run_sql(
        "insert into core.trading_accounts (user_id, product_id, tier, mt4_server, mt4_group, mt4_login, leverage,"
        " capital, status, provision_status, start_at, source_account_id)"
        " select user_id, $1, 'FUNDED', 'live', mt4_group, mt4_login + 20000000, leverage, capital,"
        " case when product_id = $2 then 'ACTIVE' else 'PENDING' end, 'DONE',"
        " case when product_id = $2 then timestamptz '2026-03-10 00:00:00+00' else timestamptz '2026-03-20 00:00:00+00' end,"
        " id from core.trading_accounts where tier = 'CHALLENGE'",
        fid, round_["product_id"],
    )
    starter_login = run_sql("select mt4_login from core.trading_accounts where tier = 'FUNDED' and status = 'ACTIVE'")[0]["mt4_login"]

    def logins(**params):
        res = client.get(URL, headers={**buyer, "X-Timezone": "Asia/Seoul"}, params={"tier": "FUNDED", **params})
        assert res.status_code == 200, res.text
        return sorted(a["mt4_login"] for a in res.json()["items"])

    assert len(logins()) == 2
    listed = client.get(URL, headers=buyer, params={"tier": "FUNDED"}).json()["items"]
    assert {a["mt4_login"]: a["account_type"] for a in listed}[starter_login] == "Starter"
    assert sorted(a["account_type"] for a in listed) == ["Prime", "Starter"]
    challenge = client.get(URL, headers=buyer, params={"tier": "CHALLENGE"}).json()["items"]
    assert sorted(a["account_type"] for a in challenge) == ["Prime", "Starter"]
    assert logins(product_type="Starter") == [starter_login]
    assert len(logins(product_type="Prime")) == 1 and logins(product_type="Prime") != [starter_login]
    assert logins(product_type="Professional") == [] and logins(product_type="Elite") == []
    assert logins(mt4_login=str(starter_login)) == [starter_login] and len(logins(mt4_login="3000")) == 2
    assert logins(status="ACTIVE") == [starter_login] and len(logins(status="PENDING")) == 1
    assert logins(start_date="20260310", end_date="20260310") == [starter_login]
    assert logins(start_date="20260311") == logins(product_type="Prime")
    assert logins(product_type="Starter", status="ACTIVE", start_date="20260301", end_date="20260315") == [starter_login]
    assert logins(product_type="Prime", status="ACTIVE") == []
