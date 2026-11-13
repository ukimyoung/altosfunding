"""Notification Hub: 이메일(SES), 웹/앱 푸시 등 알림 발송 서비스."""

from fastapi import FastAPI

from app.api.health import router as health_router
from app.config import settings

app = FastAPI(title="Notification Hub", version="0.1.0")
app.include_router(health_router)


@app.get("/")
def root() -> dict[str, str]:
    return {"service": "notification_hub", "environment": settings.app_env}
