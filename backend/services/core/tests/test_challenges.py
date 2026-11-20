import asyncio
import datetime as dt
from datetime import UTC, datetime, time
from types import SimpleNamespace

import pytest

from app.services import challenge as svc
from tests.conftest import run_sql
from tests.test_catalog import _product, admin  # noqa: F401
from tests.test_login import member  # noqa: F401


def _utc(*args) -> datetime:
    return datetime(*args, tzinfo=UTC)


def _day(y, m, d):
    """하루 전체 휴장 기간 (UTC 00:00 ~ 다음날 00:00)."""
    start = _utc(y, m, d)
    return [(start, start + dt.timedelta(days=1))]


def _sched(**extra):
    base = {"interval_days": 1, "interval_minutes": None, "duration_days": 1, "duration_minutes": None,
            "start_time": time(22, 0), "end_time": time(21, 0), "exclude_holiday": True}
    return SimpleNamespace(**{**base, **extra})


# ── 날짜 계산 ───────────────────────────────────────────────


def test_next_start_skips_weekend_and_holiday():
    s = _sched()
    # 2026-11-20은 금요일. 다음 시작은 토·일을 건너뛰고 월요일 22:00.
    last = SimpleNamespace(start_at=_utc(2026, 11, 20, 22), end_at=_utc(2026, 11, 23, 21))
    assert svc.compute_next_start_at(s, last, _utc(2026, 11, 21), []) == _utc(2026, 11, 23, 22)
    # 월요일이 휴장일이면 화요일
    assert svc.compute_next_start_at(s, last, _utc(2026, 11, 21), _day(2026, 11, 23)) == _utc(2026, 11, 24, 22)
    # 휴장일 제외를 끄면 토요일에도 시작
    assert svc.compute_next_start_at(_sched(exclude_holiday=False), last, _utc(2026, 11, 21), []) == _utc(
        2026, 11, 21, 22
    )


def test_end_counts_trading_days():
    # 금요일 22:00 시작, 1일 → 월요일 21:00 (주말은 세지 않음)
    assert svc.compute_end_at(_sched(), _utc(2026, 11, 20, 22), []) == _utc(2026, 11, 23, 21)
    # 5일 → 다음 주 금요일 21:00
    assert svc.compute_end_at(_sched(duration_days=5), _utc(2026, 11, 20, 22), []) == _utc(2026, 11, 27, 21)
    assert svc.compute_end_at(_sched(exclude_holiday=False), _utc(2026, 11, 20, 22), []) == _utc(2026, 11, 21, 21)
    # 테스트용 분 단위
    assert svc.compute_end_at(_sched(duration_minutes=30), _utc(2026, 11, 20, 22), []) == _utc(2026, 11, 20, 22, 30)


def test_interval_zero_starts_after_previous_end():
    last = SimpleNamespace(start_at=_utc(2026, 11, 16, 22), end_at=_utc(2026, 11, 20, 21))
    # 금요일 21:00에 끝나면 같은 날 22:00에 다음 회차 시작
    assert svc.compute_next_start_at(_sched(interval_days=0), last, _utc(2026, 11, 17), []) == _utc(2026, 11, 20, 22)
    # 그날이 휴장일이면 다음 영업일(월요일)
    holidays = _day(2026, 11, 20)
    assert svc.compute_next_start_at(_sched(interval_days=0), last, _utc(2026, 11, 17), holidays) == (
        _utc(2026, 11, 23, 22)
    )
    # start_time이 종료 시각보다 이르면 다음 날로
    early = _sched(interval_days=0, start_time=time(9, 0), exclude_holiday=False)
    assert svc.compute_next_start_at(early, last, _utc(2026, 11, 17), []) == _utc(2026, 11, 21, 9)


def test_holiday_period_uses_time_of_day():
    s = _sched()
    last = SimpleNamespace(start_at=_utc(2026, 12, 22, 22), end_at=_utc(2026, 12, 23, 21))
    # 12-23(수) 22:00 시작 예정. 휴장 12-23 14:00 ~ 12-24 13:00에 걸리므로 다음 날 22:00
    period = [(_utc(2026, 12, 23, 14), _utc(2026, 12, 24, 13))]
    assert svc.compute_next_start_at(s, last, _utc(2026, 12, 23), period) == _utc(2026, 12, 24, 22)
    # 휴장이 22:00 전에 끝나면 그대로
    short = [(_utc(2026, 12, 23, 14), _utc(2026, 12, 23, 22))]
    assert svc.compute_next_start_at(s, last, _utc(2026, 12, 23), short) == _utc(2026, 12, 23, 22)
    # 종료일 계산: 12-24 21:00이 휴장 기간이면 그날은 세지 않는다
    closed = [(_utc(2026, 12, 24, 14), _utc(2026, 12, 25, 13))]
    assert svc.compute_end_at(s, _utc(2026, 12, 23, 22), closed) == _utc(2026, 12, 25, 21)


def test_render_name():
    assert svc.render_name("Daily #{seq} {date} {weekday}", 3, _utc(2026, 11, 16, 22)) == "Daily #3 2026-11-16 Mon"


# ── API ─────────────────────────────────────────────────────


def _run_jobs(now: datetime) -> dict:
    from app.db import get_session

    async def _go():
        gen = get_session()
        session = await gen.__anext__()
        try:
            counts = await svc.run_due_jobs(session, now)
            await session.commit()
            return counts
        finally:
            await gen.aclose()

    return asyncio.run(_go())


@pytest.fixture
def challenge_product(client, admin):  # noqa: F811
    res = _product(client, admin, type_code="100", description="Starter")
    assert res.status_code == 200, res.text
    return res.json()["product_id"]


def _schedule(client, admin, product_id, **extra):  # noqa: F811
    body = {"name_template": "Daily #{seq} ({date})", "product_id": product_id, "interval_days": 1,
            "duration_days": 1, "group_size": 30, **extra}
    res = client.post("/api/v1/admin/schedules", headers=admin, json=body)
    assert res.status_code == 200, res.text
    return res.json()


def _challenges():
    return [dict(r) for r in run_sql(
        "select id, name, status, start_at, end_at from core.challenges order by start_at")]


def test_schedule_validation(client, admin, challenge_product):  # noqa: F811
    bad = {"name_template": "X {nope}", "product_id": challenge_product, "interval_days": 1, "duration_days": 1}
    assert client.post("/api/v1/admin/schedules", headers=admin, json=bad).status_code == 422
    bad = {"name_template": "X", "product_id": challenge_product, "interval_days": 1, "duration_days": 0}
    assert client.post("/api/v1/admin/schedules", headers=admin, json=bad).status_code == 422
    bad = {"name_template": "X", "product_id": "NOPE", "interval_days": 1, "duration_days": 1}
    assert client.post("/api/v1/admin/schedules", headers=admin, json=bad).status_code == 404
    demo = _product(client, admin, tier_type="DEMO", name="Demo", mt4_login_pool_start=5000000,
                    mt4_login_pool_end=5099999).json()["product_id"]
    bad = {"name_template": "X", "product_id": demo, "interval_days": 1, "duration_days": 1}
    res = client.post("/api/v1/admin/schedules", headers=admin, json=bad)
    assert res.status_code == 400 and res.json()["error_code"] == "invalid_product_tier"


def test_schedule_generates_and_advances_rounds(client, admin, challenge_product):  # noqa: F811
    s = _schedule(client, admin, challenge_product)
    assert s["status"] == "ACTIVE" and s["start_time"] == "22:00:00" and s["created_count"] == 0

    # 월요일 10:00 첫 실행: 오늘 22:00 시작, 화요일 21:00 종료인 1회차가 모집 중이 된다.
    counts = _run_jobs(_utc(2026, 11, 16, 10))
    assert counts == {"created": 1, "started": 0, "closed": 0, "cancelled": 0, "failed": 0}
    rows = _challenges()
    assert [(r["name"], r["status"]) for r in rows] == [("Daily #1 (2026-11-16)", "PENDING")]
    assert rows[0]["start_at"] == _utc(2026, 11, 16, 22) and rows[0]["end_at"] == _utc(2026, 11, 17, 21)

    # 시작 전에 다시 돌면 아무것도 하지 않는다.
    assert _run_jobs(_utc(2026, 11, 16, 12))["created"] == 0

    # 22:00이 지나면 1회차가 시작되고 2회차가 모집에 들어간다.
    assert _run_jobs(_utc(2026, 11, 16, 22, 1)) == {"created": 1, "started": 1, "closed": 0, "cancelled": 0, "failed": 0}
    rows = _challenges()
    assert [(r["name"], r["status"]) for r in rows] == [
        ("Daily #1 (2026-11-16)", "ACTIVE"), ("Daily #2 (2026-11-17)", "PENDING")]

    # 화요일 21:00 → 1회차 종료, 22:00 → 2회차 시작·3회차 생성
    assert _run_jobs(_utc(2026, 11, 17, 21, 1))["closed"] == 1
    assert _run_jobs(_utc(2026, 11, 17, 22, 1)) == {"created": 1, "started": 1, "closed": 0, "cancelled": 0, "failed": 0}
    assert [r["status"] for r in _challenges()] == ["CLOSED", "ACTIVE", "PENDING"]

    detail = client.get(f"/api/v1/admin/schedules/{s['id']}", headers=admin).json()
    assert detail["created_count"] == 3 and detail["next_run_at"].startswith("2026-11-18T22:00")


def test_first_round_in_past_starts_now_and_max_occurrences(client, admin, challenge_product):  # noqa: F811
    s = _schedule(client, admin, challenge_product, max_occurrences=2)
    # 23:00에 처음 돌면 오늘 22:00 회차를 만들어 바로 시작하고, 다음 회차까지 만든다.
    assert _run_jobs(_utc(2026, 11, 16, 23)) == {"created": 2, "started": 1, "closed": 0, "cancelled": 0, "failed": 0}
    assert [r["status"] for r in _challenges()] == ["ACTIVE", "PENDING"]
    detail = client.get(f"/api/v1/admin/schedules/{s['id']}", headers=admin).json()
    assert detail["status"] == "COMPLETED" and detail["created_count"] == 2
    assert _run_jobs(_utc(2026, 11, 17, 22, 1))["created"] == 0

    # 최대 회차를 늘리면 다시 돈다.
    res = client.patch(f"/api/v1/admin/schedules/{s['id']}", headers=admin, json={"max_occurrences": 3})
    assert res.json()["status"] == "ACTIVE"
    assert _run_jobs(_utc(2026, 11, 17, 22, 2))["created"] == 1


def test_catch_up_skips_missed_rounds(client, admin, challenge_product):  # noqa: F811
    _schedule(client, admin, challenge_product)
    _run_jobs(_utc(2026, 11, 16, 10))
    # 서버가 일주일 멈춰 있다가 다음 주 화요일 12:00에 돈 경우:
    # 1회차는 시작 못 하고 끝났으니 취소, 놓친 회차는 만들지 않고 아직 끝나지 않은 회차부터 만든다.
    counts = _run_jobs(_utc(2026, 11, 24, 12))
    assert counts["cancelled"] == 1
    rows = _challenges()
    assert rows[0]["status"] == "CANCELLED"
    assert rows[1]["start_at"] == _utc(2026, 11, 23, 22) and rows[1]["name"] == "Daily #2 (2026-11-23)"
    assert rows[1]["status"] == "ACTIVE"
    assert rows[2]["start_at"] == _utc(2026, 11, 24, 22) and rows[2]["status"] == "PENDING"


def test_holidays_api_and_effect(client, admin, challenge_product):  # noqa: F811
    res = client.post("/api/v1/admin/holidays", headers=admin,
                      json={"start_at": "2026-11-16T14:00:00Z", "end_at": "2026-11-17T13:00:00Z", "name": "Test"})
    assert res.status_code == 200, res.text
    body = res.json()
    holiday_id = body["id"]
    assert body["start_at"].startswith("2026-11-16T14:00") and body["end_at"].startswith("2026-11-17T13:00")
    # 종료가 시작보다 이르면 거절
    assert client.post("/api/v1/admin/holidays", headers=admin,
                       json={"start_at": "2026-11-16T14:00:00Z", "end_at": "2026-11-16T14:00:00Z",
                             "name": "Bad"}).status_code == 422
    # 연말~연초 기간은 두 해 모두에 나온다
    client.post("/api/v1/admin/holidays", headers=admin,
                json={"start_at": "2026-12-31T00:00:00Z", "end_at": "2027-01-02T00:00:00Z", "name": "NY"})
    assert len(client.get("/api/v1/admin/holidays?year=2026", headers=admin).json()) == 2
    assert len(client.get("/api/v1/admin/holidays?year=2027", headers=admin).json()) == 1

    _schedule(client, admin, challenge_product)
    _run_jobs(_utc(2026, 11, 16, 10))
    assert _challenges()[0]["start_at"] == _utc(2026, 11, 17, 22)

    res = client.patch(f"/api/v1/admin/holidays/{holiday_id}", headers=admin, json={"is_active": False})
    assert res.json()["is_active"] is False
    res = client.patch(f"/api/v1/admin/holidays/{holiday_id}", headers=admin,
                       json={"end_at": "2026-11-16T10:00:00Z"})
    assert res.status_code == 422
    assert client.delete(f"/api/v1/admin/holidays/{holiday_id}", headers=admin).status_code == 204


def test_trigger_pause_and_manual_rounds(client, admin, challenge_product):  # noqa: F811
    s = _schedule(client, admin, challenge_product, interval_minutes=10, duration_minutes=60)
    res = client.post(f"/api/v1/admin/schedules/{s['id']}/trigger", headers=admin)
    body = res.json()
    assert res.status_code == 200 and body["created"] is True
    challenge_id = body["challenge"]["challenge_id"]
    assert challenge_id.startswith("CHAL_") and body["challenge"]["group_size"] == 30

    body = client.post(f"/api/v1/admin/schedules/{s['id']}/trigger", headers=admin).json()
    assert body == {**body, "created": False, "reason": "pending_exists"}

    # 시작 → 종료, 잘못된 전이는 409
    assert client.post(f"/api/v1/admin/challenges/{challenge_id}/close", headers=admin).status_code == 409
    res = client.post(f"/api/v1/admin/challenges/{challenge_id}/start", headers=admin)
    assert res.json()["status"] == "ACTIVE" and res.json()["started_at"]
    res = client.post(f"/api/v1/admin/challenges/{challenge_id}/close", headers=admin)
    assert res.json()["status"] == "CLOSED"
    assert client.post(f"/api/v1/admin/challenges/{challenge_id}/start", headers=admin).status_code == 409

    res = client.delete(f"/api/v1/admin/schedules/{s['id']}", headers=admin)
    assert res.json()["status"] == "PAUSED"
    assert client.get("/api/v1/admin/schedules?status=PAUSED", headers=admin).json()["total"] == 1

    # 직접 만든 회차와 취소
    res = client.post("/api/v1/admin/challenges", headers=admin, json={
        "product_id": challenge_product, "name": "Manual", "start_at": "2026-12-01T22:00:00Z",
        "end_at": "2026-12-02T21:00:00Z"})
    assert res.status_code == 200, res.text
    manual = res.json()["challenge_id"]
    res = client.post(f"/api/v1/admin/challenges/{manual}/close", headers=admin, json={"cancel_reason": "테스트"})
    assert res.json()["status"] == "CANCELLED" and res.json()["cancel_reason"] == "테스트"
    bad = {"product_id": challenge_product, "name": "Bad", "start_at": "2026-12-02T00:00:00Z",
           "end_at": "2026-12-01T00:00:00Z"}
    assert client.post("/api/v1/admin/challenges", headers=admin, json=bad).status_code == 422
    assert client.get("/api/v1/admin/challenges/nope", headers=admin).status_code == 404


def test_lists_summary_grouped(client, admin, challenge_product):  # noqa: F811
    _schedule(client, admin, challenge_product)
    _run_jobs(_utc(2026, 11, 16, 23))
    run_sql("update core.challenges set current_participants = 7 where status = 'ACTIVE'")

    page = client.get("/api/v1/admin/challenges?date=20261116", headers=admin).json()
    assert page["total"] == 1 and page["items"][0]["status"] == "ACTIVE"
    assert client.get("/api/v1/admin/challenges?status=PENDING", headers=admin).json()["total"] == 1
    assert client.get("/api/v1/admin/challenges?date=bad", headers=admin).status_code == 400

    assert client.get("/api/v1/admin/challenges/active-dates", headers=admin).json() == ["20261117", "20261116"]

    grouped = client.get("/api/v1/admin/challenges/grouped?status=ACTIVE", headers=admin).json()
    assert grouped["total"] == 1 and grouped["items"][0]["participants"] == {"100": 7}
    tier = grouped["items"][0]["tiers"][0]
    assert tier["product_id"] == challenge_product and tier["participants"] == 7 and tier["group_size"] == 30
    # 날짜 범위는 한국 시간 시작일 기준 (UTC 11-16 22:00 시작 = 한국 11-17 07:00)
    url = "/api/v1/admin/challenges/grouped"
    assert [i["status"] for i in client.get(f"{url}?date_from=2026-11-18", headers=admin).json()["items"]] == [
        "PENDING"
    ]
    only_first = client.get(f"{url}?date_from=2026-11-17&date_to=2026-11-17", headers=admin).json()
    assert [i["status"] for i in only_first["items"]] == ["ACTIVE"]
    assert client.get(f"{url}?date_to=2026-11-16", headers=admin).json()["total"] == 0
    assert client.get(f"{url}?date_from=bad", headers=admin).status_code == 400

    # 로그인 없이 볼 수 있다.
    summary = client.get("/api/v1/challenges/summary").json()
    assert [c["status"] for c in summary["challenges"]] == ["ACTIVE", "PENDING"]
    first = summary["challenges"][0]
    assert first["capital"] == 10000 and first["price_usdt"] == 99 and first["type_code"] == "100"
    assert first["description"] == "Starter" and first["group_size"] == 30
    assert summary["total_active_accounts"] == 7

    assert client.get("/api/v1/admin/challenges").status_code == 401


def test_internal_job_endpoint(client, admin, challenge_product, monkeypatch):  # noqa: F811
    from app.config import settings

    url = "/api/v1/internal/jobs/challenges"
    monkeypatch.setattr(settings, "system_api_key", "")
    assert client.post(url).status_code == 503
    monkeypatch.setattr(settings, "system_api_key", "secret-key")
    assert client.post(url).status_code == 403
    assert client.post(url, headers={"X-System-Api-Key": "wrong"}).status_code == 403
    _schedule(client, admin, challenge_product, interval_minutes=10, duration_minutes=60)
    res = client.post(url, headers={"X-System-Api-Key": "secret-key"})
    assert res.status_code == 200 and res.json()["created"] >= 1

    res = client.post("/api/v1/admin/schedules/run-due", headers=admin)
    assert res.status_code == 200


def test_challenge_offers(client, admin, challenge_product):  # noqa: F811
    from tests.test_catalog import _ruleset

    rs = _ruleset(client, admin, profit_target_pct=6, max_dd_normal_pct=5, daily_loss_limit_pct=0)
    funded_rs = _ruleset(client, admin, max_dd_normal_amt=700, daily_loss_limit_pct=2)
    assert client.put(f"/api/v1/catalog/products/{challenge_product}", headers=admin,
                      json={"ruleset_id": rs["id"], "discount_price_usdt": 59, "is_most_popular": True}).status_code == 200
    funded = _product(client, admin, tier_type="FUNDED", name="Funded $10K", ruleset_id=funded_rs["id"],
                      payout_ratio=80, leverage=50, related_id=challenge_product, mt4_login_pool_start=2000000,
                      mt4_login_pool_end=2099999).json()
    other = _product(client, admin, name="Challenge $25K", capital=25000, price_usdt=150,
                     mt4_login_pool_start=1100000, mt4_login_pool_end=1199999).json()
    _product(client, admin, name="Hidden", capital=5000, is_active=False,
             mt4_login_pool_start=1200000, mt4_login_pool_end=1299999)

    # 회차가 없으면 상품만 보이고 신청 회차는 비어 있다.
    res = client.get("/api/v1/challenges/products")
    assert res.status_code == 200, res.text
    items = res.json()["items"]
    assert [i["product_id"] for i in items] == [challenge_product, other["product_id"]]
    first = items[0]
    assert (first["price_usdt"], first["discount_price_usdt"], first["final_price_usdt"]) == (99, 59, 59)
    assert first["is_most_popular"] is True and first["open_challenge"] is None
    assert first["rules"]["profit_target_amt"] == 600 and first["rules"]["max_drawdown_amt"] == 500
    assert first["rules"]["daily_loss_limit_amt"] == 0
    # 펀디드 단계는 이 챌린지 상품을 연관 상품으로 지정한 펀디드 상품
    assert first["funded"]["product_id"] == funded["product_id"] and first["funded"]["payout_ratio"] == 80
    assert first["funded"]["rules"]["max_drawdown_amt"] == 700
    assert first["funded"]["rules"]["daily_loss_limit_amt"] == 200
    # 룰셋에 금액($)이 정해져 있으면 비율 대신 그 금액을 쓴다.
    client.patch(f"/api/v1/admin/rulesets/{rs['id']}", headers=admin,
                 json={"profit_target_amt": 800, "daily_loss_limit_amt": 300})
    rules = client.get("/api/v1/challenges/products").json()["items"][0]["rules"]
    assert (rules["profit_target_amt"], rules["daily_loss_limit_amt"]) == (800, 300)
    # 최소거래일: 상품 값이 있으면 그 값, 없으면 룰셋 값
    assert rules["min_trading_days"] == rs["min_trading_days"]
    client.put(f"/api/v1/catalog/products/{challenge_product}", headers=admin, json={"min_trading_days": 9})
    assert client.get("/api/v1/challenges/products").json()["items"][0]["rules"]["min_trading_days"] == 9
    assert items[1]["final_price_usdt"] == 150 and items[1]["rules"] is None and items[1]["funded"] is None

    # 모집 중 회차가 생기면 그 회차를 신청 대상으로 준다. 정원이 차면 빠진다.
    _schedule(client, admin, challenge_product)
    _run_jobs(_utc(2026, 11, 16, 23))
    pending = [c for c in _challenges() if c["status"] == "PENDING"][0]
    first = client.get("/api/v1/challenges/products").json()["items"][0]
    assert first["open_challenge"]["challenge_id"] == pending["id"]
    run_sql("update core.challenges set current_participants = group_size where status = 'PENDING'")
    assert client.get("/api/v1/challenges/products").json()["items"][0]["open_challenge"] is None
    # 정원을 비우면(null) 무제한: 참가자가 많아도 계속 신청할 수 있다.
    run_sql("update core.challenges set group_size = null, current_participants = 10000 where status = 'PENDING'")
    open_challenge = client.get("/api/v1/challenges/products").json()["items"][0]["open_challenge"]
    assert open_challenge["challenge_id"] == pending["id"] and open_challenge["group_size"] is None


def test_schedule_without_group_size_is_unlimited(client, admin, challenge_product):  # noqa: F811
    body = {"name_template": "Daily #{seq}", "product_id": challenge_product, "interval_days": 1, "duration_days": 1}
    res = client.post("/api/v1/admin/schedules", headers=admin, json=body)
    assert res.status_code == 200, res.text
    schedule = res.json()
    assert schedule["group_size"] is None
    _run_jobs(_utc(2026, 11, 16, 10))
    assert run_sql("select group_size from core.challenges")[0]["group_size"] is None
    # 정원을 넣었다가 다시 비울 수 있다 (다음 대회부터 적용)
    url = f"/api/v1/admin/schedules/{schedule['id']}"
    assert client.patch(url, headers=admin, json={"group_size": 20}).json()["group_size"] == 20
    assert client.patch(url, headers=admin, json={"group_size": None}).json()["group_size"] is None
    assert client.post("/api/v1/admin/schedules", headers=admin, json={**body, "group_size": 0}).status_code == 422


def test_one_failing_round_does_not_block_others(client, admin, challenge_product, monkeypatch):  # noqa: F811
    """한 회차의 계좌 처리가 실패해도 다른 회차 시작·다음 회차 생성은 진행되고, 실패한 회차는 다음 주기에 다시 시도된다."""
    _schedule(client, admin, challenge_product, name_template="A #{seq}")
    _schedule(client, admin, challenge_product, name_template="B #{seq}")
    assert _run_jobs(_utc(2026, 11, 16, 10))["created"] == 2

    original = svc.challenge_order.on_challenge_status_changed

    async def flaky(session, challenge):
        if challenge.name.startswith("A") and challenge.status == "ACTIVE":
            raise RuntimeError("계좌 잠금 해제 작업을 넣지 못함")
        return await original(session, challenge)

    monkeypatch.setattr(svc.challenge_order, "on_challenge_status_changed", flaky)
    counts = _run_jobs(_utc(2026, 11, 16, 22, 1))
    assert counts == {"created": 1, "started": 1, "closed": 0, "cancelled": 0, "failed": 1}
    status = {r["name"]: r["status"] for r in _challenges()}
    assert status == {"A #1": "PENDING", "B #1": "ACTIVE", "B #2": "PENDING"}

    # 원인이 고쳐지면 다음 주기에 밀린 회차가 시작되고 다음 회차가 만들어진다.
    monkeypatch.setattr(svc.challenge_order, "on_challenge_status_changed", original)
    counts = _run_jobs(_utc(2026, 11, 16, 22, 2))
    assert counts == {"created": 1, "started": 1, "closed": 0, "cancelled": 0, "failed": 0}
    status = {r["name"]: r["status"] for r in _challenges()}
    assert status == {"A #1": "ACTIVE", "A #2": "PENDING", "B #1": "ACTIVE", "B #2": "PENDING"}
