"""Broker Gateway: MT4 서버와 통신하는 내부 전용 서비스 (Render Private Service). Sandbox는 데모 MT4 서버에만 연결합니다."""

from fastapi import FastAPI

from app.api.health import router as health_router
from app.config import settings

app = FastAPI(title="Broker Gateway", version="0.1.0")
app.include_router(health_router)


@app.get("/")
def root() -> dict[str, str]:
    return {"service": "broker_gateway", "environment": settings.app_env}
