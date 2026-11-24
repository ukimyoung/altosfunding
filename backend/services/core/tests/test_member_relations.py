"""회원 조직 관계(추천인 sponsor / 수당 조직 상위 placement parent)."""

import asyncio
import uuid

import pytest

from app import db
from app.errors import AppError
from app.services import member_relations
from tests.conftest import run_sql
from tests.test_admin_users import _create, admin_headers  # noqa: F401
from tests.test_login import _login, member  # noqa: F401


def _id(email: str) -> uuid.UUID:
    return uuid.UUID(str(run_sql("select id from core.users where email = $1", email)[0]["id"]))


def _relation(email: str) -> dict:
    row = run_sql(
        "select sponsor_id, placement_parent_id from core.member_relations r"
        " join core.users u on u.id = r.member_id where u.email = $1",
        email,
    )[0]
    return {k: (uuid.UUID(str(v)) if v else None) for k, v in row.items()}


def _history(email: str) -> list[dict]:
    return [
        dict(r)
        for r in run_sql(
            "select change_type, reason, actor_id, old_placement_parent_id, new_placement_parent_id"
            " from core.member_relation_history h join core.users u on u.id = h.member_id"
            " where u.email = $1 order by h.id",
            email,
        )
    ]


def _run(fn):
    db.get_engine()

    async def _go():
        async with db._sessionmaker() as session:
            result = await fn(session)
            await session.commit()
            return result

    return asyncio.run(_go())


@pytest.fixture
def chain(client, admin_headers):  # noqa: F811
    """a ← b ← c ← d (각자 앞 사람이 추천인·상위)."""
    emails = [f"{n}@example.com" for n in "abcd"]
    for email in emails:
        _create(client, admin_headers, email=email)
    for upper, lower in zip(emails, emails[1:]):
        lo, up = _id(lower), _id(upper)
        _run(lambda s, lo=lo, up=up: member_relations.set_sponsor(s, lo, up, change_type=member_relations.SIGNUP))
    return emails


def test_every_user_gets_relation_row(client, admin_headers):  # noqa: F811
    _create(client, admin_headers, email="solo@example.com")
    assert _relation("solo@example.com") == {"sponsor_id": None, "placement_parent_id": None}


def test_sponsor_sets_placement_and_history(chain):
    a, b, *_ = chain
    assert _relation(b) == {"sponsor_id": _id(a), "placement_parent_id": _id(a)}
    assert [h["change_type"] for h in _history(b)] == ["SIGNUP"]


def test_placement_change_keeps_sponsor_and_records_reason(chain, admin_headers):  # noqa: F811
    a, b, c, d = chain
    admin, ida, idd = _id("admin@example.com"), _id(a), _id(d)
    _run(lambda s: member_relations.set_placement_parent(s, idd, ida, actor_id=admin, reason="조직 정리"))
    assert _relation(d) == {"sponsor_id": _id(c), "placement_parent_id": _id(a)}
    last = _history(d)[-1]
    assert last["change_type"] == "PLACEMENT_CHANGE"
    assert last["reason"] == "조직 정리"
    assert uuid.UUID(str(last["actor_id"])) == admin
    assert uuid.UUID(str(last["old_placement_parent_id"])) == _id(c)


def test_cycle_and_self_are_blocked(chain):
    a, b, c, d = chain
    ida, idb, idc, idd = map(_id, chain)
    for parent in (idd, idb):  # a의 하위 회원은 a의 상위가 될 수 없다
        with pytest.raises(AppError) as err:
            _run(lambda s, p=parent: member_relations.set_placement_parent(s, ida, p, actor_id=None, reason="x"))
        assert err.value.error_code == "relation_cycle"
    with pytest.raises(AppError) as err:
        _run(lambda s: member_relations.set_placement_parent(s, ida, ida, actor_id=None, reason="x"))
    assert err.value.error_code == "relation_self"
    with pytest.raises(AppError) as err:
        _run(lambda s: member_relations.set_sponsor(s, ida, idc, change_type=member_relations.SPONSOR_CHANGE))
    assert err.value.error_code == "relation_cycle"
    assert _relation(a) == {"sponsor_id": None, "placement_parent_id": None}


def test_subtree_moves_with_member(chain):
    a, b, c, d = chain
    ida, idc = _id(a), _id(c)
    _run(lambda s: member_relations.set_placement_parent(s, idc, ida, actor_id=None, reason="이동"))
    # d는 그대로 c 아래라서 c와 함께 a 아래로 옮겨진다.
    assert _relation(d)["placement_parent_id"] == _id(c)
    assert _relation(c)["placement_parent_id"] == _id(a)


def test_admin_referrer_change_keeps_placement(client, admin_headers, chain):  # noqa: F811
    a, b, c, d = chain
    users = client.get("/api/v1/admin/users", headers=admin_headers, params={"keyword": d}).json()
    target = next(u for u in users["items"] if u["email"] == d)
    code_a = run_sql("select referral_code from core.users where email = $1", a)[0]["referral_code"]
    res = client.patch(f"/api/v1/admin/users/{target['id']}/profile", headers=admin_headers, json={"referrer_code": code_a})
    assert res.status_code == 200, res.text
    assert _relation(d) == {"sponsor_id": _id(a), "placement_parent_id": _id(c)}
    assert _history(d)[-1]["change_type"] == "SPONSOR_CHANGE"
    detail = client.get(f"/api/v1/admin/users/{target['id']}", headers=admin_headers).json()
    assert detail["referrer_code"] == code_a
