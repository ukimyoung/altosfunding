"""챌린지 티켓 구매: 결제·주문, Worker의 MT4 계좌 발급(모의 MT4 서버), 실패 시 환불, 대회 시작·종료 잠금."""

import asyncio
import json
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

import httpx
import pytest

from app.config import settings
from app.services import mt4
from tests.conftest import run_sql
from tests.test_admin_users import _create, admin_headers  # noqa: F401
from tests.test_catalog import _product
from tests.test_login import _login, member  # noqa: F401

BUYER = "buyer@example.com"
POOL_START = 10000001


class FakeMt4:
    """MT4 API 모의 서버 (httpx.MockTransport)."""

    def __init__(self) -> None:
        self.accounts: dict[int, dict] = {}
        self.calls: list[tuple[str, str, dict | None]] = []
        self.create_errors: list[tuple[int, dict | str]] = []  # 다음 생성 요청들이 돌려줄 오류
        self.create_then_timeout = 0  # 계좌는 만들고 응답은 타임아웃으로 끊을 횟수
        self.balance_errors: list[int] = []
        self.api_key_seen: set[str] = set()

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.api_key_seen.add(request.headers.get("X-API-KEY", ""))
        path = request.url.path
        body = json.loads(request.content) if request.content else None
        self.calls.append((request.method, path, body))
        parts = path.strip("/").split("/")  # api mt4 accounts ...
        if path == "/api/mt4/accounts/create":
            if self.create_errors:
                status, payload = self.create_errors.pop(0)
                return httpx.Response(status, json=payload) if isinstance(payload, dict) else httpx.Response(status, text=payload)
            login = body["login"]
            if login in self.accounts:
                return httpx.Response(400, json={"code": "ValidationError", "errors": [{"message": "Account already exists"}]})
            self.accounts[login] = {
                "login": login, "name": body["name"], "email": body["email"], "comment": body["comment"],
                "group": body["group"], "leverage": body["leverage"], "balance": 0.0,
                "isReadOnly": body["stateIsReadOnly"], "pool": body["accountsPool"],
            }
            if self.create_then_timeout:
                self.create_then_timeout -= 1
                raise httpx.ReadTimeout("timeout", request=request)
            return httpx.Response(200, json={"login": login})
        login = int(parts[3])
        if request.method == "GET" and len(parts) == 4:
            if login not in self.accounts:
                return httpx.Response(404, json={"code": "NotFound"})
            return httpx.Response(200, json=self.accounts[login])
        if parts[4:] == ["balance"]:
            if self.balance_errors:
                return httpx.Response(self.balance_errors.pop(0), json={"code": "MtServerError"})
            self.accounts[login]["balance"] += body["value"]
            return httpx.Response(200, json={"orderId": 5000 + login % 1000})
        if parts[4:] == ["readonly"]:
            self.accounts[login]["isReadOnly"] = body["value"]
            return httpx.Response(200)
        return httpx.Response(404)

    def creates(self) -> int:
        return sum(1 for m, p, _ in self.calls if p == "/api/mt4/accounts/create")

    def deposits(self) -> int:
        return sum(1 for m, p, _ in self.calls if p.endswith("/balance") and m == "POST")


@pytest.fixture
def fake_mt4(monkeypatch):
    fake = FakeMt4()
    monkeypatch.setattr(settings, "mt4_demo_base_url", "https://mt4-demo.test")
    monkeypatch.setattr(settings, "mt4_demo_api_key", "demo-key")
    mt4.set_transport(httpx.MockTransport(fake.handler))
    yield fake
    mt4.set_transport(None)


@pytest.fixture
def buyer(client, admin_headers):  # noqa: F811
    _create(client, admin_headers, email=BUYER, first_name="김", last_name="철수")
    token = _login(client, email=BUYER, password="Target123!").json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    req = client.post("/api/v1/wallets/me/deposit", headers=headers,
                      json={"amount": 300, "tx_hash": "0xbuyer", "network": "TRC20"}).json()["request_id"]
    assert client.post(f"/api/v1/admin/wallets/deposits/{req}/approve", headers=admin_headers).status_code == 200
    return headers


@pytest.fixture
def round_(client, admin_headers):  # noqa: F811
    product = _product(client, admin_headers, name="Challenge Starter", price_usdt=100, discount_price_usdt=80,
                       capital=100000, mt4_login_pool_start=POOL_START, mt4_login_pool_end=POOL_START + 9)
    assert product.status_code == 200, product.text
    pid = product.json()["product_id"]
    start = datetime.now(UTC) + timedelta(days=1)
    res = client.post("/api/v1/admin/challenges", headers=admin_headers, json={
        "product_id": pid, "name": "Starter #1", "group_size": 3,
        "start_at": start.isoformat(), "end_at": (start + timedelta(days=5)).isoformat(),
    })
    assert res.status_code == 200, res.text
    return {"product_id": pid, "challenge_id": res.json()["challenge_id"]}


def _join(client, headers, challenge_id, quantity=1, **extra):
    return client.post(f"/api/v1/challenges/{challenge_id}/join", headers=headers, json={"quantity": quantity, **extra})


def _work(rounds=1):
    """Worker의 작업 큐 처리를 rounds번 돌린다. 재시도 대기는 건너뛴다."""
    from app import db
    from app.jobs import mt4 as _handlers  # noqa: F401  처리기 등록
    from app.worker import run_job_queue

    db.get_engine()
    for _ in range(rounds):
        run_sql("update core.jobs set run_at = now() - interval '1 second' where status = 'PENDING'")
        asyncio.run(run_job_queue(db._sessionmaker))


def _balance(client, headers):
    return client.get("/api/v1/accounts/my-asset", headers=headers).json()["total_asset"]


def _ledger():
    rows = run_sql("select account_code, sum(credit - debit) v from core.journal_lines group by account_code")
    sums = {r["account_code"]: float(r["v"]) for r in rows}
    total = run_sql("select coalesce(sum(debit),0) d, coalesce(sum(credit),0) c from core.journal_lines")[0]
    assert total["d"] == total["c"]
    return sums


def test_purchase_validation(client, buyer, round_, fake_mt4):
    cid = round_["challenge_id"]
    assert _join(client, buyer, cid, coupon_code="SALE10").json()["error_code"] == "coupon_not_supported"
    assert _join(client, buyer, cid, quantity=11).status_code == 422
    assert _join(client, buyer, "CHAL_NOPE").status_code == 404
    full = _join(client, buyer, cid, quantity=4)
    assert full.status_code == 409 and full.json()["error_code"] == "challenge_full"
    # 잔고 300, 단가 80(할인가) → 3개 240은 되지만 정원 3을 넘는 건 위에서 막혔다. 정원을 늘리고 4개면 잔고 부족
    run_sql("update core.challenges set group_size = null")
    poor = _join(client, buyer, cid, quantity=4)
    assert poor.status_code == 400 and poor.json()["error_code"] == "insufficient_balance"
    run_sql("update core.challenges set start_at = now() - interval '1 minute'")
    assert _join(client, buyer, cid).json()["error_code"] == "challenge_already_started"
    assert run_sql("select count(*) n from core.challenge_orders")[0]["n"] == 0
    assert fake_mt4.calls == []


def test_purchase_issue_start_close(client, admin_headers, buyer, round_, fake_mt4, sent_emails):  # noqa: F811
    cid = round_["challenge_id"]
    sent_emails.clear()
    # 두 번째 번호는 MT4에 이미 있다 → 건너뛰고 블랙리스트
    fake_mt4.accounts[POOL_START + 1] = {"login": POOL_START + 1, "email": "other@x.com", "comment": "", "balance": 0}

    res = _join(client, buyer, cid, quantity=2)
    assert res.status_code == 201, res.text
    order = res.json()
    assert order["status"] == "PENDING" and order["quantity"] == 2
    assert order["unit_price"] == 80 and order["total_price"] == 160 and order["discount_amount"] == 40
    assert order["total_asset"] == 140
    assert [a["provision_status"] for a in order["accounts"]] == ["QUEUED", "QUEUED"]
    assert fake_mt4.calls == []  # 결제 요청 안에서는 MT4를 부르지 않는다
    assert [m["purpose"] for m in sent_emails] == ["challenge_applied"]
    assert _ledger()["LIABILITY:ORDER_PENDING"] == 160
    assert run_sql("select current_participants n from core.challenges")[0]["n"] == 2

    _work()
    detail = client.get(f"/api/v1/challenges/orders/{order['order_id']}", headers=buyer).json()
    assert detail["status"] == "COMPLETED" and detail["issued_quantity"] == 2
    logins = sorted(a["mt4_login"] for a in detail["accounts"])
    assert logins == [POOL_START, POOL_START + 2]
    assert {a["provision_status"] for a in detail["accounts"]} == {"DONE"}
    for login in logins:
        acc = fake_mt4.accounts[login]
        assert acc["balance"] == 100000 and acc["isReadOnly"] is True
        assert acc["comment"] and acc["email"] == BUYER
        assert acc["name"] == "김 철수".encode("cp949").decode("latin-1")
        assert acc["pool"] == {"loginsPoolStart": POOL_START, "loginsPoolEnd": POOL_START + 9}
    assert fake_mt4.api_key_seen == {"demo-key"}
    status = {r["mt4_login"]: r["status"] for r in run_sql("select mt4_login, status from core.mt4_logins")}
    assert status == {POOL_START: "IN_USE", POOL_START + 1: "BLACKLISTED", POOL_START + 2: "IN_USE"}
    ledger = _ledger()
    assert ledger["LIABILITY:ORDER_PENDING"] == 0 and ledger["REVENUE:CHALLENGE_SALES"] == 160
    _work()  # 발급 메일 작업
    issued = [m for m in sent_emails if m["purpose"] == "challenge_account_issued"]
    assert len(issued) == 2 and all(m["email"] == BUYER for m in issued)

    # 대회 시작 전(거래 잠금)에도 발급된 계좌 비밀번호는 본인에게 보인다
    accounts = client.get("/api/v1/accounts", headers=buyer, params={"tier": "CHALLENGE"}).json()
    assert accounts["total"] == 2
    assert {a["status"] for a in accounts["items"]} == {"PENDING"}
    assert all(a["mt4_password"] and a["mt4_server"] == "MexnLimited-Demo" and a["product_name"] == "Challenge Starter" for a in accounts["items"])
    summary = client.get("/api/v1/accounts/challenge-summary", headers=buyer).json()
    assert summary["total_challenges"] == 2 and summary["by_product"][0]["count"] == 2
    # my-asset 경로가 계좌 상세 경로와 겹치지 않는다
    assert _balance(client, buyer) == 140

    # 관리자 화면
    listed = client.get("/api/v1/admin/challenges/orders", headers=admin_headers, params={"keyword": "buyer"}).json()
    assert listed["total"] == 1
    row = listed["items"][0]
    assert row["product_name"] == "Challenge Starter" and row["unit_price"] == 80 and row["quantity"] == 2
    assert row["status"] == "COMPLETED" and row["user_nickname"] == "김 철수"
    summary = client.get("/api/v1/admin/challenges/orders/summary", headers=admin_headers).json()
    assert summary["total_orders"] == 1 and summary["total_payment"] == 160 and summary["total_refunds"] == 0
    admin_detail = client.get(f"/api/v1/admin/challenges/orders/{order['order_id']}", headers=admin_headers).json()
    assert len(admin_detail["accounts"]) == 2
    sales = client.get("/api/v1/admin/reports/sales/challenge", headers=admin_headers,
                       params={"period": "monthly"}).json()
    assert sales["summary"]["quantity"] == 2 and sales["summary"]["amount"] == 160
    assert sales["items"][0]["products"][round_["product_id"]] == {"quantity": 2, "amount": 160}
    assert client.get("/api/v1/admin/reports/sales/challenge", headers=admin_headers).json()["error_code"] == "period_required"
    funded = client.get("/api/v1/admin/reports/sales/funded", headers=admin_headers, params={"period": "weekly"})
    assert funded.status_code == 200 and funded.json()["items"] == []

    # 대회 시작 → 거래 잠금 해제
    assert client.post(f"/api/v1/admin/challenges/{cid}/start", headers=admin_headers).status_code == 200
    _work()
    assert all(fake_mt4.accounts[login]["isReadOnly"] is False for login in logins)
    accounts = client.get("/api/v1/accounts", headers=buyer).json()["items"]
    assert {a["status"] for a in accounts} == {"ACTIVE"}
    assert all(a["mt4_password"] and not a["is_read_only"] for a in accounts)
    detail = client.get(f"/api/v1/accounts/{accounts[0]['account_id']}", headers=buyer)
    assert detail.status_code == 200 and detail.json()["leverage"] == 100

    # 대회 종료 → 다시 잠금
    assert client.post(f"/api/v1/admin/challenges/{cid}/close", headers=admin_headers).status_code == 200
    _work()
    assert all(fake_mt4.accounts[login]["isReadOnly"] is True for login in logins)
    assert {a["status"] for a in client.get("/api/v1/accounts", headers=buyer).json()["items"]} == {"CLOSED"}


def test_failed_provision_refunds(client, admin_headers, buyer, round_, fake_mt4):  # noqa: F811
    order = _join(client, buyer, round_["challenge_id"], quantity=2).json()
    assert _balance(client, buyer) == 140
    # 첫 계좌는 정상, 두 번째 계좌는 MT4가 계속 응답하지 않는다(500)
    fake_mt4.create_errors = [(500, {"code": "MtServerError"})] * 20
    original = fake_mt4.handler

    issued_first = {"done": False}

    def handler(request):
        if request.url.path == "/api/mt4/accounts/create" and not issued_first["done"]:
            issued_first["done"] = True
            saved, fake_mt4.create_errors = fake_mt4.create_errors, []
            try:
                return original(request)
            finally:
                fake_mt4.create_errors = saved
        return original(request)

    mt4.set_transport(httpx.MockTransport(handler))
    _work(rounds=9)
    detail = client.get(f"/api/v1/challenges/orders/{order['order_id']}", headers=buyer).json()
    assert detail["issued_quantity"] == 1 and detail["refunded_quantity"] == 1 and detail["refunded_amount"] == 80
    assert detail["status"] == "COMPLETED"
    failed = [a for a in detail["accounts"] if a["provision_status"] == "FAILED"]
    assert len(failed) == 1 and failed[0]["status"] == "CANCELLED"
    assert _balance(client, buyer) == 220
    ledger = _ledger()
    assert ledger["LIABILITY:ORDER_PENDING"] == 0 and ledger["REVENUE:CHALLENGE_SALES"] == 80
    refund = run_sql("select is_reversal, reversed_entry_id from core.journal_entries where entry_type = 'CHALLENGE_REFUND'")
    assert len(refund) == 1 and refund[0]["is_reversal"] and refund[0]["reversed_entry_id"]
    # 생성 요청이 응답 없이 끝났으므로 MT4에 생겼을 수 있다 → 정리 대상
    assert run_sql("select count(*) n from core.mt4_logins where status = 'ORPHANED'")[0]["n"] == 1
    assert run_sql("select current_participants n from core.challenges")[0]["n"] == 1
    job = run_sql("select status, attempts from core.jobs where kind = 'mt4.provision_challenge_account' and status = 'FAILED'")
    assert len(job) == 1 and job[0]["attempts"] == 8
    # 환불·실패 계좌는 계좌 목록에서 빠진다
    assert client.get("/api/v1/accounts", headers=buyer).json()["total"] == 1
    summary = client.get("/api/v1/admin/challenges/orders/summary", headers=admin_headers).json()
    assert summary["total_payment"] == 80 and summary["total_refunds"] == 1


def test_all_failed_order_is_refunded(client, buyer, round_, fake_mt4):
    order = _join(client, buyer, round_["challenge_id"]).json()
    fake_mt4.create_errors = [(400, {"code": "ValidationError", "errors": [{"message": "Invalid name"}]})]
    _work()
    detail = client.get(f"/api/v1/challenges/orders/{order['order_id']}", headers=buyer).json()
    assert detail["status"] == "REFUNDED" and detail["refunded_quantity"] == 1
    assert _balance(client, buyer) == 300
    # 생성 거부(응답 받음)라 MT4에는 없다 → 정리 대상 아님
    assert run_sql("select status from core.mt4_logins")[0]["status"] == "BLACKLISTED"


def test_timeout_after_create_does_not_duplicate(client, buyer, round_, fake_mt4):
    order = _join(client, buyer, round_["challenge_id"]).json()
    fake_mt4.create_then_timeout = 1  # MT4에는 만들어졌지만 응답이 끊겼다
    fake_mt4.balance_errors = [503]  # 첫 입금도 실패
    _work()
    assert fake_mt4.creates() == 1 and fake_mt4.accounts[POOL_START]["balance"] == 0
    _work()  # GET으로 생성 확인 → 입금 재시도는 실패(503)
    _work()  # 입금 성공
    detail = client.get(f"/api/v1/challenges/orders/{order['order_id']}", headers=buyer).json()
    assert detail["status"] == "COMPLETED" and detail["accounts"][0]["mt4_login"] == POOL_START
    assert fake_mt4.creates() == 1 and fake_mt4.accounts[POOL_START]["balance"] == 100000
    assert len(fake_mt4.accounts) == 1


def test_duplicate_login_rejection_uses_next_number(client, buyer, round_, fake_mt4):
    order = _join(client, buyer, round_["challenge_id"]).json()
    fake_mt4.create_errors = [(400, {"code": "ValidationError", "errors": [{"message": "Account already exists"}]})]
    _work()
    detail = client.get(f"/api/v1/challenges/orders/{order['order_id']}", headers=buyer).json()
    assert detail["status"] == "COMPLETED" and detail["accounts"][0]["mt4_login"] == POOL_START + 1
    rows = {r["mt4_login"]: r["status"] for r in run_sql("select mt4_login, status from core.mt4_logins")}
    assert rows == {POOL_START: "BLACKLISTED", POOL_START + 1: "IN_USE"}


def test_pool_exhausted_refunds(client, admin_headers, buyer, round_, fake_mt4):  # noqa: F811
    run_sql("update core.products set last_mt4_login = mt4_login_pool_end")
    order = _join(client, buyer, round_["challenge_id"]).json()
    _work()
    detail = client.get(f"/api/v1/challenges/orders/{order['order_id']}", headers=buyer).json()
    assert detail["status"] == "REFUNDED"
    assert "범위" in run_sql("select provision_error e from core.trading_accounts")[0]["e"]
    assert fake_mt4.creates() == 0


def test_mt4_not_configured_retries(client, buyer, round_, monkeypatch):
    monkeypatch.setattr(settings, "mt4_demo_base_url", "")
    _join(client, buyer, round_["challenge_id"])
    _work()
    job = run_sql("select status, attempts, last_error from core.jobs where kind = 'mt4.provision_challenge_account'")[0]
    assert job["status"] == "PENDING" and "MT4_DEMO_BASE_URL" in job["last_error"]


def test_orders_are_private(client, admin_headers, buyer, round_, fake_mt4):  # noqa: F811
    order = _join(client, buyer, round_["challenge_id"]).json()
    _create(client, admin_headers, email="other@example.com")
    other = {"Authorization": f"Bearer {_login(client, email='other@example.com', password='Target123!').json()['access_token']}"}
    assert client.get(f"/api/v1/challenges/orders/{order['order_id']}", headers=other).status_code in (403, 404)
    mine = client.get("/api/v1/challenges/orders/me", headers=buyer).json()
    assert mine["total"] == 1 and mine["items"][0]["order_id"] == order["order_id"]
    # 구매 내역 화면 필터: 상품명 검색, 기존 상태값 processing, 날짜(YYYYMMDD)
    def find(**params):
        return client.get("/api/v1/challenges/orders/me", headers=buyer, params=params).json()["total"]
    assert find(search="Starter") == 1 and find(search="Elite") == 0
    assert find(status="processing") == 1 and find(status="COMPLETED") == 0
    today = datetime.now(ZoneInfo("Asia/Seoul")).strftime("%Y%m%d")
    assert find(start_date=today, end_date=today) == 1 and find(start_date="20000101", end_date="20000102") == 0
    assert client.get("/api/v1/admin/challenges/orders", headers=buyer).status_code == 403


def test_issued_after_start_is_unlocked(client, admin_headers, buyer, round_, fake_mt4):  # noqa: F811
    """발급이 늦어 그 사이 대회가 시작됐으면 발급하면서 거래를 풀어 준다."""
    _join(client, buyer, round_["challenge_id"])
    assert client.post(f"/api/v1/admin/challenges/{round_['challenge_id']}/start", headers=admin_headers).status_code == 200
    _work(rounds=2)
    account = client.get("/api/v1/accounts", headers=buyer).json()["items"][0]
    assert account["status"] == "ACTIVE" and account["is_read_only"] is False
    assert fake_mt4.accounts[POOL_START]["isReadOnly"] is False


def test_worker_start_unlocks_accounts(client, buyer, round_, fake_mt4):
    """Worker의 주기 작업이 대회를 시작하면 계좌 잠금 해제 작업이 들어간다."""
    from tests.test_challenges import _run_jobs

    _join(client, buyer, round_["challenge_id"])
    _work()
    assert fake_mt4.accounts[POOL_START]["isReadOnly"] is True
    counts = _run_jobs(datetime.now(UTC) + timedelta(days=1, minutes=1))
    assert counts["started"] == 1
    _work()
    assert fake_mt4.accounts[POOL_START]["isReadOnly"] is False


def test_mt4_base_url_and_connection_check(monkeypatch):
    """Swagger 화면 주소를 넣어도 API 주소로 맞추고, Worker 연결 확인은 실제 API 경로·X-API-KEY로 부른다."""
    from app import worker

    assert mt4.normalize_base_url("https://mexn-mt4-alto-demo.tfb-api.com/index.html") == "https://mexn-mt4-alto-demo.tfb-api.com"
    assert mt4.normalize_base_url("https://h.example.com/swagger/") == "https://h.example.com"
    assert mt4.normalize_base_url("https://h.example.com/") == "https://h.example.com"

    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append((request.url.host, request.url.path, request.headers.get("X-API-KEY")))
        if request.headers.get("X-API-KEY") != "good":
            return httpx.Response(403, json={"message": "Forbidden"})
        return httpx.Response(200, json="2026-11-18T00:00:00")

    monkeypatch.setattr(settings, "mt4_demo_base_url", "https://demo.example.com/index.html")
    monkeypatch.setattr(settings, "mt4_demo_api_key", "good")
    monkeypatch.setattr(settings, "mt4_live_base_url", "https://live.example.com")
    monkeypatch.setattr(settings, "mt4_live_api_key", "bad")
    mt4.set_transport(httpx.MockTransport(handler))
    try:
        result = asyncio.run(worker.check_mt4())
    finally:
        mt4.set_transport(None)
    assert result == {"demo": "OK", "live": "실패 HTTP 403"}
    assert seen == [("demo.example.com", "/api/mt4/server/time", "good"), ("live.example.com", "/api/mt4/server/time", "bad")]
