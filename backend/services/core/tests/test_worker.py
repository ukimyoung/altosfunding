"""작업 큐(core.jobs)와 Background Worker."""

import asyncio
from datetime import UTC, datetime, timedelta

from sqlalchemy import update

from app.models import Job
from app.services import jobs
from tests.conftest import run_sql
from tests.test_catalog import admin  # noqa: F401
from tests.test_challenges import _schedule, challenge_product  # noqa: F401
from tests.test_login import member  # noqa: F401

calls: list[dict] = []


@jobs.handler("test.ok")
async def _ok(session, job):
    calls.append(job.payload)
    return {"echo": job.payload.get("n")}


@jobs.handler("test.flaky")
async def _flaky(session, job):
    # DB를 바꾼 뒤 실패하면 그 변경은 되돌려져야 한다.
    await session.execute(update(Job).where(Job.id == job.id).values(priority=99))
    raise RuntimeError("MT4 timeout")


@jobs.handler("test.bad_payload")
async def _bad(session, job):
    raise jobs.PermanentJobError("login 없음")


def _sessionmaker():
    from app import db

    db.get_engine()
    return db._sessionmaker


def _run(coro_fn):
    async def go():
        return await coro_fn(_sessionmaker())

    return asyncio.run(go())


def _enqueue(kind, payload=None, **kw):
    async def go(sm):
        async with sm() as session:
            job = await jobs.enqueue(session, kind, payload, **kw)
            await session.commit()
            return job.id if job else None

    return _run(go)


def _claim(limit=10, now=None, worker="w1"):
    async def go(sm):
        async with sm() as session:
            return await jobs.claim(session, worker, limit, now)

    return _run(go)


def _run_job(job_id):
    return _run(lambda sm: jobs.run_job(sm, job_id))


def _job(job_id):
    return dict(run_sql("select * from core.jobs where id = $1", job_id)[0])


def _attempts(job_id):
    return [dict(r) for r in run_sql(
        "select attempt, status, error from core.job_attempts where job_id = $1 order by attempt", job_id)]


def test_job_success(db):
    calls.clear()
    job_id = _enqueue("test.ok", {"n": 1}, ref_type="account", ref_id="123")
    assert _claim() == [job_id]
    assert _job(job_id)["status"] == "RUNNING"
    assert _run_job(job_id) == "SUCCEEDED"
    row = _job(job_id)
    assert row["status"] == "SUCCEEDED" and row["attempts"] == 1 and row["finished_at"] and row["locked_by"] is None
    assert calls == [{"n": 1}]
    assert [a["status"] for a in _attempts(job_id)] == ["SUCCEEDED"]
    # 끝난 작업은 다시 잡히지 않는다
    assert _claim() == []


def test_job_retry_then_fail(db):
    job_id = _enqueue("test.flaky", max_attempts=2)
    assert _claim() == [job_id]
    assert _run_job(job_id) == "PENDING"
    row = _job(job_id)
    assert row["priority"] == 0, "실패한 처리기의 DB 변경은 되돌려진다"
    assert "MT4 timeout" in row["last_error"]
    assert row["run_at"] > datetime.now(UTC) + timedelta(seconds=20)
    # 다음 시도 시각 전에는 잡히지 않는다
    assert _claim() == []
    assert _claim(now=datetime.now(UTC) + timedelta(minutes=1)) == [job_id]
    assert _run_job(job_id) == "FAILED"
    row = _job(job_id)
    assert row["status"] == "FAILED" and row["attempts"] == 2 and row["finished_at"]
    assert [a["status"] for a in _attempts(job_id)] == ["RETRY", "FAILED"]


def test_permanent_error_and_unknown_kind(db):
    bad = _enqueue("test.bad_payload")
    unknown = _enqueue("test.nobody")
    assert sorted(_claim()) == sorted([bad, unknown])
    assert _run_job(bad) == "FAILED"
    assert _run_job(unknown) == "FAILED"
    assert "등록된 처리기가 없습니다" in _job(unknown)["last_error"]
    assert _job(bad)["attempts"] == 1


def test_retry_delay_backoff():
    assert jobs.retry_delay(1) == timedelta(seconds=30)
    assert jobs.retry_delay(3) == timedelta(minutes=2)
    assert jobs.retry_delay(20) == timedelta(hours=1)


def test_dedupe_and_priority(db):
    first = _enqueue("test.ok", dedupe_key="acct:1")
    assert _enqueue("test.ok", dedupe_key="acct:1") is None
    urgent = _enqueue("test.ok", priority=10)
    later = _enqueue("test.ok", run_at=datetime.now(UTC) + timedelta(hours=1))
    # 우선순위 높은 것부터, 아직 때가 안 된 것은 빼고
    assert _claim(limit=1) == [urgent]
    assert _claim(limit=5, worker="w2") == [first]
    assert _job(first)["locked_by"] == "w2"
    _run_job(first)
    # 끝난 뒤에는 같은 키로 다시 넣을 수 있다
    assert _enqueue("test.ok", dedupe_key="acct:1") not in (None, first)
    assert later


def test_concurrent_claims_do_not_overlap(db):
    ids = [_enqueue("test.ok", {"n": i}) for i in range(20)]

    async def go(sm):
        async def one(name):
            async with sm() as session:
                return await jobs.claim(session, name, 5)

        return await asyncio.gather(*(one(f"w{i}") for i in range(6)))

    results = _run(go)
    claimed = [j for r in results for j in r]
    assert sorted(claimed) == sorted(ids)
    assert len(set(claimed)) == len(claimed)


def test_release_stale(db):
    job_id = _enqueue("test.ok", max_attempts=1)
    other = _enqueue("test.ok")
    _claim()
    later = datetime.now(UTC) + timedelta(minutes=11)

    async def go(sm):
        async with sm() as session:
            return await jobs.release_stale(session, 600, later)

    assert _run(go) == 2
    assert _job(job_id)["status"] == "FAILED"
    assert _job(other)["status"] == "PENDING"
    assert _attempts(other)[0]["status"] == "ABANDONED"


def test_worker_creates_rounds_without_admin(client, admin, challenge_product, monkeypatch):  # noqa: F811
    """관리자가 '지금 실행'을 누르지 않아도 Worker가 회차를 만들고, 작업 큐도 처리한다."""
    from app import worker as worker_mod
    from app.config import settings

    calls.clear()
    _schedule(client, admin, challenge_product)
    job_id = _enqueue("test.ok", {"n": 7})
    monkeypatch.setattr(settings, "worker_tick_seconds", 0.2)
    monkeypatch.setattr(settings, "worker_poll_seconds", 0.2)

    async def go(sm):
        w = worker_mod.Worker(sm)

        async def stop_soon():
            await asyncio.sleep(1.5)
            w.stop.set()

        await asyncio.gather(w.run(), stop_soon())
        return w

    w = _run(go)
    rounds = run_sql("select status from core.challenges")
    assert len(rounds) >= 1, "스케줄의 회차가 자동으로 만들어진다"
    assert _job(job_id)["status"] == "SUCCEEDED" and calls == [{"n": 7}]
    assert w.last["challenges"]["ok"] and w.last["manual_emails"]["ok"]

    res = client.get("/api/v1/admin/system/worker", headers=admin)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["alive"] is True and body["workers"][0]["worker_id"] == worker_mod.WORKER_ID
    assert body["jobs"]["SUCCEEDED"] == 1
    res = client.get("/api/v1/admin/system/jobs?status=succeeded", headers=admin)
    assert res.json()["total"] == 1 and res.json()["items"][0]["result"] == {"echo": 7}


def test_system_api_requires_admin(client, member):  # noqa: F811
    assert client.get("/api/v1/admin/system/worker").status_code == 401
