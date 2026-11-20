"""트레이딩 룰 자동 검증 1단계 (기록만): 1분 감시·일일 마감 결산·대회 종료 자동 판정을 확인한다."""

import asyncio
import uuid
from datetime import UTC, date, datetime, timedelta

from app.services import trading_rules
from tests.conftest import run_sql
from tests.test_admin_users import admin_headers  # noqa: F401
from tests.test_challenge_orders import POOL_START, buyer, fake_mt4, round_  # noqa: F401
from tests.test_login import member  # noqa: F401
from tests.test_mt4_ingest import active, broker  # noqa: F401

A, B = POOL_START, POOL_START + 1


def _run(now):
    from app import db

    db.get_engine()
    return asyncio.run(trading_rules.run(db._sessionmaker, now))


def _ruleset(product_id, **values):
    cols = {
        "id": "RS-TEST", "name": "Test", "dd_calc_method": "EOD", "max_dd_normal_amt": 5000,
        "profit_target_amt": 6000, "min_trading_days": 3, "consistency_pct": 40, "daily_loss_limit_amt": 2000,
        **values,
    }
    names = ", ".join(cols)
    params = ", ".join(f"${i}" for i in range(1, len(cols) + 1))
    run_sql(f"insert into core.rulesets ({names}) values ({params})", *cols.values())
    run_sql("update core.products set ruleset_id = $1 where id = $2", cols["id"], product_id)


def _equity(account_id, equity, at, balance=None):
    run_sql(
        "update core.trading_accounts set equity = $2, balance = $3, equity_updated_at = $4 where id = $1",
        uuid.UUID(account_id), equity, balance if balance is not None else equity, at,
    )


def _snapshot(account_id, equity, at, balance=None):
    run_sql(
        "insert into core.trading_account_equity_snapshots (account_id, taken_at, balance, equity) values ($1, $2, $3, $4)",
        uuid.UUID(account_id), at, balance if balance is not None else equity, equity,
    )


def _trade(account_id, order, open_time, close_time=None, profit=0):
    run_sql(
        "insert into core.trading_account_trades (account_id, mt4_order, mt4_login, type, action, is_open, symbol, "
        "volume, open_time, close_time, profit) values ($1, $2, $3, 'Buy', 'BUY', $4, 'US500.ce', 1, $5, $6, $7)",
        uuid.UUID(account_id), order, A, close_time is None, open_time, close_time, profit,
    )


def test_trading_date_is_mt4_server_day():
    # 겨울(그리스 UTC+2): 마감 = UTC 22:00 = KST 07:00
    assert trading_rules.trading_date(datetime(2026, 11, 20, 21, 59, tzinfo=UTC)) == date(2026, 11, 20)
    assert trading_rules.trading_date(datetime(2026, 11, 20, 22, 0, tzinfo=UTC)) == date(2026, 11, 21)
    assert trading_rules.day_bounds(date(2026, 11, 20)) == (
        datetime(2026, 11, 19, 22, 0, tzinfo=UTC), datetime(2026, 11, 20, 22, 0, tzinfo=UTC)
    )
    # 여름(UTC+3): 마감 = UTC 21:00 = KST 06:00
    assert trading_rules.day_bounds(date(2026, 7, 1))[1] == datetime(2026, 7, 1, 21, 0, tzinfo=UTC)


def test_monitor_daily_close_and_auto_final_evaluation(client, admin_headers, round_, active):  # noqa: F811
    _ruleset(round_["product_id"])
    acc = active[A]
    now0 = datetime.now(UTC)
    _equity(acc, 100000, now0)
    _equity(active[B], 100000, now0)

    first = _run(now0)
    assert first["checked"] == 2 and first["violations"] == 0
    state = run_sql("select * from core.account_risk_state where account_id = $1", uuid.UUID(acc))[0]
    assert float(state["dd_amount"]) == 5000 and float(state["dd_floor"]) == 95000
    day = trading_rules.trading_date(now0)
    assert state["current_trading_date"] == day

    # 첫 거래일: 진입 1건, 마감 평가금액 103,000 (미실현 포함)
    _, day_end = trading_rules.day_bounds(day)
    opened = max(now0, day_end - timedelta(minutes=30))
    _trade(acc, 1, opened)
    _snapshot(acc, 103000, day_end - timedelta(minutes=1), balance=100000)
    _equity(acc, 103000, day_end - timedelta(minutes=1), balance=100000)

    # 마감 + 5분 전에는 결산하지 않는다
    assert _run(day_end + timedelta(minutes=4))["days_closed"] == 0
    closed = _run(day_end + timedelta(minutes=6))
    assert closed["days_closed"] == 2  # 계좌 2개
    stat = run_sql("select * from core.account_daily_stats where account_id = $1", uuid.UUID(acc))[0]
    assert stat["trading_date"] == day
    assert float(stat["close_equity"]) == 103000 and float(stat["day_pnl"]) == 3000
    assert stat["fills_count"] == 1 and stat["is_trading_day"]
    # EOD trailing: 기준선 = 마감 평가금액 − DD
    assert float(stat["dd_floor_before"]) == 95000 and float(stat["dd_floor_after"]) == 98000
    # 하루 수익이 전체 순수익의 100% > 40% → Consistency 경고(기록만)
    warn = run_sql("select * from core.rule_violations where account_id = $1", uuid.UUID(acc))
    assert [(v["rule_key"], v["severity"], v["mode"]) for v in warn] == [("CONSISTENCY", "WARN", "SHADOW")]

    # 다음 날 장중 평가금액이 기준선 98,000 이하 → Max Drawdown 위반 (한 번만 기록)
    t1 = day_end + timedelta(minutes=7)
    _equity(acc, 97900, t1, balance=100000)
    _equity(active[B], 99000, t1)
    hit = _run(t1)
    assert hit["violations"] == 1
    assert _run(t1 + timedelta(minutes=1))["violations"] == 0
    mdd = run_sql("select * from core.rule_violations where rule_key = 'MAX_DRAWDOWN'")
    assert len(mdd) == 1 and str(mdd[0]["account_id"]) == acc
    assert float(mdd[0]["observed_value"]) == 97900 and float(mdd[0]["limit_value"]) == 98000
    assert mdd[0]["ruleset_snapshot"]  # 당시 룰셋 값 보관
    # 챌린지 계좌에는 Daily Loss를 적용하지 않는다
    assert not run_sql("select 1 from core.rule_violations where rule_key = 'DAILY_LOSS'")
    # 기록만: 계좌 상태는 그대로
    assert run_sql("select status from core.trading_accounts where id = $1", uuid.UUID(acc))[0]["status"] == "ACTIVE"

    # 관리자 조회
    rules = client.get(f"/api/v1/admin/accounts/{acc}/rules", headers=admin_headers).json()
    assert rules["state"]["dd_floor"] == 98000 and len(rules["daily_stats"]) == 1
    assert {v["rule_key"] for v in rules["violations"]} == {"CONSISTENCY", "MAX_DRAWDOWN"}
    page = client.get("/api/v1/admin/rule-violations?severity=HARD", headers=admin_headers).json()
    assert page["total"] == 1 and page["items"][0]["mt4_login"] == A and page["items"][0]["email"]

    # 대회 종료 → 10분 뒤 자동 최종 판정 (한 번만)
    ended = t1 + timedelta(minutes=2)
    run_sql("update core.challenges set status = 'CLOSED', closed_at = $2 where id = $1", round_["challenge_id"], ended)
    run_sql("update core.trading_accounts set status = 'CLOSED' where challenge_id = $1", round_["challenge_id"])
    assert _run(ended + timedelta(minutes=5))["evaluated"] == 0
    assert _run(ended + timedelta(minutes=11))["evaluated"] == 2
    assert _run(ended + timedelta(minutes=12))["evaluated"] == 0
    ev = run_sql("select * from core.challenge_evaluations where account_id = $1", uuid.UUID(acc))
    assert len(ev) == 1 and ev[0]["source"] == "AUTO" and ev[0]["evaluated_by"] is None
    assert ev[0]["result"] == "FAILED"
    checks = {c["key"]: c["passed"] for c in __import__("json").loads(ev[0]["checks"])}
    assert checks == {"profit_target": False, "min_trading_days": False, "max_drawdown": False, "consistency": True}
    # 종료일까지 결산이 채워진다 (마지막 날은 종료 시각에서 자름)
    last = run_sql(
        "select * from core.account_daily_stats where account_id = $1 order by trading_date desc limit 1",
        uuid.UUID(acc),
    )[0]
    assert last["period_end"] == ended

    # 관리자 '확인하기'도 같은 룰을 쓰고 MANUAL로 남는다
    res = client.post(f"/api/v1/admin/challenges/leaderboard/accounts/{acc}/evaluate", headers=admin_headers)
    assert res.status_code == 200 and res.json()["source"] == "MANUAL" and res.json()["rules_applied"] == 4
    # 팝업에는 룰셋 코드 대신 이름을 보여 준다
    assert res.json()["ruleset_id"] == "RS-TEST" and res.json()["ruleset_name"] == "Test"
    latest = client.get(f"/api/v1/admin/challenges/leaderboard/accounts/{acc}/evaluation", headers=admin_headers)
    assert latest.json()["ruleset_name"] == "Test"


def test_funded_daily_loss(client, admin_headers, round_, active):  # noqa: F811
    _ruleset(round_["product_id"])
    run_sql("update core.trading_accounts set tier = 'FUNDED' where mt4_login = $1", B)
    now = datetime.now(UTC)
    _equity(active[B], 100000, now)
    assert _run(now)["violations"] == 0
    # 오늘 시작 잔고 100,000 − 평가금액 97,900 = 2,100 ≥ 한도 2,000
    _equity(active[B], 97900, now + timedelta(minutes=1), balance=100000)
    assert _run(now + timedelta(minutes=1))["violations"] == 1
    assert _run(now + timedelta(minutes=2))["violations"] == 0  # 같은 거래일은 한 번만
    v = run_sql("select * from core.rule_violations where rule_key = 'DAILY_LOSS'")
    assert len(v) == 1 and float(v[0]["observed_value"]) == 2100 and float(v[0]["limit_value"]) == 2000


def test_stale_equity_is_not_judged(round_, active):  # noqa: F811
    _ruleset(round_["product_id"])
    now = datetime.now(UTC)
    _equity(active[A], 90000, now - timedelta(minutes=10))
    result = _run(now)
    assert result["checked"] == 0 and result["violations"] == 0
