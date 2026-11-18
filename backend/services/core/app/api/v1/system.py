"""시스템 상태 API.

GET /admin/system/worker   Background Worker 생존 여부와 작업 큐 현황
GET /admin/system/jobs     작업 큐 목록 (상태·종류 필터)
"""

from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import func, select

from app.config import settings
from app.deps import AdminUser, Session
from app.models import Job, WorkerHeartbeat
from app.services import jobs as jobs_svc

router = APIRouter(tags=["admin-system"])


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


@router.get("/admin/system/worker", summary="Worker 상태")
async def worker_status(admin: AdminUser, session: Session) -> dict:
    """최근 하루 안에 기록을 남긴 Worker. 주기의 3배 넘게 소식이 없으면 alive=false."""
    now = datetime.now(UTC)
    limit = timedelta(seconds=max(settings.worker_tick_seconds * 3, 90))
    rows = await session.scalars(select(WorkerHeartbeat).order_by(WorkerHeartbeat.last_seen_at.desc()))
    workers = [
        {
            "worker_id": w.worker_id,
            "started_at": _iso(w.started_at),
            "last_seen_at": _iso(w.last_seen_at),
            "alive": now - w.last_seen_at <= limit,
            "last_tick": w.last_tick or {},
        }
        for w in rows
    ]
    return {
        "alive": any(w["alive"] for w in workers),
        "workers": workers,
        "jobs": await jobs_svc.counts_by_status(session),
    }


@router.get("/admin/system/jobs", summary="작업 큐 목록")
async def list_jobs(
    admin: AdminUser,
    session: Session,
    status: Annotated[str | None, Query(description="PENDING | RUNNING | SUCCEEDED | FAILED | CANCELLED")] = None,
    kind: Annotated[str | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> dict:
    query = select(Job)
    if status:
        query = query.where(Job.status == status.upper())
    if kind:
        query = query.where(Job.kind == kind)
    total = await session.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = await session.scalars(query.order_by(Job.id.desc()).offset((page - 1) * page_size).limit(page_size))
    return {
        "items": [
            {
                "id": j.id,
                "kind": j.kind,
                "status": j.status,
                "attempts": j.attempts,
                "max_attempts": j.max_attempts,
                "run_at": _iso(j.run_at),
                "ref_type": j.ref_type,
                "ref_id": j.ref_id,
                "last_error": j.last_error,
                "result": j.result,
                "created_at": _iso(j.created_at),
                "finished_at": _iso(j.finished_at),
            }
            for j in rows
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }
