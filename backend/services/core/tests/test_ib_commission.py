"""IB 차등 커미션: 결제 즉시 계산·적립, 일반 회원·비활성 IB 건너뜀, 회사 귀속, 환불 시 환수·마이너스 잔액."""

from itertools import pairwise

import pytest

from tests.conftest import run_sql
from tests.test_admin_users import _create, admin_headers  # noqa: F401
from tests.test_challenge_orders import (  # noqa: F401
    BUYER,
    _balance,
    _join,
    _ledger,
    _work,
    buyer,
    fake_mt4,
    round_,
)
from tests.test_login import _login, member  # noqa: F401
from tests.test_member_relations import _id
from tests.test_wallets import TRC_ADDR

API = "/api/v1/admin/affiliate"
# 위 → 아래. plain은 일반 회원, 그 아래가 구매자.
CHAIN = [("top", 5), ("hong", 20), ("lee", 18), ("chul", 16), ("kim", 10), ("plain", None)]


def _email(name):
    return f"{name}@example.com"


def _headers(client, name):
    token = _login(client, email=_email(name), password="Target123!").json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def ib_chain(client, admin_headers, buyer):  # noqa: F811
    for name, _ in CHAIN:
        _create(client, admin_headers, email=_email(name), first_name=name, kyc_status="APPROVED")
    emails = [_email(n) for n, _ in CHAIN] + [BUYER]
    for upper, lower in pairwise(emails):
        run_sql(
            "update core.member_relations set sponsor_id = (select id from core.users where email = $1),"
            " placement_parent_id = (select id from core.users where email = $1)"
            " where member_id = (select id from core.users where email = $2)",
            upper, lower,
        )
    for name, level in CHAIN:
        if level:
            res = client.post(f"{API}/partners", headers=admin_headers, json={"user_id": str(_id(_email(name))), "level": level})
            assert res.status_code == 200, res.text
    rates = [{"level": lv, "rate": min(lv, 20)} for lv in range(1, 41)]  # Level N = N% (최대 20%)
    assert client.put(f"{API}/level-rates", headers=admin_headers, json={"rates": rates}).status_code == 200
    return {name: _headers(client, name) for name, _ in CHAIN}


def _flow(client, admin_headers, order_id):  # noqa: F811
    res = client.get(f"{API}/commission-flows/{order_id}", headers=admin_headers)
    assert res.status_code == 200, res.text
    return res.json()


def test_differential_commission_credited_at_payment(client, admin_headers, buyer, round_, fake_mt4, ib_chain):  # noqa: F811
    res = _join(client, buyer, round_["challenge_id"])  # 80 USDT (할인가)
    assert res.status_code == 201, res.text
    order_id = res.json()["order_id"]
    # 계좌 발급(Worker) 전, 결제 즉시 적립된다. 80 × (10%, 16−10%, 18−16%, 20−18%, 5% ≤ 20% → 0)
    balances = {n: _balance(client, h) for n, h in ib_chain.items()}
    assert balances == {"kim": 8, "chul": 4.8, "lee": 1.6, "hong": 1.6, "top": 0, "plain": 0}
    assert _ledger()["EXPENSE:IB_COMMISSION"] == -16

    flow = _flow(client, admin_headers, order_id)
    assert (flow["base_amount"], flow["marketing_rate"], flow["budget"], flow["paid_amount"], flow["retained_amount"]) == (80, 20, 16, 16, 0)
    assert [(ln["member"]["email"].split("@")[0], ln["result"], ln["applied_rate"]) for ln in flow["lines"]] == [
        ("plain", "SKIPPED_NOT_IB", 0), ("kim", "PAID", 10), ("chul", "PAID", 6),
        ("lee", "PAID", 2), ("hong", "PAID", 2), ("top", "ZERO", 0),
    ]

    listing = client.get(f"{API}/commissions", headers=admin_headers).json()
    assert listing["total"] == 4 and listing["summary"] == {"paid": 16.0, "clawed_back": 0.0, "net": 16.0}
    assert client.get(f"{API}/commissions", headers=admin_headers, params={"keyword": "chul"}).json()["total"] == 1
    flows = client.get(f"{API}/commission-flows", headers=admin_headers).json()
    assert flows["total"] == 1 and flows["summary"]["budget"] == 16 and flows["summary"]["retained"] == 0

    partners = {i["email"]: i for i in client.get(f"{API}/partners", headers=admin_headers).json()["items"]}
    assert partners[_email("kim")]["commission_total"] == 8
    net = client.get(f"{API}/network", headers=admin_headers, params={"keyword": _email("hong")}).json()
    assert net["root"]["commission_total"] == 1.6

    # 구매자의 추천인(plain)이 IB가 아니라서 $40 추천인 리워드는 그대로 생긴다
    _work()
    assert run_sql("select count(*) n from core.reward_records")[0]["n"] == 1


def test_inactive_ib_skipped_and_rest_goes_to_company(client, admin_headers, buyer, round_, fake_mt4, ib_chain):  # noqa: F811
    hong = _id(_email("hong"))
    assert client.patch(f"{API}/partners/{hong}", headers=admin_headers, json={"status": "BANNED"}).status_code == 200
    lee = _id(_email("lee"))
    assert client.patch(f"{API}/partners/{lee}", headers=admin_headers, json={"status": "INACTIVE"}).status_code == 200
    order_id = _join(client, buyer, round_["challenge_id"]).json()["order_id"]
    # 비활성 lee·영구정지 hong은 건너뛰고 최고 비율도 올리지 않는다 → top(5%)도 16%보다 낮아 0
    balances = {n: _balance(client, h) for n, h in ib_chain.items()}
    assert balances == {"kim": 8, "chul": 4.8, "lee": 0, "hong": 0, "top": 0, "plain": 0}
    flow = _flow(client, admin_headers, order_id)
    assert (flow["budget"], flow["paid_amount"], flow["retained_amount"]) == (16, 12.8, 3.2)
    assert {ln["member"]["email"]: ln["result"] for ln in flow["lines"]}[_email("hong")] == "SKIPPED_INACTIVE"


def test_zero_price_order_has_no_commission(client, admin_headers, buyer, round_, fake_mt4, ib_chain):  # noqa: F811
    run_sql("update core.products set discount_price_usdt = 0, price_usdt = 0")
    order_id = _join(client, buyer, round_["challenge_id"]).json()["order_id"]
    assert client.get(f"{API}/commission-flows/{order_id}", headers=admin_headers).status_code == 404


def test_refund_claws_back_and_negative_balance_blocks_withdrawal(
    client, admin_headers, buyer, round_, fake_mt4, ib_chain  # noqa: F811
):
    order_id = _join(client, buyer, round_["challenge_id"], quantity=2).json()["order_id"]  # 160 USDT
    kim = ib_chain["kim"]
    assert _balance(client, kim) == 16
    run_sql("update core.users set is_email_enabled = false where email = $1", _email("kim"))
    res = client.post("/api/v1/wallets/me/withdraw", headers=kim, json={"amount": 16, "network": "TRC20", "wallet_address": TRC_ADDR})
    assert res.status_code == 200, res.text
    assert _balance(client, kim) == 0

    # 계좌 2개 중 1개 발급 실패 → 80 USDT 환불 → 커미션 절반 환수
    fake_mt4.create_errors = [(400, {"code": "ValidationError", "errors": [{"message": "Invalid name"}]})]
    _work()
    detail = client.get(f"/api/v1/challenges/orders/{order_id}", headers=buyer).json()
    assert detail["refunded_quantity"] == 1 and detail["issued_quantity"] == 1
    balances = {n: _balance(client, h) for n, h in ib_chain.items()}
    assert balances == {"kim": -8, "chul": 4.8, "lee": 1.6, "hong": 1.6, "top": 0, "plain": 0}
    assert _ledger()["EXPENSE:IB_COMMISSION"] == -16
    flow = _flow(client, admin_headers, order_id)
    assert (flow["refunded_base"], flow["clawed_back_amount"]) == (80, 16)
    clawback = run_sql("select is_reversal, reversed_entry_id from core.journal_entries where entry_type = 'IB_COMMISSION_CLAWBACK'")
    assert len(clawback) == 1 and clawback[0]["is_reversal"] and clawback[0]["reversed_entry_id"]

    blocked = client.post("/api/v1/wallets/me/withdraw", headers=kim, json={"amount": 10, "network": "TRC20", "wallet_address": TRC_ADDR})
    assert blocked.status_code == 400 and blocked.json()["error_code"] == "negative_balance"
    listing = client.get(f"{API}/commissions", headers=admin_headers, params={"keyword": "kim"}).json()
    item = listing["items"][0]
    assert (item["amount"], item["clawed_back_amount"], item["net_amount"], item["status"]) == (16, 8, 8, "PARTIAL_CLAWBACK")


def test_full_refund_claws_back_everything(client, admin_headers, buyer, round_, fake_mt4, ib_chain):  # noqa: F811
    order_id = _join(client, buyer, round_["challenge_id"]).json()["order_id"]
    fake_mt4.create_errors = [(400, {"code": "ValidationError", "errors": [{"message": "Invalid name"}]})]
    _work()
    assert {n: _balance(client, h) for n, h in ib_chain.items()} == dict.fromkeys(ib_chain, 0)
    assert _ledger()["EXPENSE:IB_COMMISSION"] == 0
    flow = _flow(client, admin_headers, order_id)
    assert flow["clawed_back_amount"] == 16 and all(ln["clawed_back_amount"] == ln["amount"] for ln in flow["lines"])
