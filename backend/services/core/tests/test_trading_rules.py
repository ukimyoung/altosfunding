"""트레이딩 룰 자동 검증 1단계 (기록만): 1분 감시·일일 마감 결산·대회 종료 자동 판정을 확인한다."""

import asyncio
import json
import uuid
from datetime import UTC, date, datetime, timedelta

from app.services import trading_rules
from tests.conftest import run_sql
from tests.test_admin_users import admin_headers  # noqa: F401
from tests.test_challenge_orders import POOL_START, _work, buyer, fake_mt4, round_  # noqa: F401
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


def _status(account_id):
    return run_sql("select status from core.trading_accounts where id = $1", uuid.UUID(account_id))[0]["status"]


def _jobs(kind):
    rows = run_sql("select * from core.jobs where kind = $1 order by id", kind)
    return [{**r, "payload": json.loads(r["payload"]) if isinstance(r["payload"], str) else r["payload"]} for r in rows]


def test_monitor_daily_close_and_auto_final_evaluation(client, admin_headers, buyer, round_, active, broker):  # noqa: F811
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
    # 2단계 조치: FAILED + 전량 청산·읽기 전용 + 위반 안내 메일
    assert mdd[0]["mode"] == "ENFORCED" and mdd[0]["status"] == "ACTIONED"
    assert mdd[0]["action"] == "CLOSE_ALL+READ_ONLY+FAILED"
    assert _status(acc) == "FAILED" and _status(active[B]) == "ACTIVE"
    hist = run_sql("select * from core.trading_account_status_history where account_id = $1", uuid.UUID(acc))
    assert [(h["action"], h["from_status"], h["to_status"], h["changed_by"]) for h in hist] == [
        ("RULE_VIOLATION", "ACTIVE", "FAILED", None)
    ]
    broker.fake.open_positions[A] = [{"order": 1}]
    _work(rounds=2)
    assert broker.fake.closed_all == [A] and A not in broker.fake.open_positions
    assert broker.fake.accounts[A]["isReadOnly"] is True and not broker.fake.accounts[B]["isReadOnly"]
    assert [j["status"] for j in _jobs("mt4.close_all_and_lock")] == ["SUCCEEDED"]
    assert [j["status"] for j in _jobs("notify.account_violated")] == ["SUCCEEDED"]
    # FAILED 계좌는 더 감시하지 않는다
    assert _run(t1 + timedelta(minutes=2))["checked"] == 1

    # 관리자 조회
    rules = client.get(f"/api/v1/admin/accounts/{acc}/rules", headers=admin_headers).json()
    assert rules["state"]["dd_floor"] == 98000 and len(rules["daily_stats"]) == 1
    assert {v["rule_key"] for v in rules["violations"]} == {"CONSISTENCY", "MAX_DRAWDOWN"}
    page = client.get("/api/v1/admin/rule-violations?severity=HARD", headers=admin_headers).json()
    assert page["total"] == 1 and page["items"][0]["mt4_login"] == A and page["items"][0]["email"]

    # 회원 Account Detail: 대회 기간 중에는 (관리자가 '확인하기'를 눌렀어도) 판정을 보여 주지 않는다
    member_eval = f"/api/v1/accounts/{acc}/evaluation"
    assert client.post(f"/api/v1/admin/challenges/leaderboard/accounts/{acc}/evaluate", headers=admin_headers).status_code == 200
    assert client.get(member_eval, headers=buyer).json() is None
    assert client.get(member_eval, headers=admin_headers).status_code == 404  # 본인 계좌만

    # 대회 종료 → 10분 뒤 자동 최종 판정 (한 번만)
    ended = t1 + timedelta(minutes=2)
    run_sql("update core.challenges set status = 'CLOSED', closed_at = $2 where id = $1", round_["challenge_id"], ended)
    run_sql("update core.trading_accounts set status = 'CLOSED' where challenge_id = $1 and status = 'ACTIVE'",
            round_["challenge_id"])
    assert _run(ended + timedelta(minutes=5))["evaluated"] == 0
    assert _run(ended + timedelta(minutes=11))["evaluated"] == 2
    assert _run(ended + timedelta(minutes=12))["evaluated"] == 0
    ev = run_sql("select * from core.challenge_evaluations where account_id = $1 and source = 'AUTO'", uuid.UUID(acc))
    assert len(ev) == 1 and ev[0]["source"] == "AUTO" and ev[0]["evaluated_by"] is None
    assert ev[0]["result"] == "FAILED"
    checks = {c["key"]: c["passed"] for c in __import__("json").loads(ev[0]["checks"])}
    assert checks == {"profit_target": False, "min_trading_days": False, "max_drawdown": False, "consistency": True}
    # 최종 판정이 계좌 상태에 반영된다: 이미 FAILED인 계좌는 그대로, CLOSED였던 계좌는 결과로 (결과 메일 1통)
    assert _status(acc) == "FAILED" and _status(active[B]) == "FAILED"
    result_mails = _jobs("notify.challenge_result")
    assert [(j["payload"]["account_id"], j["payload"]["result"]) for j in result_mails] == [(active[B], "FAILED")]

    # 대회가 끝나고 판정이 나면 회원에게도 룰별 결과를 보여 준다 (화면 문구용 숫자 값 포함)
    mine = client.get(member_eval, headers=buyer).json()
    assert mine["result"] == "FAILED" and [c["key"] for c in mine["checks"]] == [
        "profit_target", "min_trading_days", "max_drawdown", "consistency"
    ]
    values = {c["key"]: c["values"] for c in mine["checks"]}
    assert values["profit_target"]["target"] == 6000
    assert values["min_trading_days"]["required"] == 3
    assert values["max_drawdown"]["dd"] == 5000 and values["max_drawdown"]["floor"] == 98000
    assert values["max_drawdown"]["equity"] == 97900 and values["max_drawdown"]["violated_at"]
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


def test_funded_daily_loss(client, admin_headers, round_, active, broker):  # noqa: F811
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
    assert v[0]["mode"] == "ENFORCED" and v[0]["action"] == "CLOSE_ALL+READ_ONLY_DAY"

    # 그날만 정지: 상태는 ACTIVE 그대로, 다음 거래일 시작까지 청산·읽기 전용
    day_end = trading_rules.day_bounds(trading_rules.trading_date(now + timedelta(minutes=1)))[1]
    row = run_sql("select status, trading_halted_until from core.trading_accounts where id = $1", uuid.UUID(active[B]))[0]
    assert row["status"] == "ACTIVE" and row["trading_halted_until"] == day_end
    broker.fake.open_positions[B] = [{"order": 7}]
    _work(rounds=2)
    assert broker.fake.closed_all == [B] and broker.fake.accounts[B]["isReadOnly"] is True
    assert not _jobs("notify.account_violated")  # 하루 정지는 FAILED 안내 메일을 보내지 않는다

    # 다음 거래일이 되면 정지를 풀고 다시 거래할 수 있다
    assert _run(day_end - timedelta(minutes=1))["released"] == 0
    assert _run(day_end + timedelta(minutes=1))["released"] == 1
    assert run_sql("select trading_halted_until from core.trading_accounts where id = $1",
                   uuid.UUID(active[B]))[0]["trading_halted_until"] is None
    _work()
    assert broker.fake.accounts[B]["isReadOnly"] is False


def test_challenge_close_closes_positions(client, admin_headers, round_, active, broker):  # noqa: F811
    """대회 종료: 거래 중이던 계좌의 남은 포지션을 모두 청산하고 잠근다."""
    broker.fake.open_positions[A] = [{"order": 3}]
    res = client.post(f"/api/v1/admin/challenges/{round_['challenge_id']}/close", headers=admin_headers)
    assert res.status_code == 200, res.text
    assert _status(active[A]) == "CLOSED" and _status(active[B]) == "CLOSED"
    assert len(_jobs("mt4.close_all_and_lock")) == 2
    _work(rounds=2)
    assert sorted(broker.fake.closed_all) == [A, B]
    assert broker.fake.accounts[A]["isReadOnly"] is True and broker.fake.accounts[B]["isReadOnly"] is True


def test_close_retries_while_positions_remain(client, admin_headers, round_, active, broker):  # noqa: F811
    """청산 뒤에도 열린 포지션이 남으면 작업이 실패로 재시도된다."""
    real = broker.fake.handler

    def stubborn(request):
        if request.url.path.endswith("/orders-pending/close"):
            return __import__("httpx").Response(200, json={"message": "partially"})  # 포지션을 남긴다
        return real(request)

    broker.fake.handler = stubborn
    broker.fake.open_positions[A] = [{"order": 3}]
    client.post(f"/api/v1/admin/challenges/{round_['challenge_id']}/close", headers=admin_headers)
    _work()
    job = next(j for j in _jobs("mt4.close_all_and_lock") if j["payload"]["account_id"] == active[A])
    assert job["status"] == "PENDING" and job["attempts"] == 1 and "열린 주문 1개" in job["last_error"]


def test_stale_equity_is_not_judged(round_, active):  # noqa: F811
    _ruleset(round_["product_id"])
    now = datetime.now(UTC)
    _equity(active[A], 90000, now - timedelta(minutes=10))
    result = _run(now)
    assert result["checked"] == 0 and result["violations"] == 0
