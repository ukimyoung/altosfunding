from fastapi import APIRouter
from sqlalchemy import text

from app.api.v1.auth import Session
from app.errors import AppError

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health/db")
async def health_db(session: Session) -> dict[str, str]:
    """DB 연결과 마이그레이션 적용 여부를 확인한다 (배포 직후 점검용)."""
    try:
        await session.execute(text("select 1 from core.users limit 1"))
    except Exception as exc:  # noqa: BLE001
        raise AppError(503, "database_unavailable", f"DB 확인 실패: {type(exc).__name__}") from exc
    return {"status": "ok"}
