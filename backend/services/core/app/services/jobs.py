"""백그라운드 작업 큐 (core.jobs).

Core API는 enqueue()로 작업을 넣기만 하고, Render Background Worker(app.worker)가 꺼내서 처리한다.

- 꺼내기: status='PENDING'이고 run_at이 지난 작업을 FOR UPDATE SKIP LOCKED로 잠그고 RUNNING으로 바꾼다.
  Worker를 여러 개 띄워도 같은 작업을 두 번 잡지 않는다.
- 성공: SUCCEEDED. 처리기가 돌려준 dict는 result에 남는다.
- 실패: attempts < max_attempts면 PENDING으로 되돌리고 run_at을 뒤로 미룬다(30초, 1분, 2분 ... 최대 1시간).
  다 쓰면 FAILED. 재시도해도 소용없는 오류는 처리기가 PermanentJobError를 던진다.
- Worker가 처리 도중 죽으면 RUNNING으로 남는다. lease(기본 10분)가 지나면 다시 PENDING(또는 FAILED)으로 돌린다.
  그래서 처리기는 같은 작업이 두 번 실행돼도 문제없게(멱등) 만든다. 외부 호출(MT4)은 먼저 현재 상태를 확인하고 보낸다.
- 시도마다 core.job_attempts에 한 줄씩 남긴다.

처리기 등록:

    @jobs.handler("mt4.create_account")
    async def create_account(session: AsyncSession, job: Job) -> dict | None:
        ...

처리기 안에서 DB를 바꾸면 처리기와 같은 트랜잭션으로 작업 상태와 함께 커밋된다.
처리기가 중간에 session.commit()을 해도 된다 (외부 호출 전에 진행 상황을 남길 때).

재시도를 다 써서(또는 PermanentJobError로) 최종 실패할 때 할 일은 on_failed로 등록한다.
작업을 FAILED로 바꾸는 트랜잭션 안에서 불린다 (예: 계좌 발급 실패 → 자동 환불).

    @jobs.on_failed("mt4.create_account")
    async def refund(session: AsyncSession, job: Job, error: str) -> None:
        ...
"""

import logging
import traceback
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.errors import AppError
from app.models import Job, JobAttempt

logger = logging.getLogger(__name__)

PENDING, RUNNING, SUCCEEDED, FAILED, CANCELLED = "PENDING", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"
RETRY_BASE_SECONDS = 30
RETRY_MAX_SECONDS = 3600
DEFAULT_LEASE_SECONDS = 600

Handler = Callable[[AsyncSession, Job], Awaitable[dict | None]]
FailureHandler = Callable[[AsyncSession, Job, str], Awaitable[None]]
_handlers: dict[str, Handler] = {}
_failure_handlers: dict[str, FailureHandler] = {}


class PermanentJobError(Exception):
    """재시도해도 결과가 같은 오류 (잘못된 payload 등). 바로 FAILED로 끝낸다."""


def handler(kind: str) -> Callable[[Handler], Handler]:
    def register(fn: Handler) -> Handler:
        if kind in _handlers and _handlers[kind] is not fn:
            raise RuntimeError(f"작업 처리기가 이미 등록돼 있습니다: {kind}")
        _handlers[kind] = fn
        return fn

    return register


def on_failed(kind: str) -> Callable[[FailureHandler], FailureHandler]:
    def register(fn: FailureHandler) -> FailureHandler:
        if kind in _failure_handlers and _failure_handlers[kind] is not fn:
            raise RuntimeError(f"실패 처리기가 이미 등록돼 있습니다: {kind}")
        _failure_handlers[kind] = fn
        return fn

    return register


async def _run_failure_handler(session: AsyncSession, job: Job, error: str) -> None:
    """최종 실패 처리. 처리기가 실패하면 그 변경만 되돌리고 로그를 남긴다 (작업은 FAILED로 끝낸다)."""
    fn = _failure_handlers.get(job.kind)
    if fn is None:
        return
    try:
        async with session.begin_nested():
            await fn(session, job, error)
    except Exception:
        logger.exception("실패 처리기 오류: id=%s kind=%s", job.id, job.kind)


def registered_kinds() -> list[str]:
    return sorted(_handlers)


def _now() -> datetime:
    return datetime.now(UTC)


def retry_delay(attempts: int) -> timedelta:
    """attempts번째 시도가 실패했을 때 다음 시도까지 기다릴 시간."""
    seconds = RETRY_BASE_SECONDS * 2 ** max(attempts - 1, 0)
    return timedelta(seconds=min(seconds, RETRY_MAX_SECONDS))


# ── 넣기 ────────────────────────────────────────────────────


async def enqueue(
    session: AsyncSession,
    kind: str,
    payload: dict | None = None,
    *,
    run_at: datetime | None = None,
    priority: int = 0,
    max_attempts: int = 5,
    dedupe_key: str | None = None,
    ref_type: str | None = None,
    ref_id: str | None = None,
) -> Job | None:
    """작업을 넣는다. 호출한 쪽의 트랜잭션에 포함되므로 커밋은 호출한 쪽이 한다.

    dedupe_key가 같은 작업이 아직 PENDING·RUNNING이면 넣지 않고 None을 돌려준다.
    """
    if max_attempts < 1:
        raise ValueError("max_attempts는 1 이상이어야 합니다.")
    values = {
        "kind": kind,
        "payload": payload or {},
        "priority": priority,
        "max_attempts": max_attempts,
        "dedupe_key": dedupe_key,
        "ref_type": ref_type,
        "ref_id": ref_id,
    }
    if run_at is not None:
        values["run_at"] = run_at
    stmt = insert(Job).values(**values)
    if dedupe_key is not None:
        stmt = stmt.on_conflict_do_nothing(
            index_elements=[Job.dedupe_key],
            index_where=Job.dedupe_key.is_not(None) & Job.status.in_([PENDING, RUNNING]),
        )
    job_id = await session.scalar(stmt.returning(Job.id))
    if job_id is None:
        return None
    return await session.get(Job, job_id)


# ── 꺼내기·처리 ─────────────────────────────────────────────


async def claim(session: AsyncSession, worker_id: str, limit: int = 10, now: datetime | None = None) -> list[int]:
    """실행할 작업을 잠그고 RUNNING으로 바꾼 뒤 커밋한다. 잡은 작업 id를 돌려준다."""
    now = now or _now()
    due = (
        select(Job.id)
        .where(Job.status == PENDING, Job.run_at <= now)
        .order_by(Job.priority.desc(), Job.run_at, Job.id)
        .limit(limit)
        .with_for_update(skip_locked=True)
        .scalar_subquery()
    )
    rows = await session.execute(
        update(Job)
        .where(Job.id.in_(due))
        .values(
            status=RUNNING,
            attempts=Job.attempts + 1,
            locked_by=worker_id,
            locked_at=now,
            updated_at=now,
        )
        .returning(Job.id, Job.attempts)
        .execution_options(synchronize_session=False)
    )
    claimed = list(rows)
    session.add_all(
        JobAttempt(job_id=job_id, attempt=attempt, worker_id=worker_id, status=RUNNING, started_at=now)
        for job_id, attempt in claimed
    )
    await session.commit()
    return sorted(job_id for job_id, _ in claimed)


async def _attempt_row(session: AsyncSession, job: Job) -> JobAttempt | None:
    return await session.scalar(
        select(JobAttempt)
        .where(JobAttempt.job_id == job.id, JobAttempt.attempt == job.attempts)
        .order_by(JobAttempt.id.desc())
        .limit(1)
    )


async def _finish_failure(session: AsyncSession, job_id: int, error: str, permanent: bool) -> str:
    job = await session.get(Job, job_id, with_for_update=True, populate_existing=True)
    if job is None or job.status != RUNNING:
        await session.commit()
        return job.status if job else FAILED
    now = _now()
    job.last_error = error[:4000]
    job.locked_by = job.locked_at = None
    attempt = await _attempt_row(session, job)
    if permanent or job.attempts >= job.max_attempts:
        job.status, job.finished_at = FAILED, now
        attempt_status = FAILED
        await _run_failure_handler(session, job, error)
    else:
        job.status, job.run_at = PENDING, now + retry_delay(job.attempts)
        attempt_status = "RETRY"
    if attempt is not None:
        attempt.status, attempt.error, attempt.finished_at = attempt_status, error[:4000], now
    await session.commit()
    return job.status


async def run_job(sessionmaker: async_sessionmaker[AsyncSession], job_id: int) -> str:
    """잡아 둔(RUNNING) 작업 하나를 처리하고 최종 상태를 돌려준다. 예외는 밖으로 던지지 않는다."""
    async with sessionmaker() as session:
        job = await session.get(Job, job_id)
        if job is None or job.status != RUNNING:
            return job.status if job else FAILED
        kind = job.kind
        fn = _handlers.get(kind)
        if fn is None:
            await session.rollback()
            logger.error("처리기가 없는 작업: id=%s kind=%s", job_id, kind)
            return await _finish_failure(session, job_id, f"등록된 처리기가 없습니다: {kind}", permanent=True)
        try:
            result = await fn(session, job)
        except Exception as exc:
            await session.rollback()
            permanent = isinstance(exc, PermanentJobError) or (isinstance(exc, AppError) and exc.status_code < 500)
            error = f"{type(exc).__name__}: {exc}\n{traceback.format_exc(limit=5)}"
            status = await _finish_failure(session, job_id, error, permanent)
            log = logger.error if status == FAILED else logger.warning
            log("작업 실패: id=%s kind=%s → %s (%s)", job_id, kind, status, exc)
            return status

        now = _now()
        job.status, job.result, job.finished_at, job.last_error = SUCCEEDED, result, now, None
        job.locked_by = job.locked_at = None
        attempt = await _attempt_row(session, job)
        if attempt is not None:
            attempt.status, attempt.finished_at = SUCCEEDED, now
        await session.commit()
        return SUCCEEDED


async def release_stale(
    session: AsyncSession, lease_seconds: int = DEFAULT_LEASE_SECONDS, now: datetime | None = None
) -> int:
    """처리 중에 Worker가 죽어 RUNNING으로 남은 작업을 되돌린다. 되돌린 수를 돌려준다."""
    now = now or _now()
    stale = list(
        await session.scalars(
            select(Job)
            .where(Job.status == RUNNING, Job.locked_at < now - timedelta(seconds=lease_seconds))
            .with_for_update(skip_locked=True)
        )
    )
    for job in stale:
        error = f"Worker 응답 없음 ({job.locked_by}, {job.locked_at:%Y-%m-%d %H:%M:%S} UTC부터 처리 중)"
        attempt = await _attempt_row(session, job)
        if attempt is not None and attempt.finished_at is None:
            attempt.status, attempt.error, attempt.finished_at = "ABANDONED", error, now
        job.last_error, job.locked_by, job.locked_at = error, None, None
        if job.attempts >= job.max_attempts:
            job.status, job.finished_at = FAILED, now
            await _run_failure_handler(session, job, error)
        else:
            job.status, job.run_at = PENDING, now + retry_delay(job.attempts)
    await session.commit()
    if stale:
        logger.warning("멈춘 작업 %d개를 되돌림: %s", len(stale), [j.id for j in stale])
    return len(stale)


async def counts_by_status(session: AsyncSession) -> dict[str, int]:
    rows = await session.execute(select(Job.status, func.count()).group_by(Job.status))
    counts = {s: 0 for s in (PENDING, RUNNING, SUCCEEDED, FAILED, CANCELLED)}
    counts.update({status: n for status, n in rows})
    return counts
