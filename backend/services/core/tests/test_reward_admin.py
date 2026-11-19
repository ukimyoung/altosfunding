"""추천인 리워드(첫 구매 시 생성·승인/반려·지갑 입금)와 트레이딩 보너스 관리자 API."""

import pytest

from tests.conftest import run_sql
from tests.test_admin_users import _create, admin_headers  # noqa: F401
from tests.test_challenge_orders import BUYER, _balance, _join, _ledger, _work, buyer, fake_mt4, round_  # noqa: F401
from tests.test_login import _login, member  # noqa: F401

REFERRER = "referrer@example.com"
WAITING = "waiting@example.com"


@pytest.fixture
def referrer(client, admin_headers, buyer):  # noqa: F811
    _create(client, admin_headers, email=REFERRER, first_name="추천", last_name="인")
    _create(client, admin_headers, email=WAITING, first_name="대기")
    run_sql(
        "update core.users set referrer_id = (select id from core.users where email = $1) where email in ($2, $3)",
        REFERRER, BUYER, WAITING,
    )
    token = _login(client, email=REFERRER, password="Target123!").json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _rewards(client, headers, **params):
    res = client.get("/api/v1/admin/rewards/referrals", headers=headers, params=params)
    assert res.status_code == 200, res.text
    return res.json()


def test_first_purchase_creates_pending_reward_and_approve(
    client, admin_headers, buyer, referrer, round_, fake_mt4  # noqa: F811
):
    body = _rewards(client, admin_headers)
    assert body["total"] == 2
    assert {i["status"] for i in body["items"]} == {"AWAITING_PURCHASE"}
    assert all(i["id"] == 0 and i["user_email"] == REFERRER for i in body["items"])

    assert _join(client, buyer, round_["challenge_id"], quantity=2).status_code == 201
    _work()
    # 두 번째 주문도 완료되지만 피추천인 1명당 리워드는 1건
    assert _join(client, buyer, round_["challenge_id"]).status_code == 201
    _work()
    rows = run_sql("select user_id, amount, status, source_type from core.reward_records")
    assert len(rows) == 1 and float(rows[0]["amount"]) == 40 and rows[0]["status"] == "PENDING"

    pending = _rewards(client, admin_headers, status="PENDING")
    assert pending["total"] == 2  # 승인 대기 1 + 구매 전 1
    reward = next(i for i in pending["items"] if i["id"])
    assert reward["source_user_email"] == BUYER and reward["amount"] == 40 and reward["referral_code"]
    assert _rewards(client, admin_headers, status="AWAITING_PURCHASE")["items"][0]["source_user_email"] == WAITING
    assert _rewards(client, admin_headers, keyword="waiting")["total"] == 1

    stats = client.get("/api/v1/admin/rewards/referrals/stats", headers=admin_headers).json()
    assert stats == {"total_accumulated": 0.0, "total_approved": 0.0, "total_pending": 40.0, "active_referrals": 2}
    my = client.get("/api/v1/rewards/referrals/stats", headers=referrer).json()
    assert (my["total_invited"], my["pending_referrals"], my["total_earned"]) == (2, 2, 0.0)
    items = client.get("/api/v1/rewards/referrals", headers=referrer).json()["items"]
    assert {(i["email"], i["status"], i["total_challenge_count"]) for i in items} == {
        (BUYER, "Active", 2), (WAITING, "Pending", 0)
    }

    assert _balance(client, referrer) == 0
    res = client.post(f"/api/v1/admin/rewards/referrals/{reward['id']}/approve", headers=admin_headers)
    assert res.status_code == 200, res.text
    assert _balance(client, referrer) == 40
    sums = _ledger()
    assert sums["EXPENSE:REFERRAL_REWARD"] == -40
    again = client.post(f"/api/v1/admin/rewards/referrals/{reward['id']}/approve", headers=admin_headers)
    assert again.status_code == 400 and again.json()["error_code"] == "invalid_status"
    assert _balance(client, referrer) == 40

    stats = client.get("/api/v1/admin/rewards/referrals/stats", headers=admin_headers).json()
    assert (stats["total_approved"], stats["total_pending"]) == (40.0, 0.0)
    my = client.get("/api/v1/rewards/referrals/stats", headers=referrer).json()
    assert (my["pending_referrals"], my["total_earned"]) == (1, 40.0)
    mine = client.get("/api/v1/rewards/mine", headers=referrer).json()
    assert mine["total"] == 1 and mine["items"][0]["status"] == "APPROVED" and mine["items"][0]["credited_at"]
    summary = client.get("/api/v1/rewards/summary", headers=referrer).json()
    assert summary["total_credited"] == 40 and summary["referral_count"] == 2
    links = client.get("/api/v1/admin/rewards/referral-links", headers=admin_headers).json()
    assert {(i["referee_email"], i["has_completed_purchase"], i["reward_status"]) for i in links["items"]} == {
        (BUYER, True, "APPROVED"), (WAITING, False, None)
    }
    assert _rewards(client, admin_headers, status="APPROVED")["total"] == 1


def test_reject_and_policy_conditions(client, admin_headers, buyer, referrer, round_, fake_mt4):  # noqa: F811
    # 조건이 펀디드 승급이면 첫 구매로는 생기지 않는다.
    client.put("/api/v1/admin/rewards/policy", headers=admin_headers,
               json={"referral_reward_condition": "FUNDED_UPGRADE"})
    _join(client, buyer, round_["challenge_id"])
    _work()
    assert run_sql("select count(*) n from core.reward_records")[0]["n"] == 0

    client.put("/api/v1/admin/rewards/policy", headers=admin_headers,
               json={"referral_reward_condition": "FIRST_PURCHASE", "referral_reward_amount": 12.5})
    _join(client, buyer, round_["challenge_id"])
    _work()
    reward_id = run_sql("select id, amount from core.reward_records")[0]
    assert float(reward_id["amount"]) == 12.5
    rid = reward_id["id"]

    blank = client.post(f"/api/v1/admin/rewards/referrals/{rid}/reject", headers=admin_headers,
                        json={"rejection_reason": "  "})
    assert blank.status_code == 422
    res = client.post(f"/api/v1/admin/rewards/referrals/{rid}/reject", headers=admin_headers,
                      json={"rejection_reason": "어뷰징 의심"})
    assert res.status_code == 200, res.text
    item = _rewards(client, admin_headers, status="REJECTED")["items"][0]
    assert item["rejection_reason"] == "어뷰징 의심" and item["rejected_at"]
    assert _balance(client, referrer) == 0
    assert client.post("/api/v1/admin/rewards/referrals/999/approve", headers=admin_headers).status_code == 404
    assert client.get("/api/v1/admin/rewards/referrals", headers=referrer).status_code == 403


def test_approve_requires_completed_purchase(client, admin_headers, referrer):  # noqa: F811
    run_sql(
        "insert into core.reward_records (user_id, source_user_id, amount) "
        "select r.id, w.id, 40 from core.users r, core.users w where r.email = $1 and w.email = $2",
        REFERRER, WAITING,
    )
    rid = run_sql("select id from core.reward_records")[0]["id"]
    res = client.post(f"/api/v1/admin/rewards/referrals/{rid}/approve", headers=admin_headers)
    assert res.status_code == 400 and res.json()["error_code"] == "no_purchase_history"


def test_trading_bonuses(client, admin_headers, referrer):  # noqa: F811
    empty = client.get("/api/v1/admin/rewards/trading-bonuses", headers=admin_headers).json()
    assert empty == {"items": [], "total": 0, "page": 1, "size": 20, "pages": 0}
    stats = client.get("/api/v1/admin/rewards/trading-bonuses/stats", headers=admin_headers).json()
    assert stats == {"total_accumulated": 0.0, "total_approved": 0.0, "total_pending": 0.0, "trading_bonus_rate": 0.01}

    # 수익 정산이 Core에 생기면 그쪽에서 만든다. 지금은 직접 넣어 승인 흐름만 확인한다.
    run_sql(
        "insert into core.trading_bonus_records (user_id, payout_request_id, mt4_login, trader_profit, profit_split_pct,"
        " company_share, bonus_rate, bonus_amount) select id, n, 10000001, 1000, 80, 200, 0.01, 2"
        " from core.users, generate_series(1, 2) n where email = $1",
        REFERRER,
    )
    body = client.get("/api/v1/admin/rewards/trading-bonuses", headers=admin_headers, params={"status": "PENDING"}).json()
    assert body["total"] == 2
    first = body["items"][0]
    assert first["user_email"] == REFERRER and first["mt4_login"] == 10000001 and first["trader_profit"] == 1000
    assert client.get("/api/v1/admin/rewards/trading-bonuses", headers=admin_headers,
                      params={"keyword": "10000001"}).json()["total"] == 2

    ids = [i["id"] for i in body["items"]]
    assert client.post(f"/api/v1/admin/rewards/trading-bonuses/{ids[0]}/approve", headers=admin_headers).status_code == 200
    assert client.post(f"/api/v1/admin/rewards/trading-bonuses/{ids[1]}/reject", headers=admin_headers,
                       json={"rejection_reason": "중복"}).status_code == 200
    assert _balance(client, referrer) == 2
    assert _ledger()["EXPENSE:TRADING_BONUS"] == -2
    stats = client.get("/api/v1/admin/rewards/trading-bonuses/stats", headers=admin_headers).json()
    assert (stats["total_approved"], stats["total_pending"]) == (2.0, 0.0)
    mine = client.get("/api/v1/rewards/mine", headers=referrer, params={"type": "TRADING_BONUS"}).json()
    assert {i["status"] for i in mine["items"]} == {"APPROVED", "REJECTED"}
