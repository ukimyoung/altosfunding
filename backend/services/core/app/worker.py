"""Render Background Worker 진입점: `python -m app.worker`

Core API와 같은 코드·같은 DB를 쓰고, 사람이 누르지 않아도 돌아야 하는 일을 맡는다.

- 챌린지 회차: 1분마다 시작·종료 시각이 된 회차의 상태를 바꾸고, 스케줄의 다음 회차를 만든다
  (백오피스 '지금 실행'과 같은 app.services.challenge.run_due_jobs).
- 예약 수동 메일: 1분마다 예약 시각이 된 발송 작업을 보낸다 (app.services.manual_email.run_due_jobs).
- 작업 큐(core.jobs): 몇 초마다 실행할 작업을 꺼내 처리한다 (app.services.jobs).
- MT4 거래·잔고 수집: 1분마다 거래 가능 계좌의 거래 내역·잔고를 브로커 API에서 받아 저장한다 (app.services.mt4_ingest).
- MT4 연결 확인: 시작할 때와 10분마다 실제 브로커 API(서버 시각)를 불러 주소·API 키가 맞는지 로그로 남긴다.
- 생존 기록: core.worker_heartbeats에 마지막 실행 시각과 결과를 남긴다 (GET /api/v1/admin/system/worker).

주기 작업은 각자 따로 돈다. 수동 메일을 오래 보내는 중에도 챌린지 회차는 제때 바뀐다.
여러 Worker를 띄워도 각 작업은 FOR UPDATE SKIP LOCKED로 같은 행을 두 번 처리하지 않는다.
"""

import asyncio
import contextlib
import logging
import os
import signal
import socket
import time
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app import db
from app.config import settings
from app.models import Challenge, ChallengeSchedule, Job, WorkerHeartbeat
from app.services import challenge as challenge_svc
from app.services import jobs, mt4, mt4_ingest, trading_rules
from app.services import manual_email as manual_email_svc
from app.services.email import get_email_sender
from app.services.files import public_base_url

logger = logging.getLogger("app.worker")

WORKER_ID = f"{socket.gethostname()}-{os.getpid()}"
# 이보다 오래 소식이 없는 Worker 기록은 지운다.
HEARTBEAT_RETENTION = timedelta(days=1)
# MT4 브로커 API 연결 확인 주기 (시작할 때 한 번, 이후 10분마다)
MT4_CHECK_SECONDS = 600


def import_job_handlers() -> None:
    """작업 처리기를 등록하는 모듈을 불러온다. 처리기를 새로 만들면 여기에 추가한다."""
    from app.jobs import mt4  # noqa: F401


# ── 주기 작업 ───────────────────────────────────────────────


async def run_challenges(session: AsyncSession) -> dict:
    counts = await challenge_svc.run_due_jobs(session)  # 계좌 잠금 해제·잠금 작업도 여기서 넣는다
    await session.commit()
    return counts


async def run_manual_emails(session: AsyncSession) -> dict:
    return await manual_email_svc.run_due_jobs(session, get_email_sender(), public_base_url(""))


async def check_mt4() -> dict:
    """실제 MT4 브로커 API에 닿는지 확인한다 (환경변수 주소·API 키). 결과는 로그와 생존 기록에 남는다.

    계좌 발급은 이 확인과 상관없이 작업 큐에서 실제 API를 부른다. 설정이 안 된 서버는 건너뛴다.
    """
    result: dict[str, str] = {}
    for server in (mt4.DEMO, mt4.LIVE):
        client = mt4.client_for(server)
        if not client.base_url or not client.api_key:
            result[server] = "미설정"
            continue
        try:
            reply = await client.server_time()
            result[server] = "OK"
            logger.info("MT4 %s 연결 OK: %s (서버 시각 %s)", server, client.base_url, reply)
        except mt4.Mt4Error as exc:
            result[server] = f"실패 HTTP {exc.status}" if exc.status else "실패 응답 없음"
            logger.error("MT4 %s 연결 실패: %s → %s", server, client.base_url, exc)
    return result


async def run_job_queue(sessionmaker: async_sessionmaker[AsyncSession]) -> dict:
    """실행할 작업이 없을 때까지 꺼내서 처리한다."""
    done: dict[str, int] = {}
    async with sessionmaker() as session:
        await jobs.release_stale(session, settings.worker_job_lease_seconds)
    while True:
        async with sessionmaker() as session:
            ids = await jobs.claim(session, WORKER_ID, settings.worker_job_batch_size)
        if not ids:
            return done
        for job_id in ids:
            status = await jobs.run_job(sessionmaker, job_id)
            done[status] = done.get(status, 0) + 1


class Worker:
    def __init__(self, sessionmaker: async_sessionmaker[AsyncSession]) -> None:
        self.sessionmaker = sessionmaker
        self.stop = asyncio.Event()
        self.last: dict[str, dict] = {}
        # 직전 상태 로그 이후 작업 큐 처리 건수 (job_queue는 5초마다 돌아서 따로 모은다)
        self.jobs_since_report: dict[str, int] = {}

    async def _sleep(self, seconds: float) -> None:
        with contextlib.suppress(TimeoutError):
            await asyncio.wait_for(self.stop.wait(), timeout=seconds)

    async def _every(self, name: str, seconds: float, fn: Callable[[], Awaitable[dict]]) -> None:
        while not self.stop.is_set():
            started = time.monotonic()
            try:
                result = await fn()
                self.last[name] = {"at": datetime.now(UTC).isoformat(), "ok": True, "result": result}
                if name == "job_queue":
                    for status, n in result.items():
                        self.jobs_since_report[status] = self.jobs_since_report.get(status, 0) + n
                # 거래 수집은 매분 같은 건수가 나와서 실패가 있을 때만 따로 남긴다 (평소 결과는 상태 줄에 나온다).
                if name in ("mt4_ingest", "trading_rules") and not result.get("failed") and not result.get("violations"):
                    pass
                elif any(result.values()):
                    logger.info("%s: %s", name, result)
            except Exception as exc:
                self.last[name] = {"at": datetime.now(UTC).isoformat(), "ok": False, "error": str(exc)[:500]}
                logger.exception("%s 실패", name)
            await self._sleep(max(seconds - (time.monotonic() - started), 1))

    async def _session_task(self, fn: Callable[[AsyncSession], Awaitable[dict]]) -> dict:
        async with self.sessionmaker() as session:
            return await fn(session)

    async def heartbeat(self) -> dict:
        now = datetime.now(UTC)
        async with self.sessionmaker() as session:
            stmt = insert(WorkerHeartbeat).values(
                worker_id=WORKER_ID, started_at=self.started_at, last_seen_at=now, last_tick=self.last
            )
            await session.execute(
                stmt.on_conflict_do_update(
                    index_elements=[WorkerHeartbeat.worker_id],
                    set_={"last_seen_at": now, "last_tick": stmt.excluded.last_tick},
                )
            )
            expired = now - HEARTBEAT_RETENTION
            await session.execute(delete(WorkerHeartbeat).where(WorkerHeartbeat.last_seen_at < expired))
            await session.commit()
            state = await self._state(session)
        self._report(state)
        return {}

    async def _state(self, session: AsyncSession) -> dict:
        """상태 로그에 넣을 현재 DB 상태: 활성 스케줄, 모집 중·진행 중 대회, 대기 작업."""
        row = (
            await session.execute(
                select(
                    select(func.count()).where(ChallengeSchedule.status == "ACTIVE").scalar_subquery(),
                    select(func.count()).where(Challenge.status == challenge_svc.PENDING).scalar_subquery(),
                    select(func.count()).where(Challenge.status == challenge_svc.ACTIVE).scalar_subquery(),
                    select(func.min(Challenge.start_at))
                    .where(Challenge.status == challenge_svc.PENDING)
                    .scalar_subquery(),
                    select(func.count()).where(Job.status == jobs.PENDING).scalar_subquery(),
                )
            )
        ).one()
        return {
            "schedules": row[0],
            "pending_rounds": row[1],
            "active_rounds": row[2],
            "next_start": row[3],
            "queued_jobs": row[4],
        }

    def _report(self, state: dict) -> None:
        """주기마다 한 줄: 처리할 일이 없어도 Worker가 살아 있다는 것을 로그로 보여 준다."""

        def result(name: str) -> str:
            last = self.last.get(name)
            if last is None:
                return "-"
            if not last["ok"]:
                return "실패"
            return ",".join(f"{k}={v}" for k, v in last["result"].items()) or "0"

        next_start = state["next_start"]
        logger.info(
            "상태: 대회[%s] 예약메일[%s] 작업큐[%s] MT4[%s] 거래수집[%s] 룰감시[%s] | 활성 스케줄 %d, 모집 중 대회 %d (다음 시작 %s), "
            "진행 중 대회 %d, 대기 작업 %d",
            result("challenges"),
            result("manual_emails"),
            ",".join(f"{k}={v}" for k, v in self.jobs_since_report.items()) or "0",
            result("mt4"),
            result("mt4_ingest"),
            result("trading_rules"),
            state["schedules"],
            state["pending_rounds"],
            f"{next_start:%Y-%m-%d %H:%M} UTC" if next_start else "없음",
            state["active_rounds"],
            state["queued_jobs"],
        )
        self.jobs_since_report = {}

    async def run(self) -> None:
        self.started_at = datetime.now(UTC)
        tick = settings.worker_tick_seconds
        loops = [
            self._every("challenges", tick, lambda: self._session_task(run_challenges)),
            self._every("manual_emails", tick, lambda: self._session_task(run_manual_emails)),
            self._every("job_queue", settings.worker_poll_seconds, lambda: run_job_queue(self.sessionmaker)),
            self._every("heartbeat", tick, self.heartbeat),
            self._every("mt4", MT4_CHECK_SECONDS, check_mt4),
            self._every("mt4_ingest", settings.mt4_ingest_seconds, lambda: mt4_ingest.run(self.sessionmaker)),
        ]
        if settings.risk_enabled:
            loops.append(
                self._every("trading_rules", settings.risk_seconds, lambda: trading_rules.run(self.sessionmaker))
            )
        logger.info("Worker 시작: %s (주기 %ss, 작업 큐 %ss)", WORKER_ID, tick, settings.worker_poll_seconds)
        await asyncio.gather(*loops)
        logger.info("Worker 종료: %s", WORKER_ID)


async def main() -> None:
    import_job_handlers()
    if not (settings.core_public_url or settings.render_external_url):
        logger.warning("CORE_PUBLIC_URL이 비어 있어 예약 메일의 수신거부 링크·이미지 주소가 상대 경로가 됩니다.")
    db.get_engine()
    assert db._sessionmaker is not None
    worker = Worker(db._sessionmaker)
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        with contextlib.suppress(NotImplementedError):  # Windows
            loop.add_signal_handler(sig, worker.stop.set)
    try:
        await worker.run()
    finally:
        await db.dispose_engine()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    asyncio.run(main())
