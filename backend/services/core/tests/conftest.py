"""테스트 공통 설정.

DB 테스트는 실제 Postgres에 supabase/migrations의 SQL을 적용해서 돌린다.
TEST_DATABASE_URL이 없으면 DB 테스트는 건너뛴다.

    TEST_DATABASE_URL=postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/altos_test pytest
"""

import asyncio
import os
from pathlib import Path

import pytest

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "")
MIGRATIONS_DIR = Path(__file__).resolve().parents[4] / "supabase" / "migrations"

os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["DATABASE_NULL_POOL"] = "true"
os.environ["RECAPTCHA_SECRET_KEY"] = ""
os.environ["EMAIL_BACKEND"] = "console"
# 테스트 클라이언트는 http라서 Secure 쿠키를 돌려보내지 않는다.
os.environ["COOKIE_SECURE"] = "false"


def _asyncpg_dsn(url: str) -> str:
    return url.replace("postgresql+asyncpg://", "postgresql://", 1)


async def _reset_schema() -> None:
    import asyncpg

    conn = await asyncpg.connect(_asyncpg_dsn(TEST_DATABASE_URL))
    try:
        await conn.execute("drop schema if exists core cascade; drop schema if exists notification cascade;")
        for sql_file in sorted(MIGRATIONS_DIR.glob("*.sql")):
            await conn.execute(sql_file.read_text(encoding="utf-8"))
    finally:
        await conn.close()


async def _truncate() -> None:
    import asyncpg

    conn = await asyncpg.connect(_asyncpg_dsn(TEST_DATABASE_URL))
    try:
        await conn.execute("truncate core.email_verifications, core.users restart identity cascade")
    finally:
        await conn.close()


@pytest.fixture(scope="session")
def migrated_db() -> None:
    if not TEST_DATABASE_URL:
        pytest.skip("TEST_DATABASE_URL이 없어 DB 테스트를 건너뜁니다.")
    asyncio.run(_reset_schema())


@pytest.fixture
def db(migrated_db: None) -> None:
    asyncio.run(_truncate())


@pytest.fixture
def client(db: None):
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def sent_emails():
    from app.services.email import get_email_sender

    sender = get_email_sender()
    sender.sent.clear()
    return sender.sent


def run_sql(sql: str, *args):
    """테스트에서 DB 상태를 직접 바꾸거나 확인할 때 쓴다."""
    import asyncpg

    async def _run():
        conn = await asyncpg.connect(_asyncpg_dsn(TEST_DATABASE_URL))
        try:
            return await conn.fetch(sql, *args)
        finally:
            await conn.close()

    return asyncio.run(_run())
