"""제휴 회원 IB 자동 등록·제휴사 추천인 연결 (사전 가입·활성화·다시 맞추기)."""

from tests.conftest import run_sql
from tests.test_admin_users import admin_headers  # noqa: F401
from tests.test_login import member  # noqa: F401
from tests.test_partner_login import _activate

BASE = "/api/v1/admin/partner-members"


def _partner(member_id: str, sponsor: str | None = None, email: str | None = "x@example.com", status: str = "active"):
    run_sql(
        "insert into core.partner_members (member_id, site, name, email, sponsor_member_id, status, joined_at,"
        " partner_updated_at) values ($1, '10power', $1, $2, $3, $4, now(), now())",
        member_id,
        email,
        sponsor,
        status,
    )


def _pre(client, headers, *ids):
    res = client.post(f"{BASE}/pre-register", json={"member_ids": list(ids)}, headers=headers)
    assert res.status_code == 200, res.text
    return res.json()


def _relation(member_id: str) -> tuple[str | None, str | None]:
    """(추천인 Member ID, 수당 조직 상위 Member ID)"""
    row = run_sql(
        "select s.partner_member_id sponsor, p.partner_member_id placement from core.users u"
        " join core.member_relations r on r.member_id = u.id"
        " left join core.users s on s.id = r.sponsor_id left join core.users p on p.id = r.placement_parent_id"
        " where u.partner_member_id = $1",
        member_id,
    )[0]
    return row["sponsor"], row["placement"]


def _ib(member_id: str) -> tuple[int, str] | None:
    rows = run_sql(
        "select i.level, i.status from core.ib_profiles i join core.users u on u.id = i.user_id"
        " where u.partner_member_id = $1",
        member_id,
    )
    return (rows[0]["level"], rows[0]["status"]) if rows else None


def _list(client, headers, keyword: str) -> dict:
    items = client.get(BASE, params={"keyword": keyword}, headers=headers).json()["items"]
    return {m["member_id"]: m for m in items}


def test_pre_register_registers_ib_and_links_sponsors_both_ways(client, admin_headers):  # noqa: F811
    _partner("top")
    _partner("mid", sponsor="top")
    _partner("leaf", sponsor="MID")  # 대소문자 무시
    _partner("orphan", sponsor="ghost")  # 제휴사에 없는 추천인
    _partner("noemail", email=None)
    _partner("under", sponsor="noemail")  # 추천인이 이메일이 없어 계정을 못 만든다
    _partner("gone", sponsor="top", status="deleted")

    # 아래부터 사전 가입: 추천인 계정이 아직 없으면 비워 둔다
    res = _pre(client, admin_headers, "leaf", "orphan", "under")
    assert res["network"] == {
        "ib_created": 3,
        "sponsors_linked": 0,
        "sponsor_skipped": {"sponsor_no_account": 2, "sponsor_not_found": 1},
    }
    assert _relation("leaf") == (None, None)

    # 위를 사전 가입하면 아래 회원도 함께 연결된다 (양방향)
    res = _pre(client, admin_headers, "mid", "top", "gone")
    assert res["network"]["ib_created"] == 3
    assert res["network"]["sponsors_linked"] == 3  # mid→top, leaf→mid, gone→top
    assert _relation("mid") == ("top", "top")
    assert _relation("leaf") == ("mid", "mid")
    assert _relation("gone") == ("top", "top")
    assert _relation("top") == (None, None)
    assert _relation("under") == (None, None) and _relation("orphan") == (None, None)
    assert _ib("top") == (1, "ACTIVE") and _ib("leaf") == (1, "ACTIVE")
    assert _ib("gone") == (1, "INACTIVE")  # 제휴사 삭제 회원
    history = run_sql(
        "select h.reason from core.member_relation_history h join core.users u on u.id = h.member_id"
        " where u.partner_member_id = 'leaf' and h.change_type = 'SPONSOR_SET'"
    )
    assert [h["reason"] for h in history] == ["제휴사 추천인 연결"]

    listed = _list(client, admin_headers, "")
    assert listed["leaf"]["linked_sponsor_member_id"] == "mid" and listed["leaf"]["sponsor_mismatch"] is False
    assert listed["under"]["sponsor_mismatch"] is True  # 제휴사 추천인은 있는데 연결 못 함
    assert listed["top"]["sponsor_mismatch"] is False

    # 제휴사 추천인이 나중에 바뀌어도 자동으로 바꾸지 않고 '다름'으로 보여 준다
    run_sql("update core.partner_members set sponsor_member_id = 'top' where member_id = 'leaf'")
    resync = client.post(f"{BASE}/network-resync", headers=admin_headers).json()
    assert resync["sponsors_linked"] == 0 and resync["ib_created"] == 0
    assert _relation("leaf") == ("mid", "mid")
    assert _list(client, admin_headers, "leaf")["leaf"]["sponsor_mismatch"] is True


def test_resync_fills_missing_ib_and_sponsors(client, admin_headers):  # noqa: F811
    _partner("top")
    _partner("kid", sponsor="top")
    _pre(client, admin_headers, "top", "kid")
    # 이 기능 전에 만든 계정처럼 IB·추천인이 비어 있는 상태
    run_sql("delete from core.ib_profiles")
    run_sql("update core.member_relations set sponsor_id = null, placement_parent_id = null")
    res = client.post(f"{BASE}/network-resync", headers=admin_headers)
    assert res.status_code == 200, res.text
    assert res.json() == {"ib_created": 2, "sponsors_linked": 1, "sponsor_skipped": {}}
    assert _relation("kid") == ("top", "top") and _ib("kid") == (1, "ACTIVE")
    assert client.post(f"{BASE}/network-resync").status_code == 401


def test_activation_without_pre_register_registers_ib_and_links(client, admin_headers, sent_emails):  # noqa: F811
    _partner("top", email="top@example.com")
    _partner("kid", sponsor="top", email="kid@example.com")
    _activate(client, sent_emails, "kid")
    assert _ib("kid") == (1, "ACTIVE") and _relation("kid") == (None, None)
    _activate(client, sent_emails, "top")
    assert _relation("kid") == ("top", "top") and _ib("top") == (1, "ACTIVE")
