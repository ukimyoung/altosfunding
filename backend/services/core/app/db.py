"""Supabase Postgres 연결. Core Backend는 Data API가 아니라 Postgres에 직접 접속한다."""

from collections.abc import AsyncIterator
from datetime import datetime

from sqlalchemy import DateTime, MetaData
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.config import settings


class Base(DeclarativeBase):
    # 테이블 정의의 기준은 supabase/migrations의 SQL이다. 모델은 그 구조를 그대로 옮긴다.
    metadata = MetaData(schema="core")
    # DB의 시각 컬럼은 모두 timestamptz다.
    type_annotation_map = {datetime: DateTime(timezone=True)}


_engine: AsyncEngine | None = None
_sessionmaker: async_sessionmaker[AsyncSession] | None = None


def get_engine() -> AsyncEngine:
    global _engine, _sessionmaker
    if _engine is None:
        if not settings.database_url:
            raise RuntimeError("DATABASE_URL이 설정되지 않았습니다.")
        kwargs: dict = {
            # Supabase 풀러(transaction 모드)에서도 동작하도록 prepared statement 캐시를 끈다.
            "connect_args": {"statement_cache_size": 0},
        }
        if settings.database_null_pool:
            kwargs["poolclass"] = NullPool
        else:
            kwargs.update(
                pool_size=settings.db_pool_size,
                max_overflow=settings.db_max_overflow,
                pool_timeout=settings.db_pool_timeout,
                pool_pre_ping=True,
            )
        _engine = create_async_engine(settings.database_url, **kwargs)
        _sessionmaker = async_sessionmaker(_engine, expire_on_commit=False)
    return _engine


async def get_session() -> AsyncIterator[AsyncSession]:
    get_engine()
    assert _sessionmaker is not None
    async with _sessionmaker() as session:
        yield session


async def dispose_engine() -> None:
    global _engine, _sessionmaker
    if _engine is not None:
        await _engine.dispose()
    _engine = None
    _sessionmaker = None
