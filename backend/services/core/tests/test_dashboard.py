"""백오피스 대시보드: 요약(시스템·액션·기간 매출·대회 현황)과 추이(매출·계좌 생성 수)."""

from datetime import UTC, date, datetime, timedelta

from app.services import dashboard
from tests.conftest import run_sql
from tests.test_admin_users import admin_headers  # noqa: F401
from tests.test_challenge_orders import _join, _work, buyer, fake_mt4, round_  # noqa: F401
from tests.test_login import member  # noqa: F401

SUMMARY = "/api/v1/admin/dashboard/summary"
TRENDS = "/api/v1/admin/dashboard/trends"


def _now(s: str) -> datetime:
    return datetime.fromisoformat(s).replace(tzinfo=UTC)


def test_range_bounds_kst():
    # 2026-11-22 16:00 UTC = 11-23(월) 01:00 KST
    now = _now("2026-11-22T16:00:00")
    assert dashboard.range_bounds("today", now) == (date(2026, 11, 23), date(2026, 11, 23), date(2026, 11, 22), date(2026, 11, 22))
    assert dashboard.range_bounds("yesterday", now)[:2] == (date(2026, 11, 22), date(2026, 11, 22))
    assert dashboard.range_bounds("this_week", now) == (date(2026, 11, 23), date(2026, 11, 23), date(2026, 11, 16), date(2026, 11, 16))
    # 3월 31일의 이번 달 → 비교는 2월 1일 ~ 2월 말일
    s, e, ps, pe = dashboard.range_bounds("this_month", _now("2027-03-31T03:00:00"))
    assert (s, e, ps, pe) == (date(2027, 3, 1), date(2027, 3, 31), date(2027, 2, 1), date(2027, 2, 28))


def test_trend_window_defaults():
    now = _now("2026-11-22T03:00:00")  # 11-22(일) KST
    assert dashboard.trend_window("daily", None, None, now) == (date(2026, 11, 16), date(2026, 11, 22))
    assert dashboard.trend_window("weekly", None, None, now) == (date(2026, 9, 28), date(2026, 11, 22))
    assert dashboard.trend_window("monthly", None, None, now) == (date(2026, 6, 1), date(2026, 11, 22))


def test_summary_and_trends(client, admin_headers, buyer, round_, fake_mt4):  # noqa: F811
    assert _join(client, buyer, round_["challenge_id"], quantity=2).status_code == 201
    _work()
    run_sql("update core.users set kyc_status = 'PENDING' where email = 'buyer@example.com'")

    res = client.get(SUMMARY, headers=admin_headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["range"] == "today"
    assert body["revenue"]["challenge"]["amount"] == 160  # 할인가 80 × 2
    assert body["revenue"]["challenge"]["change_pct"] is None  # 어제 매출 0
    assert body["revenue"]["funded"]["ready"] is False
    assert body["revenue"]["total"]["amount"] == 160
    assert body["actions"]["kyc_pending"] == 1
    assert set(body["actions"]) >= {"withdraw_pending_count", "deposit_pending_count", "contacts_unanswered",
                                    "rewards_pending_count", "rule_violations_open", "withdraw_pending_amount"}
    assert body["system"]["worker_alive"] is False and body["system"]["provisioning_accounts"] == 0
    comp = body["competitions"]
    assert [c["challenge_id"] for c in comp["recruiting"]] == [round_["challenge_id"]]
    assert comp["recruiting"][0]["participants"] == 2 and comp["recruiting"][0]["product_name"] == "Challenge Starter"
    assert comp["ended"]["competitions"] == 0 and comp["pass_rate"]["rate"] is None

    # 회원·계좌·자금 (P2)
    assert body["members"]["total_users"] == 1 and body["members"]["new_signups"] == 1  # 구매 회원(USER)만
    assert body["members"]["new_signups_prev"] == 0 and body["members"]["new_signups_change_pct"] is None
    assert body["accounts"]["challenge_issued"] == 2 and body["accounts"]["challenge_active"] == 0
    assert body["accounts"]["funded_active"] == 0 and body["accounts"]["funded_halted"] == 0
    assert body["funds"] == {"total_deposit_amount": 300, "total_withdraw_amount": 0}

    signups = client.get(TRENDS, headers=admin_headers, params={"metric": "signups"}).json()["signups"]
    assert len(signups["labels"]) == 7 and signups["totals"][-1] == 1 and signups["sum"] == 1
    funds = client.get(TRENDS, headers=admin_headers, params={"metric": "funds", "period": "monthly"}).json()
    assert funds["deposit"]["sum"] == 300 and funds["deposit"]["totals"][-1] == 300 and funds["withdraw"]["sum"] == 0

    # 어제 매출로 옮기면 오늘 0, 전일 대비는 '어제' 선택 시 계산된다
    yesterday = client.get(SUMMARY, headers=admin_headers, params={"range": "yesterday"}).json()
    assert yesterday["revenue"]["challenge"]["prev_amount"] == 0

    # 대회 종료: 계좌 하나 PASSED, 하나 FAILED → 오늘 종료 결과와 30일 합격률 50%
    now = datetime.now(UTC)
    run_sql("update core.challenges set status = 'CLOSED', closed_at = $1 where id = $2", now - timedelta(minutes=1),
            round_["challenge_id"])
    ids = [r["id"] for r in run_sql("select id from core.trading_accounts order by mt4_login")]
    run_sql("update core.trading_accounts set status = 'PASSED' where id = $1", ids[0])
    run_sql("update core.trading_accounts set status = 'FAILED' where id = $1", ids[1])
    comp = client.get(SUMMARY, headers=admin_headers).json()["competitions"]
    assert comp["recruiting"] == [] and comp["active"] == []
    assert comp["ended"] == {"competitions": 1, "participants": 2, "passed": 1, "failed": 1}
    assert comp["pass_rate"] == {"days": 30, "passed": 1, "failed": 1, "rate": 50.0}

    # 매출 추이: 기본 최근 7일(일별), 빈 날은 0, 마지막 칸이 오늘
    rev = client.get(TRENDS, headers=admin_headers, params={"metric": "revenue"}).json()["revenue"]
    assert len(rev["labels"]) == 7 and rev["totals"][-1] == 160 and rev["totals"][:-1] == [0] * 6
    assert rev["products"][0]["label"] == "Challenge Starter" and rev["products"][0]["values"][-1] == 160

    # 계좌 생성 수: 챌린지 2, 펀디드 0 (월별)
    acc = client.get(TRENDS, headers=admin_headers, params={"metric": "accounts", "period": "monthly"}).json()
    assert len(acc["challenge"]["labels"]) == 6 and acc["challenge"]["sum"] == 2 and acc["funded"]["sum"] == 0

    # 날짜 구간 검색: 미래 구간은 0, 순서가 뒤집히면 400
    future = (now + timedelta(days=30)).date()
    res = client.get(TRENDS, headers=admin_headers, params={
        "metric": "revenue", "period": "weekly", "start_date": future.isoformat(),
        "end_date": (future + timedelta(days=13)).isoformat()})
    assert res.status_code == 200 and res.json()["revenue"]["sum"] == 0
    res = client.get(TRENDS, headers=admin_headers, params={
        "metric": "revenue", "start_date": "2026-11-10", "end_date": "2026-11-01"})
    assert res.status_code == 400
    assert client.get(TRENDS, headers=admin_headers, params={"metric": "x"}).status_code == 400
    assert client.get(SUMMARY, headers=admin_headers, params={"range": "x"}).status_code == 400


def test_dashboard_requires_admin(client, buyer):  # noqa: F811
    assert client.get(SUMMARY, headers=buyer).status_code == 403


def test_summary_mt4_status_keys(client, admin_headers):  # noqa: F811
    # Worker는 MT4 확인 결과를 소문자 서버 이름(demo·live)으로 남긴다 → 화면은 DEMO·LIVE 키로 읽는다
    run_sql(
        """insert into core.worker_heartbeats (worker_id, started_at, last_seen_at, last_tick)
        values ('w1', now(), now(), '{"mt4": {"at": "2026-11-23T00:00:00+00:00", "ok": true,
        "result": {"demo": "OK", "live": "미설정"}}}'::jsonb)"""
    )
    sys = client.get(SUMMARY, headers=admin_headers).json()["system"]
    assert sys["worker_alive"] is True
    assert sys["mt4"] == {"DEMO": "OK", "LIVE": "미설정"}
    assert sys["mt4_checked_at"] == "2026-11-23T00:00:00+00:00"
