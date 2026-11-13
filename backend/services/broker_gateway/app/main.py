"""Broker Gateway: 브로커 MT4 REST API를 호출하는 내부 전용 서비스 (Render Private Service)."""

from fastapi import FastAPI

from app.api.health import router as health_router
from app.config import settings

app = FastAPI(title="Broker Gateway", version="0.1.0")
app.include_router(health_router)


@app.get("/")
def root() -> dict[str, str]:
    return {"service": "broker_gateway", "environment": settings.app_env}
