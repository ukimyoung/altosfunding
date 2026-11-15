"""Core Backend: 회원, 챌린지, MT4 계좌, 거래 기록 조회 등 핵심 API (공개 Web Service)."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.health import router as health_router
from app.api.v1 import router as v1_router
from app.config import settings
from app.db import dispose_engine
from app.errors import register_error_handlers


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    yield
    await dispose_engine()


app = FastAPI(title="Core Backend", version="0.1.0", lifespan=lifespan)
register_error_handlers(app)
app.include_router(health_router)
app.include_router(v1_router)


@app.get("/")
def root() -> dict[str, str]:
    return {"service": "core", "environment": settings.app_env}
