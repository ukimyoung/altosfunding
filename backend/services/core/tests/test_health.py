from fastapi.testclient import TestClient

from app.main import app


def test_health() -> None:
    res = TestClient(app).get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_health_db(client) -> None:
    assert client.get("/health/db").json() == {"status": "ok"}


def test_database_url_accepts_supabase_format() -> None:
    from app.config import Settings

    url = Settings(database_url="postgresql://u:p@host:5432/postgres").database_url
    assert url == "postgresql+asyncpg://u:p@host:5432/postgres"
