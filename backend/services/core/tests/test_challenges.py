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


def _sched(**extra):
    base = {"interval_days": 1, "interval_minutes": None, "duration_days": 1, "duration_minutes": None,
            "start_time": time(22, 0), "end_time": time(21, 0), "exclude_holiday": True}
    return SimpleNamespace(**{**base, **extra})


# ── 날짜 계산 ───────────────────────────────────────────────


def test_next_start_skips_weekend_and_holiday():
    s = _sched()
    # 2026-11-20은 금요일. 다음 시작은 토·일을 건너뛰고 월요일 22:00.
    last = SimpleNamespace(start_at=_utc(2026, 11, 20, 22), end_at=_utc(2026, 11, 23, 21))
    assert svc.compute_next_start_at(s, last, _utc(2026, 11, 21), set()) == _utc(2026, 11, 23, 22)
    # 월요일이 휴장일이면 화요일
    assert svc.compute_next_start_at(s, last, _utc(2026, 11, 21), {dt.date(2026, 11, 23)}) == _utc(2026, 11, 24, 22)
    # 휴장일 제외를 끄면 토요일에도 시작
    assert svc.compute_next_start_at(_sched(exclude_holiday=False), last, _utc(2026, 11, 21), set()) == _utc(
        2026, 11, 21, 22
    )


def test_end_counts_trading_days():
    # 금요일 22:00 시작, 1일 → 월요일 21:00 (주말은 세지 않음)
    assert svc.compute_end_at(_sched(), _utc(2026, 11, 20, 22), set()) == _utc(2026, 11, 23, 21)
    # 5일 → 다음 주 금요일 21:00
    assert svc.compute_end_at(_sched(duration_days=5), _utc(2026, 11, 20, 22), set()) == _utc(2026, 11, 27, 21)
    assert svc.compute_end_at(_sched(exclude_holiday=False), _utc(2026, 11, 20, 22), set()) == _utc(2026, 11, 21, 21)
    # 테스트용 분 단위
    assert svc.compute_end_at(_sched(duration_minutes=30), _utc(2026, 11, 20, 22), set()) == _utc(2026, 11, 20, 22, 30)


def test_interval_zero_starts_after_previous_end():
    last = SimpleNamespace(start_at=_utc(2026, 11, 16, 22), end_at=_utc(2026, 11, 20, 21))
    # 금요일 21:00에 끝나면 같은 날 22:00에 다음 회차 시작
    assert svc.compute_next_start_at(_sched(interval_days=0), last, _utc(2026, 11, 17), set()) == _utc(2026, 11, 20, 22)
    # 그날이 휴장일이면 다음 영업일(월요일)
    holidays = {dt.date(2026, 11, 20)}
    assert svc.compute_next_start_at(_sched(interval_days=0), last, _utc(2026, 11, 17), holidays) == (
        _utc(2026, 11, 23, 22)
    )
    # start_time이 종료 시각보다 이르면 다음 날로
    early = _sched(interval_days=0, start_time=time(9, 0), exclude_holiday=False)
    assert svc.compute_next_start_at(early, last, _utc(2026, 11, 17), set()) == _utc(2026, 11, 21, 9)


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
    assert counts == {"created": 1, "started": 0, "closed": 0, "cancelled": 0}
    rows = _challenges()
    assert [(r["name"], r["status"]) for r in rows] == [("Daily #1 (2026-11-16)", "PENDING")]
    assert rows[0]["start_at"] == _utc(2026, 11, 16, 22) and rows[0]["end_at"] == _utc(2026, 11, 17, 21)

    # 시작 전에 다시 돌면 아무것도 하지 않는다.
    assert _run_jobs(_utc(2026, 11, 16, 12))["created"] == 0

    # 22:00이 지나면 1회차가 시작되고 2회차가 모집에 들어간다.
    assert _run_jobs(_utc(2026, 11, 16, 22, 1)) == {"created": 1, "started": 1, "closed": 0, "cancelled": 0}
    rows = _challenges()
    assert [(r["name"], r["status"]) for r in rows] == [
        ("Daily #1 (2026-11-16)", "ACTIVE"), ("Daily #2 (2026-11-17)", "PENDING")]

    # 화요일 21:00 → 1회차 종료, 22:00 → 2회차 시작·3회차 생성
    assert _run_jobs(_utc(2026, 11, 17, 21, 1))["closed"] == 1
    assert _run_jobs(_utc(2026, 11, 17, 22, 1)) == {"created": 1, "started": 1, "closed": 0, "cancelled": 0}
    assert [r["status"] for r in _challenges()] == ["CLOSED", "ACTIVE", "PENDING"]

    detail = client.get(f"/api/v1/admin/schedules/{s['id']}", headers=admin).json()
    assert detail["created_count"] == 3 and detail["next_run_at"].startswith("2026-11-18T22:00")


def test_first_round_in_past_starts_now_and_max_occurrences(client, admin, challenge_product):  # noqa: F811
    s = _schedule(client, admin, challenge_product, max_occurrences=2)
    # 23:00에 처음 돌면 오늘 22:00 회차를 만들어 바로 시작하고, 다음 회차까지 만든다.
    assert _run_jobs(_utc(2026, 11, 16, 23)) == {"created": 2, "started": 1, "closed": 0, "cancelled": 0}
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
    res = client.post("/api/v1/admin/holidays", headers=admin, json={"date": "2026-11-16", "name": "Test"})
    assert res.status_code == 200, res.text
    holiday_id = res.json()["id"]
    assert client.post("/api/v1/admin/holidays", headers=admin,
                       json={"date": "2026-11-16", "name": "Dup"}).status_code == 409
    assert len(client.get("/api/v1/admin/holidays?year=2026", headers=admin).json()) == 1

    _schedule(client, admin, challenge_product)
    _run_jobs(_utc(2026, 11, 16, 10))
    assert _challenges()[0]["start_at"] == _utc(2026, 11, 17, 22)

    res = client.patch(f"/api/v1/admin/holidays/{holiday_id}", headers=admin, json={"is_active": False})
    assert res.json()["is_active"] is False
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
