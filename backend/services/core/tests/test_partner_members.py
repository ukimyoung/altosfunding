"""제휴사 회원 원본 테이블(core.partner_members)."""

import asyncpg
import pytest

from tests.conftest import run_sql


def _insert(member_id: str, **overrides) -> None:
    values = {
        "site": "10power",
        "name": "HONG GILDONG",
        "email": "sample@example.com",
        "status": "active",
    } | overrides
    run_sql(
        "insert into core.partner_members (member_id, site, name, email, status, joined_at, partner_updated_at)"
        " values ($1, $2, $3, $4, $5, now(), now())",
        member_id,
        values["site"],
        values["name"],
        values["email"],
        values["status"],
    )


def test_same_email_allowed_for_different_members(db) -> None:
    _insert("sample01")
    _insert("sample02")
    rows = run_sql("select member_id from core.partner_members where email = 'sample@example.com' order by 1")
    assert [r["member_id"] for r in rows] == ["sample01", "sample02"]


def test_member_id_is_unique_ignoring_case(db) -> None:
    _insert("KimYoung")
    with pytest.raises(asyncpg.UniqueViolationError):
        _insert("kimyoung")


@pytest.mark.parametrize(
    "member_id,overrides",
    [
        ("bad@id", {}),
        ("", {}),
        ("x1", {"status": "withdrawn"}),
        ("x2", {"site": "other"}),
    ],
)
def test_invalid_values_rejected(db, member_id: str, overrides: dict) -> None:
    with pytest.raises(asyncpg.CheckViolationError):
        _insert(member_id, **overrides)
