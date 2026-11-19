"""MT4 거래 내역·잔고 수집 (Worker 주기 작업): 모의 MT4 서버로 저장·중복 방지·커서·실패·종료 후 마지막 수집을 확인한다."""

import asyncio
import json
from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qs

import httpx
import pytest

from app.config import settings
from app.services import mt4, mt4_ingest
from tests.conftest import run_sql
from tests.test_admin_users import admin_headers  # noqa: F401
from tests.test_login import member  # noqa: F401
from tests.test_challenge_orders import POOL_START, _join, _work, buyer, fake_mt4, round_  # noqa: F401

LOGIN = POOL_START


def _order(order, type_="Buy", close="2026-11-19T09:30:00Z", profit=100.0, **extra):
    return {
        "order": order, "login": LOGIN, "symbol": "EURUSD", "type": type_, "volume": 1.0,
        "dateOpen": "2026-11-19T09:00:00Z", "priceOpen": 1.1, "dateClose": close, "priceClose": 1.101 if close else None,
        "commission": -2.5, "swap": -0.5, "taxes": 0, "profit": profit, "stopLoss": 0, "takeProfit": 0,
        "comment": None, "reason": "Client", "contractSize": 100000, **extra,
    }


class Broker:
    """수집용 MT4 API 응답 (orders/all, balances, balance). 나머지는 계좌 발급용 FakeMt4로 넘긴다."""

    def __init__(self, fake) -> None:
        self.fake = fake
        self.orders: dict[int, list[dict]] = {}
        self.balances: dict[int, dict] = {}
        self.bulk_fails = False
        self.bulk_skip: set[int] = set()
        self.orders_errors: dict[int, int] = {}
        self.queries: list[dict] = []
        self.paths: list[str] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path == "/api/mt4/accounts/balances":
            self.paths.append(path)
            if self.bulk_fails:
                return httpx.Response(404, json={"code": "NotFound"})
            logins = json.loads(request.content)["logins"]
            return httpx.Response(200, json={"balances": [
                self.balances[x] for x in logins if x in self.balances and x not in self.bulk_skip
            ]})
        parts = path.strip("/").split("/")
        if len(parts) >= 5 and parts[4:] == ["orders", "all"]:
            login = int(parts[3])
            self.paths.append(path)
            self.queries.append({k: v[0] for k, v in parse_qs(request.url.query.decode()).items()})
            if login in self.orders_errors:
                return httpx.Response(self.orders_errors[login], json={"code": "MtServerError"})
            return httpx.Response(200, json=self.orders.get(login, []))
        if len(parts) == 5 and parts[4] == "balance" and request.method == "GET":
            login = int(parts[3])
            self.paths.append(path)
            if login not in self.balances:
                return httpx.Response(404, json={"code": "NotFound"})
            return httpx.Response(200, json=self.balances[login])
        return self.fake.handler(request)


def _bal(login, balance, equity, **extra):
    return {"login": login, "balance": balance, "equity": equity, "credit": 0, "margin": 10, "marginFree": equity - 10,
            "marginLevel": 1000.5, **extra}


@pytest.fixture
def broker(fake_mt4):  # noqa: F811
    b = Broker(fake_mt4)
    mt4.set_transport(httpx.MockTransport(b.handler))
    yield b


@pytest.fixture
def active(client, admin_headers, buyer, round_, broker):  # noqa: F811
    """발급이 끝나 대회가 시작된(ACTIVE) 계좌 2개."""
    assert _join(client, buyer, round_["challenge_id"], quantity=2).status_code == 201
    _work(rounds=2)
    assert client.post(f"/api/v1/admin/challenges/{round_['challenge_id']}/start", headers=admin_headers).status_code == 200
    _work()
    rows = run_sql("select id, mt4_login from core.trading_accounts where status = 'ACTIVE' order by mt4_login")
    assert len(rows) == 2
    return {r["mt4_login"]: str(r["id"]) for r in rows}


def _ingest(now=None):
    from app import db

    db.get_engine()
    return asyncio.run(mt4_ingest.run(db._sessionmaker, now))


def _sync(account_id):
    return run_sql("select * from core.trading_account_sync where account_id = $1", __import__("uuid").UUID(account_id))[0]


def test_collects_trades_balance_and_shows_them(client, admin_headers, buyer, active, broker):  # noqa: F811
    other = POOL_START + 1
    broker.orders[LOGIN] = [
        _order(9001, "Balance", close="2026-11-19T08:00:00Z", profit=100000, symbol=None, volume=0),
        _order(9002, "Buy", close="2026-11-19T09:30:00Z", profit=120),
        _order(9003, "Sell", close="2026-11-19T10:15:00Z", profit=-20),
        _order(9004, "Buy", close=None, profit=5),  # 열린 포지션
        _order(9005, "BuyLimit", close="1970-01-01T00:00:00Z", profit=0),  # 대기 주문(청산 시각 없음)
    ]
    broker.balances[LOGIN] = _bal(LOGIN, 100097, 100102)
    broker.balances[other] = _bal(other, 100000, 100000)

    result = _ingest()
    assert result == {"accounts": 2, "ok": 2, "failed": 0, "trades": 5, "unconfigured": 0}
    # 잔고는 일괄 조회 한 번으로 받는다
    assert broker.paths.count("/api/mt4/accounts/balances") == 1
    assert not any(p.endswith("/balance") for p in broker.paths)

    rows = {r["mt4_order"]: r for r in run_sql("select * from core.trading_account_trades where mt4_login = $1", LOGIN)}
    assert set(rows) == {9001, 9002, 9003, 9004, 9005}
    assert rows[9001]["action"] == "BALANCE" and not rows[9001]["is_open"]
    assert rows[9004]["is_open"] and rows[9004]["close_time"] is None
    assert rows[9005]["is_open"] and rows[9005]["action"] == "BUY"
    assert rows[9002]["close_time"] == datetime(2026, 11, 19, 9, 30, tzinfo=UTC)
    assert float(rows[9002]["commission"]) == -2.5 and rows[9002]["symbol"] == "EURUSD"

    sync = _sync(active[LOGIN])
    assert sync["last_close_time"] == datetime(2026, 11, 19, 10, 15, tzinfo=UTC)
    assert sync["consecutive_failures"] == 0 and sync["last_trades_count"] == 5
    assert run_sql("select count(*) n from core.trading_account_equity_snapshots")[0]["n"] == 2

    # 웹: 잔고·평가금액·수익과 거래내역 (청산된 매수·매도만, 최신순)
    detail = client.get(f"/api/v1/accounts/{active[LOGIN]}", headers=buyer).json()
    assert detail["balance"] == 100097 and detail["equity"] == 100102
    assert detail["total_profit"] == 97 and detail["floating_profit"] == 102 and detail["available_balance"] == 97
    assert detail["equity_updated_at"]
    trades = client.get(f"/api/v1/accounts/{active[LOGIN]}/trades", headers=buyer).json()
    assert trades["total"] == 2 and [t["deal_id"] for t in trades["items"]] == [9003, 9002]
    first = trades["items"][1]
    assert first["action"] == "BUY" and first["profit"] == 120 and first["fee"] == -2.5 and first["swap"] == -0.5
    assert first["price"] == 1.1 and first["close_price"] == 1.101 and first["entry"] == "Out"

    # 다른 회원은 볼 수 없다
    from tests.test_admin_users import _create
    from tests.test_login import _login
    _create(client, admin_headers, email="stranger@example.com")
    stranger = {"Authorization": "Bearer " + _login(client, email="stranger@example.com", password="Target123!").json()["access_token"]}
    assert client.get(f"/api/v1/accounts/{active[LOGIN]}/trades", headers=stranger).status_code == 404

    # 백오피스: 계좌 UUID 또는 MT4 번호로 거래내역
    admin_trades = client.get(f"/api/v1/admin/accounts/{LOGIN}/trades", headers=admin_headers).json()
    assert admin_trades["total"] == 2 and admin_trades["pages"] == 1
    page2 = client.get(f"/api/v1/admin/accounts/{active[LOGIN]}/trades", headers=admin_headers,
                       params={"page": 2, "size": 1}).json()
    assert [t["deal_id"] for t in page2["items"]] == [9002]
    admin_detail = client.get(f"/api/v1/admin/accounts/{active[LOGIN]}", headers=admin_headers).json()
    assert admin_detail["equity"] == 100102


def test_rerun_no_duplicates_cursor_and_open_positions(active, broker, monkeypatch):
    monkeypatch.setattr(settings, "mt4_server_timezone", "Europe/Athens")
    broker.orders[LOGIN] = [_order(9002, close="2026-11-19T09:30:00Z"), _order(9004, close=None)]
    broker.balances[LOGIN] = _bal(LOGIN, 100000, 100010)
    now = datetime(2026, 11, 19, 12, 0, tzinfo=UTC)
    _ingest(now)

    # 다음 조회는 마지막 청산 시각(09:30 UTC) − 1시간을 MT4 서버 시각(아테네, UTC+2)으로 보낸다
    broker.queries.clear()
    # 열린 포지션 9004가 청산되고, 9006이 새로 열렸다
    broker.orders[LOGIN] = [
        _order(9002, close="2026-11-19T09:30:00Z"),
        _order(9004, close="2026-11-19T11:50:00Z", profit=7),
        _order(9006, close=None),
    ]
    _ingest(now + timedelta(minutes=1))
    query = next(q for q in broker.queries)
    assert query["dateFrom"] == "2026-11-19T10:30:00"
    assert query["dateTo"] == "2026-11-20T14:01:00"
    rows = {r["mt4_order"]: r for r in run_sql("select * from core.trading_account_trades where mt4_login = $1", LOGIN)}
    assert set(rows) == {9002, 9004, 9006}
    assert not rows[9004]["is_open"] and float(rows[9004]["profit"]) == 7
    assert rows[9006]["is_open"]
    assert _sync(active[LOGIN])["last_close_time"] == datetime(2026, 11, 19, 11, 50, tzinfo=UTC)

    # 열린 포지션이 응답에서 사라지면(주문 취소 등) 지운다
    broker.orders[LOGIN] = [_order(9002, close="2026-11-19T09:30:00Z")]
    _ingest(now + timedelta(minutes=2))
    orders_left = {r["mt4_order"] for r in run_sql("select mt4_order from core.trading_account_trades where mt4_login = $1", LOGIN)}
    assert orders_left == {9002, 9004}
    # 이력은 5분 간격으로만 쌓인다 (첫 수집 1건씩)
    snaps = run_sql("select count(*) n from core.trading_account_equity_snapshots where account_id = $1",
                    __import__("uuid").UUID(active[LOGIN]))[0]["n"]
    assert snaps == 1
    _ingest(now + timedelta(minutes=6))
    snaps = run_sql("select count(*) n from core.trading_account_equity_snapshots where account_id = $1",
                    __import__("uuid").UUID(active[LOGIN]))[0]["n"]
    assert snaps == 2


def test_failure_keeps_cursor_and_other_accounts(active, broker):
    other = POOL_START + 1
    broker.orders[LOGIN] = [_order(9002)]
    broker.balances[LOGIN] = _bal(LOGIN, 100120, 100120)
    _ingest()
    cursor = _sync(active[LOGIN])["last_close_time"]

    broker.orders_errors[LOGIN] = 500
    broker.orders[other] = [_order(7001)]
    broker.bulk_fails = True  # 일괄 조회가 안 되면 계좌별로 묻는다
    broker.balances[other] = _bal(other, 100050, 100050)
    result = _ingest()
    assert result["ok"] == 1 and result["failed"] == 1
    failed = _sync(active[LOGIN])
    assert failed["consecutive_failures"] == 1 and "500" in failed["last_error"]
    assert failed["last_close_time"] == cursor
    assert f"/api/mt4/accounts/{other}/balance" in broker.paths
    assert run_sql("select balance from core.trading_accounts where mt4_login = $1", other)[0]["balance"] == 100050
    _ingest()
    assert _sync(active[LOGIN])["consecutive_failures"] == 2

    del broker.orders_errors[LOGIN]
    _ingest()
    assert _sync(active[LOGIN])["consecutive_failures"] == 0


def test_after_close_final_sync_then_stop(client, admin_headers, round_, active, broker):  # noqa: F811
    broker.orders[LOGIN] = [_order(9002)]
    _ingest()
    assert client.post(f"/api/v1/admin/challenges/{round_['challenge_id']}/close", headers=admin_headers).status_code == 200
    _work()
    assert {r["status"] for r in run_sql("select status from core.trading_accounts")} == {"CLOSED"}

    now = datetime.now(UTC)
    # 종료 청산 내역이 뒤늦게 들어온다
    broker.orders[LOGIN] = [_order(9002), _order(9007, close="2026-11-19T11:00:00Z", profit=-3)]
    assert _ingest(now)["accounts"] == 2
    assert _sync(active[LOGIN])["inactive_since"] is not None and _sync(active[LOGIN])["final_synced_at"] is None
    assert run_sql("select count(*) n from core.trading_account_trades where mt4_order = 9007")[0]["n"] == 1
    # 30분이 지난 뒤 한 번 더 받고 멈춘다
    assert _ingest(now + timedelta(minutes=31))["accounts"] == 2
    assert _sync(active[LOGIN])["final_synced_at"] is not None
    assert _ingest(now + timedelta(minutes=32))["accounts"] == 0


def test_pending_and_unconfigured(client, buyer, round_, broker, monkeypatch):  # noqa: F811
    assert _join(client, buyer, round_["challenge_id"]).status_code == 201
    _work(rounds=2)
    # 대회 시작 전(PENDING) 계좌는 수집하지 않는다
    assert _ingest()["accounts"] == 0
    run_sql("update core.trading_accounts set status = 'ACTIVE'")
    monkeypatch.setattr(settings, "mt4_demo_api_key", "")
    assert _ingest() == {"accounts": 1, "ok": 0, "failed": 0, "trades": 0, "unconfigured": 1}


def test_parse_time_and_action(monkeypatch):
    monkeypatch.setattr(settings, "mt4_server_timezone", "Europe/Athens")
    assert mt4_ingest.parse_time("2026-11-19T12:00:00Z") == datetime(2026, 11, 19, 12, tzinfo=UTC)
    # 시간대가 없으면 MT4 서버 시각(아테네 겨울 UTC+2)
    assert mt4_ingest.parse_time("2026-11-19T12:00:00") == datetime(2026, 11, 19, 10, tzinfo=UTC)
    assert mt4_ingest.parse_time("1970-01-01T00:00:00") is None
    assert mt4_ingest.parse_time(None) is None and mt4_ingest.parse_time("x") is None
    assert [mt4_ingest.action_of(t) for t in ("Buy", "SellStop", "Balance", "Credit", "")] == [
        "BUY", "SELL", "BALANCE", "CREDIT", "OTHER"
    ]
