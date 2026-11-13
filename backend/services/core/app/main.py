"""Core Backend: 회원, 챌린지, MT4 계좌, 거래 기록 조회 등 핵심 API (공개 Web Service)."""

from fastapi import FastAPI

from app.api.health import router as health_router
from app.config import settings

app = FastAPI(title="Core Backend", version="0.1.0")
app.include_router(health_router)


@app.get("/")
def root() -> dict[str, str]:
    return {"service": "core", "environment": settings.app_env}
