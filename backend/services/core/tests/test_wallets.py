from decimal import Decimal

import pytest

from tests.conftest import run_sql
from tests.test_admin_users import ADMIN_EMAIL, _create, admin_headers  # noqa: F401
from tests.test_login import _login, member  # noqa: F401

TRADER = "target@example.com"
TRC_ADDR = "TQmZ7rK2pVx9nL4sJ8dH3cF6wY1aB5uN1Q"


@pytest.fixture
def trader(client, admin_headers):  # noqa: F811
    """KYC 승인, 출금 이메일 인증을 끈 회원."""
    _create(client, admin_headers, email=TRADER, kyc_status="APPROVED")
    run_sql("update core.users set is_email_enabled = false where email = $1", TRADER)
    token = _login(client, email=TRADER, password="Target123!").json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _deposit(client, headers, amount=100, tx_hash="0xabc123", network="TRC20"):
    return client.post("/api/v1/wallets/me/deposit", headers=headers,
                       json={"amount": amount, "tx_hash": tx_hash, "network": network})


def _withdraw(client, headers, amount=50, **extra):
    body = {"amount": amount, "network": "TRC20", "wallet_address": TRC_ADDR, **extra}
    return client.post("/api/v1/wallets/me/withdraw", headers=headers, json=body)


def _balance(client, headers):
    return client.get("/api/v1/accounts/my-asset", headers=headers).json()["total_asset"]


def _ledger_balanced():
    row = run_sql("select coalesce(sum(debit),0) d, coalesce(sum(credit),0) c from core.journal_lines")[0]
    return row["d"] == row["c"]


def _user_wallet_liability():
    """원장의 회원 지갑 부채 잔액 (대변 - 차변)."""
    row = run_sql(
        "select coalesce(sum(credit - debit), 0) v from core.journal_lines where account_code = 'LIABILITY:USER_WALLET'"
    )[0]
    return row["v"]


def test_networks_and_empty_asset(client, trader):
    nets = client.get("/api/v1/payouts/config/networks", headers=trader).json()
    assert [n["name"] for n in nets] == ["TRC20", "ETH", "BSC", "POL", "SOL", "APT"]
    assert nets[0] == {"name": "TRC20", "desc": "Tron (TRC20)", "fee": 1.0, "is_active": True}
    assert client.get("/api/v1/payouts/config/networks").status_code == 401

    asset = client.get("/api/v1/accounts/my-asset", headers=trader).json()
    assert asset == {"total_asset": 0.0, "total_live_balance": 0.0, "live_accounts": []}
    wallets = client.get("/api/v1/wallets/me", headers=trader).json()
    assert len(wallets) == 1 and wallets[0]["wallet_type"] == "INTEGRATED"


def test_deposit_request_validation(client, trader):
    assert _deposit(client, trader, amount=9.99).json()["error_code"] == "amount_below_minimum"
    assert _deposit(client, trader, amount=10.001).json()["error_code"] == "invalid_amount"
    assert _deposit(client, trader, tx_hash="  ").json()["error_code"] == "tx_hash_required"
    assert _deposit(client, trader, network="DOGE").json()["error_code"] == "unsupported_network"

    res = _deposit(client, trader, network="trc-20")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["ok"] and body["status"] == "PENDING" and body["network"] == "TRC20" and body["amount"] == 100.0

    dup = _deposit(client, trader, tx_hash="0XABC123")
    assert dup.status_code == 409 and dup.json()["error_code"] == "duplicate_tx_hash"
    # 아직 승인 전이라 잔고는 그대로
    assert _balance(client, trader) == 0


def test_deposit_approve_and_reject(client, admin_headers, trader):  # noqa: F811
    a = _deposit(client, trader, amount=120.5, tx_hash="hash-a").json()["request_id"]
    b = _deposit(client, trader, amount=30, tx_hash="hash-b").json()["request_id"]

    pending = client.get("/api/v1/admin/wallets/requests/pending", headers=admin_headers).json()
    assert [i["id"] for i in pending["items"]] == [a, b]  # 오래된 순
    item = pending["items"][0]
    assert item["source"] == "DEPOSIT_REQ" and item["direction"] == "IN" and item["display_tx_type"] == "External Wallet"
    assert item["user_email"] == TRADER and item["user_nickname"] == "Tar" and item["display_status"] == "Pending"
    summary = client.get("/api/v1/admin/wallets/requests/summary", headers=admin_headers).json()
    assert summary == {"pending_count": 2, "history_count": 0, "deposit_pending_count": 2, "withdraw_pending_count": 0}

    # 일반 회원은 승인 불가
    assert client.post(f"/api/v1/admin/wallets/deposits/{a}/approve", headers=trader).status_code == 403

    res = client.post(f"/api/v1/admin/wallets/deposits/{a}/approve", headers=admin_headers)
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "APPROVED"
    assert _balance(client, trader) == 120.5
    again = client.post(f"/api/v1/admin/wallets/deposits/{a}/approve", headers=admin_headers)
    assert again.status_code == 409 and again.json()["error_code"] == "invalid_status"

    assert client.post(f"/api/v1/admin/wallets/deposits/{b}/reject", headers=admin_headers, json={"reason": " "}).status_code == 422
    res = client.post(f"/api/v1/admin/wallets/deposits/{b}/reject", headers=admin_headers, json={"reason": "TX not found"})
    assert res.json()["status"] == "REJECTED"
    assert _balance(client, trader) == 120.5
    # 반려된 hash는 다시 요청할 수 있다
    assert _deposit(client, trader, amount=30, tx_hash="hash-b").status_code == 200

    history = client.get("/api/v1/admin/wallets/requests/history", headers=admin_headers).json()
    assert [(i["id"], i["display_status"]) for i in history["items"]] == [(b, "Failed"), (a, "Completed")]
    failed = client.get("/api/v1/admin/wallets/requests/history", headers=admin_headers,
                        params={"display_status": "Failed"}).json()
    assert failed["total"] == 1 and failed["items"][0]["reject_reason"] == "TX not found"
    assert client.get("/api/v1/admin/wallets/requests/history", headers=admin_headers,
                      params={"keyword": "hash-a"}).json()["total"] == 1
    assert client.get("/api/v1/admin/wallets/requests/pending", headers=admin_headers,
                      params={"display_tx_type": "Payout"}).json()["total"] == 0

    totals_url = "/api/v1/admin/wallets/requests/history/totals"
    # 승인된 입금만 합산 (반려·대기 제외), 검색 조건은 목록과 같게
    assert client.get(totals_url, headers=admin_headers).json() == {
        "total_deposit_amount": 120.5, "total_withdraw_amount": 0.0,
    }
    assert client.get(totals_url, headers=admin_headers, params={"keyword": "hash-b"}).json()["total_deposit_amount"] == 0.0
    assert client.get(totals_url, headers=admin_headers, params={"keyword": "Tar"}).json()["total_deposit_amount"] == 120.5
    assert client.get(totals_url, headers=admin_headers, params={"display_tx_type": "Payout"}).json()["total_deposit_amount"] == 0.0
    assert client.get(totals_url, headers=admin_headers, params={"end_date": "2000-01-01"}).json()["total_deposit_amount"] == 0.0
    assert client.get(totals_url, headers=trader).status_code == 403

    assert _ledger_balanced() and _user_wallet_liability() == Decimal("120.50")
    row = run_sql("select wallet_tx_id from core.deposit_requests where id = $1", a)[0]
    assert row["wallet_tx_id"] is not None


def test_withdraw_requires_kyc_and_checks_amounts(client, admin_headers, trader):  # noqa: F811
    run_sql("update core.users set kyc_status = 'PENDING' where email = $1", TRADER)
    res = _withdraw(client, trader)
    assert res.status_code == 403 and res.json()["error_code"] == "kyc_required"
    run_sql("update core.users set kyc_status = 'APPROVED' where email = $1", TRADER)

    assert _withdraw(client, trader).json()["error_code"] == "insufficient_balance"
    a = _deposit(client, trader, amount=100).json()["request_id"]
    client.post(f"/api/v1/admin/wallets/deposits/{a}/approve", headers=admin_headers)

    assert _withdraw(client, trader, amount=5).json()["error_code"] == "amount_below_minimum"
    assert _withdraw(client, trader, wallet_address="0x123").json()["error_code"] == "invalid_address"
    assert _withdraw(client, trader, network="ETH").json()["error_code"] == "invalid_address"
    assert _withdraw(client, trader, amount=100.01).json()["error_code"] == "insufficient_balance"


def test_withdraw_approve_and_reject(client, admin_headers, trader):  # noqa: F811
    dep = _deposit(client, trader, amount=100).json()["request_id"]
    client.post(f"/api/v1/admin/wallets/deposits/{dep}/approve", headers=admin_headers)

    res = _withdraw(client, trader, amount=60)
    assert res.status_code == 200, res.text
    w1 = res.json()
    assert w1["status"] == "REQUESTED" and w1["fee"] == 1.0 and w1["network"] == "TRC20"
    assert _balance(client, trader) == 40  # 신청 즉시 차감

    w2 = _withdraw(client, trader, amount=40).json()
    assert _balance(client, trader) == 0

    summary = client.get("/api/v1/admin/wallets/requests/summary", headers=admin_headers).json()
    assert summary["withdraw_pending_count"] == 2 and summary["deposit_pending_count"] == 0

    pend = client.get("/api/v1/admin/wallets/requests/pending", headers=admin_headers).json()["items"][0]
    assert pend["source"] == "WITHDRAW_REQ" and pend["direction"] == "OUT" and pend["fee"] == 1.0
    assert pend["wallet_address"] == TRC_ADDR and pend["amount"] == 60.0

    url = "/api/v1/admin/wallets/withdrawals"
    assert client.post(f"{url}/{w1['request_id']}/approve", headers=admin_headers, json={"tx_hash": ""}).status_code == 422
    res = client.post(f"{url}/{w1['request_id']}/approve", headers=admin_headers, json={"tx_hash": "0xsent"})
    assert res.status_code == 200 and res.json()["status"] == "APPROVED" and res.json()["tx_hash"] == "0xsent"
    assert _balance(client, trader) == 0

    res = client.post(f"{url}/{w2['request_id']}/reject", headers=admin_headers, json={"note": "Wrong address"})
    assert res.json()["status"] == "REJECTED"
    assert _balance(client, trader) == 40  # 반려 시 되돌림
    assert client.post(f"{url}/{w2['request_id']}/approve", headers=admin_headers,
                       json={"tx_hash": "x"}).json()["error_code"] == "invalid_status"

    totals = client.get("/api/v1/admin/wallets/requests/history/totals", headers=admin_headers).json()
    assert totals == {"total_deposit_amount": 100.0, "total_withdraw_amount": 60.0}  # 반려 출금 제외, 수수료 포함
    assert client.get("/api/v1/admin/wallets/requests/history/totals", headers=admin_headers,
                      params={"keyword": TRC_ADDR}).json()["total_withdraw_amount"] == 60.0

    assert _ledger_balanced() and _user_wallet_liability() == Decimal("40.00")
    rows = run_sql("select account_code, sum(credit - debit) v from core.journal_lines group by 1 order by 1")
    by = {r["account_code"]: r["v"] for r in rows}
    assert by["ASSET:CASH"] == Decimal("-41.00")  # 차변 잔액: 100 입금 - 59 송금
    assert by["REVENUE:WITHDRAWAL_FEE"] == Decimal("1.00")
    assert by["LIABILITY:WITHDRAWAL_PENDING"] == Decimal("0.00")

    # 웹 거래 내역
    hist = client.get("/api/v1/wallets/me/transactions", headers=trader).json()
    assert [(i["tx_type"], i["display_status"]) for i in hist["items"]] == [
        ("WITHDRAW", "Failed"), ("WITHDRAW", "Completed"), ("DEPOSIT", "Completed"),
    ]
    top = hist["items"][0]
    assert top["withdraw"] == 40.0 and top["deposit"] is None and top["fee"] == 1.0
    assert top["reject_reason"] == "Wrong address" and top["address"] == TRC_ADDR
    assert hist["items"][1]["txid"] == "0xsent"
    only_dep = client.get("/api/v1/wallets/me/transactions", headers=trader, params={"category": "DEPOSIT"}).json()
    assert only_dep["total"] == 1 and only_dep["items"][0]["deposit"] == 100.0
    assert client.get("/api/v1/wallets/me/transactions", headers=trader,
                      params={"status": "Failed"}).json()["total"] == 1
    assert client.get("/api/v1/wallets/me/transactions", headers=trader,
                      params={"start_date": "20000101", "end_date": "20000102"}).json()["total"] == 0

    # 이력은 고칠 수 없다
    with pytest.raises(Exception):
        run_sql("update core.wallet_transactions set amount = 1")


def test_withdraw_with_email_code(client, admin_headers, trader, sent_emails):  # noqa: F811
    run_sql("update core.users set is_email_enabled = true where email = $1", TRADER)
    dep = _deposit(client, trader, amount=50).json()["request_id"]
    client.post(f"/api/v1/admin/wallets/deposits/{dep}/approve", headers=admin_headers)

    assert _withdraw(client, trader, amount=20).json()["error_code"] == "verification_code_required"

    send = "/api/v1/auth/email/send-verification"
    assert client.post(send, json={"email": TRADER, "purpose": "WITHDRAW_REQUEST"}).status_code == 401
    other = client.post(send, headers=trader, json={"email": "x@example.com", "purpose": "WITHDRAW_REQUEST"})
    assert other.json()["error_code"] == "email_mismatch"
    assert client.post(send, headers=trader, json={"email": TRADER, "purpose": "WITHDRAW_REQUEST"}).status_code == 201
    code = sent_emails[-1]["code"]
    assert sent_emails[-1]["purpose"] == "WITHDRAW_REQUEST"

    wrong = code[:-1] + str((int(code[-1]) + 1) % 10)
    assert _withdraw(client, trader, amount=20, verification_code=wrong).json()["error_code"] == "invalid_verification_code"
    assert _withdraw(client, trader, amount=20, verification_code=code).status_code == 200
    # 같은 코드는 한 번만
    assert _withdraw(client, trader, amount=20, verification_code=code).json()["error_code"] == "verification_code_expired"
    assert _balance(client, trader) == 30


def test_payout_settings(client, admin_headers, trader):  # noqa: F811
    url = "/api/v1/admin/payout-settings/network-fees"
    assert client.get(url, headers=trader).status_code == 403
    nets = client.get(url, headers=admin_headers).json()
    assert len(nets) == 6

    body = {"networks": [{"name": "TRC20", "desc": "Tron", "fee": 2.5, "is_active": True},
                         {"name": "ETH", "desc": "Ethereum", "fee": 7, "is_active": False}]}
    res = client.put(url, headers=admin_headers, json=body)
    assert res.status_code == 200 and res.json()[0]["fee"] == 2.5
    dup = client.put(url, headers=admin_headers, json={"networks": [{"name": "TRC20"}, {"name": "trc-20"}]})
    assert dup.json()["error_code"] == "duplicate_network"

    user_nets = client.get("/api/v1/payouts/config/networks", headers=trader).json()
    assert [n["name"] for n in user_nets] == ["TRC20"]
    assert _deposit(client, trader, network="ETH").json()["error_code"] == "unsupported_network"

    ps = "/api/v1/admin/payout-settings/profit-split"
    assert client.get(ps, headers=admin_headers).json() == {"trader_pct": 80.0, "company_pct": 20.0}
    assert client.put(ps, headers=admin_headers, json={"trader_pct": 40}).status_code == 422
    assert client.put(ps, headers=admin_headers, json={"trader_pct": 85}).json() == {"trader_pct": 85.0, "company_pct": 15.0}
    hist = client.get(f"{ps}/history", headers=admin_headers).json()
    assert hist["total"] == 1 and hist["items"][0]["old_pct"] == 80 and hist["items"][0]["admin_email"] == ADMIN_EMAIL


def test_admin_member_list_total_assets(client, admin_headers, trader):  # noqa: F811
    """백오피스 회원 목록·상세의 총 자산은 통합 지갑 잔액이다."""
    def listed():
        items = client.get("/api/v1/admin/users", headers=admin_headers, params={"keyword": TRADER}).json()["items"]
        return items[0]["total_assets"]

    assert listed() == 0.0  # 지갑이 아직 없는 회원
    req = _deposit(client, trader, amount=250.75, tx_hash="hash-total").json()["request_id"]
    assert client.post(f"/api/v1/admin/wallets/deposits/{req}/approve", headers=admin_headers).status_code == 200
    assert listed() == 250.75
    user_id = run_sql("select id from core.users where email = $1", TRADER)[0]["id"]
    assert client.get(f"/api/v1/admin/users/{user_id}", headers=admin_headers).json()["total_assets"] == 250.75
