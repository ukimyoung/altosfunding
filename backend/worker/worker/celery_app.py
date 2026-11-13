import os

from celery import Celery

broker_url = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/1")

app = Celery("altosfunding", broker=broker_url, include=["worker.tasks"])
app.conf.update(
    task_acks_late=True,  # Render 배포 시 SIGTERM으로 종료돼도 작업이 다시 실행되도록
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    timezone="UTC",
)
