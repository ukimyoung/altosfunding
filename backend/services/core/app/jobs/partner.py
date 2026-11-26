"""제휴사 회원 가져오기 작업 처리기.

partner_members.sync — 가져오기 회차 하나를 끝까지 실행한다 (app.services.partner_sync.run).
  페이지마다 커밋하므로 Worker가 중간에 멈추면 lease 뒤 다시 실행돼 마지막 커서 다음부터 이어 받는다.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Job
from app.services import jobs, partner_sync


@jobs.handler(partner_sync.JOB_KIND)
async def sync_partner_members(session: AsyncSession, job: Job) -> dict | None:
    run_id = job.payload.get("run_id")
    if not isinstance(run_id, int):
        raise jobs.PermanentJobError("payload.run_id가 없습니다.")
    return await partner_sync.run(session, run_id)


@jobs.on_failed(partner_sync.JOB_KIND)
async def mark_run_failed(session: AsyncSession, job: Job, error: str) -> None:
    run_id = job.payload.get("run_id")
    if isinstance(run_id, int):
        await partner_sync.mark_failed(session, run_id, error)
