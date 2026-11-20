"""백오피스 대회 > Leaderboard: 종료일(한국 시간)이 같은 대회 계좌의 수익률 순위 (종료된 대회는 종료 시각 기준)."""

from datetime import UTC, datetime, timedelta, timezone

from tests.conftest import run_sql
from tests.test_admin_users import admin_headers  # noqa: F401
from tests.test_challenge_orders import (  # noqa: F401
    POOL_START,
    _join,
    _work,
    buyer,
    fake_mt4,
    round_,
)
from tests.test_login import member  # noqa: F401

URL = "/api/v1/admin/challenges/leaderboard/daily"
STATS = "/api/v1/admin/challenges/summary-stats"
KST = timezone(timedelta(hours=9))


def _kst_day(value: datetime) -> str:
    return value.astimezone(KST).strftime("%Y%m%d")


def _setup(client, admin_headers, buyer, round_):  # noqa: F811
    rs = client.post("/api/v1/admin/rulesets", headers=admin_headers, json={"name": "LB"})
    assert rs.status_code == 200, rs.text
    run_sql("update core.products set ruleset_id = $1 where id = $2", rs.json()["id"], round_["product_id"])
    assert _join(client, buyer, round_["challenge_id"], quantity=3).status_code == 201
    _work()
    start = datetime.now(UTC) - timedelta(days=2)
    end = datetime.now(UTC) + timedelta(days=1)
    run_sql("update core.challenges set start_at = $1, end_at = $2 where id = $3", start, end, round_["challenge_id"])
    assert client.post(f"/api/v1/admin/challenges/{round_['challenge_id']}/start", headers=admin_headers).status_code == 200
    return _kst_day(end)


def _set_equity(login, equity, at):
    run_sql("update core.trading_accounts set equity = $1, balance = $1, equity_updated_at = $2 where mt4_login = $3",
            equity, at, login)


def _snapshot(login, equity, at):
    run_sql(
        "insert into core.trading_account_equity_snapshots (account_id, taken_at, balance, equity) "
        "select id, $2, $3, $3 from core.trading_accounts where mt4_login = $1",
        login, at, equity,
    )


def _logins(body):
    return [(e["mt4_login"], e["profit_rate"]) for e in body["entries"]]


def test_leaderboard_ranks_by_profit_rate(client, admin_headers, buyer, round_, fake_mt4):  # noqa: F811
    date = _setup(client, admin_headers, buyer, round_)
    a, b, c = POOL_START, POOL_START + 1, POOL_START + 2
    now = datetime.now(UTC)

    # 진행 중: 최근 평가금액 기준
    _set_equity(a, 110000, now)
    _set_equity(b, 95000, now)
    _set_equity(c, 120000, now)
    res = client.get(URL, headers=admin_headers, params={"date": date})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["total"] == 3 and body["challenges"][0]["status"] == "ACTIVE"
    assert _logins(body) == [(c, 20.0), (a, 10.0), (b, -5.0)]
    top = body["entries"][0]
    assert top["rank"] == 1 and top["basis"] == "LATEST" and top["profit"] == 20000 and top["capital"] == 100000
    assert top["product_name"] == "Challenge Starter" and top["user_grade"] == "NORMAL"
    # 판정 전: 통과 여부 없음
    assert top["evaluation_result"] is None and top["is_passed"] is False

    # 시작일·다른 종료일로는 나오지 않는다
    start_day = _kst_day(now - timedelta(days=2))
    assert client.get(URL, headers=admin_headers, params={"date": start_day}).json()["total"] == 0
    assert client.get("/api/v1/admin/challenges/leaderboard/end-dates", headers=admin_headers).json() == [date]

    # 종료: 종료 시각 이전 값만 쓴다
    end = now - timedelta(hours=1)
    run_sql("update core.challenges set end_at = $1 where id = $2", end, round_["challenge_id"])
    date = _kst_day(end)
    _snapshot(a, 130000, end - timedelta(minutes=10))
    _snapshot(a, 50000, end + timedelta(minutes=10))  # 종료 뒤 → 무시
    _set_equity(a, 50000, now)
    _set_equity(b, 150000, now)  # 종료 뒤에 받은 값뿐 → 자본금 기준
    _snapshot(c, 105000, end - timedelta(minutes=5))
    _set_equity(c, 108000, end - timedelta(minutes=1))  # 스냅샷보다 늦은 최근 값
    body = client.get(URL, headers=admin_headers, params={"date": date, "grade": "normal"}).json()
    assert _logins(body) == [(a, 30.0), (c, 8.0), (b, 0.0)]
    assert {e["basis"] for e in body["entries"]} == {"END"}
    assert body["entries"][2]["snapshot_ts"] is None
    assert body["challenges"][0]["cutoff_at"].startswith(end.strftime("%Y-%m-%dT%H:%M"))

    stats = client.get(STATS, headers=admin_headers, params={"target_date": f"{date[:4]}-{date[4:6]}-{date[6:]}"})
    assert stats.status_code == 200, stats.text
    assert stats.json()["stats"] == {
        "total_active_participants": 3, "passed_count": 0, "vip_count": 0,
        "failed_count": 0, "withdrawn_count": 0, "passed_accounts": 0,
    }

    # 관리자가 먼저 종료했으면 그 시각이 기준
    early = end - timedelta(minutes=7)
    _snapshot(c, 105000, end - timedelta(minutes=8))
    run_sql("update core.challenges set closed_at = $1 where id = $2", early, round_["challenge_id"])
    body = client.get(URL, headers=admin_headers, params={"date": date}).json()
    assert _logins(body)[0] == (a, 30.0) and body["entries"][1]["profit_rate"] == 5.0

    # VIP 회원은 VIP 탭
    run_sql("update core.users set grade = 'VIP' where email = 'buyer@example.com'")
    assert client.get(URL, headers=admin_headers, params={"date": date, "grade": "NORMAL"}).json()["total"] == 0
    body = client.get(URL, headers=admin_headers, params={"date": date, "grade": "VIP"}).json()
    assert _logins(body) == [(a, 30.0), (c, 5.0), (b, 0.0)]
    stats = client.get(STATS, headers=admin_headers, params={"target_date": date}).json()["stats"]
    assert stats["vip_count"] == 0 and stats["passed_count"] == 0


def test_leaderboard_empty_and_validation(client, admin_headers, buyer):  # noqa: F811
    body = client.get(URL, headers=admin_headers, params={"date": "20000101"}).json()
    assert body["total"] == 0 and body["entries"] == [] and body["challenges"] == []
    assert client.get(URL, headers=admin_headers, params={"date": "2000-13-01"}).status_code == 400
    assert client.get(URL, headers=admin_headers, params={"date": "20000101", "grade": "GOLD"}).status_code == 400
    assert client.get(STATS, headers=admin_headers, params={"target_date": "2000-01-01"}).json()["stats"][
        "total_active_participants"] == 0
    assert client.get(URL, headers=buyer, params={"date": "20000101"}).status_code == 403
    assert client.get(STATS, headers=buyer, params={"target_date": "2000-01-01"}).status_code == 403


EVAL = "/api/v1/admin/challenges/leaderboard/accounts/{}/evaluate"


def _trade(login, order, action, open_time, close_time=None, profit=0):
    run_sql(
        "insert into core.trading_account_trades (account_id, mt4_order, mt4_login, type, action, is_open, "
        "open_time, close_time, profit) select id, $2, $1, $3, $3, $4, $5, $6, $7 "
        "from core.trading_accounts where mt4_login = $1",
        login, order, action, close_time is None, open_time, close_time, profit,
    )


def test_evaluate_account(client, admin_headers, buyer, round_, fake_mt4, monkeypatch):  # noqa: F811
    from app.services import challenge_evaluation as ce

    _setup(client, admin_headers, buyer, round_)
    a, b = POOL_START, POOL_START + 1
    now = datetime.now(UTC)
    end = now - timedelta(hours=1)
    run_sql("update core.challenges set end_at = $1 where id = $2", end, round_["challenge_id"])
    date = _kst_day(end)
    _snapshot(a, 112000, end - timedelta(minutes=3))
    run_sql("update core.challenges set started_at = $1 where id = $2", end - timedelta(days=1), round_["challenge_id"])
    started = end - timedelta(days=1)
    _trade(a, 1, "BUY", started + timedelta(hours=1), started + timedelta(hours=2), 500)
    _trade(a, 2, "SELL", started + timedelta(hours=3))  # 미결
    _trade(a, 3, "BALANCE", started + timedelta(hours=1), started + timedelta(hours=1), 100000)  # 입출금 제외
    _trade(a, 4, "BUY", end + timedelta(minutes=5), end + timedelta(minutes=6), 10)  # 종료 뒤 제외
    _trade(a, 5, "BUY", started - timedelta(hours=1), started + timedelta(minutes=30), 7)  # 기간 전 열고 기간 안 청산

    rows = client.get(URL, headers=admin_headers, params={"date": date}).json()["entries"]
    account_a = next(e for e in rows if e["mt4_login"] == a)["account_id"]
    account_b = next(e for e in rows if e["mt4_login"] == b)["account_id"]

    # 적용할 룰이 없으면 적용된 룰 0개로 통과 (실제 룰은 tests/test_trading_rules.py)
    monkeypatch.setattr(ce, "RULE_CHECKS", [])
    res = client.post(EVAL.format(account_a), headers=admin_headers)
    assert res.status_code == 200, res.text
    ev = res.json()
    assert ev["result"] == "PASSED" and ev["rules_applied"] == 0 and ev["checks"] == []
    assert ev["trades_count"] == 2 and ev["open_positions"] == 1
    assert ev["equity"] == 112000 and ev["profit"] == 12000 and ev["profit_rate"] == 12.0
    assert ev["period_end"].startswith(end.strftime("%Y-%m-%dT%H:%M"))

    # 룰 함수가 받는 재료와 실패 판정
    seen = {}

    def rule(ctx):
        seen["orders"] = [t.mt4_order for t in ctx.trades]
        seen["vip"] = ctx.is_vip
        return ce.RuleResult("min_profit", "최소 수익", ctx.profit >= 20000, f"수익 {ctx.profit}")

    monkeypatch.setattr(ce, "RULE_CHECKS", [rule, lambda ctx: None])
    ev = client.post(EVAL.format(account_a), headers=admin_headers).json()
    assert seen == {"orders": [5, 1, 2], "vip": False}
    assert ev["result"] == "FAILED" and ev["rules_applied"] == 1
    assert ev["checks"] == [{"key": "min_profit", "label": "최소 수익", "passed": False, "detail": "수익 12000.00"}]

    # Leaderboard에는 계좌별 마지막 판정이 나온다
    rows = client.get(URL, headers=admin_headers, params={"date": date}).json()["entries"]
    row_a = next(e for e in rows if e["account_id"] == account_a)
    assert row_a["evaluation_result"] == "FAILED" and row_a["is_passed"] is False and row_a["evaluated_at"]
    assert next(e for e in rows if e["account_id"] == account_b)["evaluation_result"] is None
    latest = client.get(f"/api/v1/admin/challenges/leaderboard/accounts/{account_a}/evaluation", headers=admin_headers)
    assert latest.json()["id"] == ev["id"]
    assert client.get(f"/api/v1/admin/challenges/leaderboard/accounts/{account_b}/evaluation",
                      headers=admin_headers).json() is None

    monkeypatch.setattr(ce, "RULE_CHECKS", [])
    client.post(EVAL.format(account_b), headers=admin_headers)
    stats = client.get(STATS, headers=admin_headers, params={"target_date": date}).json()["stats"]
    assert stats["passed_count"] == 1

    # 계좌 상태는 바꾸지 않는다
    assert {r["status"] for r in run_sql("select status from core.trading_accounts")} == {"ACTIVE"}

    # 오류
    assert client.post(EVAL.format("nope"), headers=admin_headers).status_code == 404
    assert client.post(EVAL.format("00000000-0000-0000-0000-000000000000"), headers=admin_headers).status_code == 404
    assert client.post(EVAL.format(account_a), headers=buyer).status_code == 403
