from worker.celery_app import app


@app.task
def ping() -> str:
    return "pong"
