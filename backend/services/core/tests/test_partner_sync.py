"""제휴사 회원 가져오기 (가짜 제휴사 API·작업 큐·deleted 반영·관리자 API)."""

import asyncio

import pytest

from app.config import settings
from app.services import partner_sync
from tests.conftest import run_sql
from tests.test_admin_users import admin_headers  # noqa: F401
from tests.test_login import _login, member  # noqa: F401
from tests.test_partner_login import _activate

BASE = "/api/v1/admin/partner-members"


def _work():
    from app import db
    from app.jobs import partner as _handlers  # noqa: F401  처리기 등록
    from app.worker import run_job_queue

    db.get_engine()
    run_sql("update core.jobs set run_at = now() - interval '1 second' where status = 'PENDING'")
    asyncio.run(run_job_queue(db._sessionmaker))


@pytest.fixture
def mock_api(monkeypatch):
    monkeypatch.setattr(settings, "partner_members_api_url", "mock")
    monkeypatch.setattr(settings, "partner_sync_page_size", 10)


def _item(member_id, status="active", updated="2026-12-10T09:05:42+09:00", **extra):
    return {
        "member_id": member_id,
        "site": "10power",
        "name": "HONG GILDONG",
        "email": " Shared@Example.com ",
        "phone": "01012345678",
        "sponsor_id": None,
        "account_status": status,
        "joined_at": "2025-03-02T14:20:11+09:00",
        "membership": {"expires_on": "2026-12-31", "active": True},
        "updated_at": updated,
        **extra,
    }


@pytest.fixture
def fake_api(monkeypatch):
    """페이지 목록을 바꿔 끼우는 가짜 제휴사 API. calls에 (since, cursor)를 남긴다."""

    class Fake:
        def __init__(self) -> None:
            self.pages: list[dict] = []
            self.calls: list = []
            self.error: Exception | None = None

    fake = Fake()

    async def fetch_page(since, cursor, limit):
        fake.calls.append((since, cursor))
        if fake.error:
            raise fake.error
        index = int(cursor) if cursor else 0
        return fake.pages[index]

    monkeypatch.setattr(settings, "partner_members_api_url", "https://partner.test/api/partner/v1/members")
    monkeypatch.setattr(settings, "partner_members_api_key", "k")
    monkeypatch.setattr(partner_sync, "fetch_page", fetch_page)
    return fake


def _page(items, *, next_cursor=None, as_of="2026-12-10T09:10:00+09:00"):
    return {"as_of": as_of, "has_more": next_cursor is not None, "next_cursor": next_cursor, "items": items}


def _sync(client, headers, mode="INCREMENTAL"):
    res = client.post(f"{BASE}/sync", headers=headers, json={"mode": mode})
    assert res.status_code == 200, res.text
    _work()
    return client.get(f"{BASE}/sync-runs/{res.json()['id']}", headers=headers).json()


def test_not_configured(client, admin_headers, monkeypatch):  # noqa: F811
    monkeypatch.setattr(settings, "partner_members_api_url", "")
    res = client.post(f"{BASE}/sync", headers=admin_headers, json={"mode": "FULL"})
    assert (res.status_code, res.json()["error_code"]) == (409, "partner_api_not_configured")
    status = client.get(f"{BASE}/sync", headers=admin_headers).json()
    assert status["configured"] is False and status["running"] is None


def test_mock_full_then_incremental(client, admin_headers, mock_api):  # noqa: F811
    run = _sync(client, admin_headers, "FULL")
    assert run["status"] == "SUCCEEDED", run
    assert (run["pages"], run["fetched"], run["inserted"], run["failed"]) == (3, 25, 25, 0)
    assert run["requested_by_email"]

    members = client.get(BASE, headers=admin_headers, params={"size": 100}).json()
    assert members["total"] == 25
    shared = client.get(BASE, headers=admin_headers, params={"keyword": "mock-shared"}).json()
    assert shared["total"] == 3
    assert client.get(BASE, headers=admin_headers, params={"site": "xnsoft"}).json()["total"] == 5
    assert client.get(BASE, headers=admin_headers, params={"linked": True}).json()["total"] == 0
    summary = client.get(f"{BASE}/summary", headers=admin_headers).json()
    assert summary["total"] == 25 and summary["status"]["deleted"] == 1 and summary["no_email"] == 1

    # 변경분: 마지막 성공 as_of − 5분 이후 바뀐 회원만 → 가짜 데이터는 그대로라 0건
    again = _sync(client, admin_headers)
    assert again["status"] == "SUCCEEDED"
    assert again["since"] is not None and again["fetched"] == 0

    # 전체 다시: 모두 '변화 없음'
    full = _sync(client, admin_headers, "FULL")
    assert (full["fetched"], full["unchanged"], full["inserted"], full["updated"]) == (25, 25, 0, 0)

    status = client.get(f"{BASE}/sync", headers=admin_headers).json()
    assert status["configured"] and status["mock"] and status["last_succeeded"]["id"] == full["id"]
    history = client.get(f"{BASE}/sync-runs", headers=admin_headers).json()
    assert history["total"] == 3


def test_one_run_at_a_time(client, admin_headers, mock_api):  # noqa: F811
    assert client.post(f"{BASE}/sync", headers=admin_headers, json={"mode": "FULL"}).status_code == 200
    res = client.post(f"{BASE}/sync", headers=admin_headers, json={"mode": "INCREMENTAL"})
    assert (res.status_code, res.json()["error_code"]) == (409, "partner_sync_running")
    assert client.get(f"{BASE}/sync", headers=admin_headers).json()["running"]["status"] == "QUEUED"


def test_items_are_validated_and_upserted(client, admin_headers, fake_api):  # noqa: F811
    fake_api.pages = [
        _page(
            [
                _item("ukim"),
                _item("bad@id"),
                _item("", status="active"),
                _item("odd", status="banned"),
                _item("baddate", joined_at="yesterday"),
                # 예전 항목 이름 status만 있으면 실패 (2026-11-28부터 account_status)
                {k: v for k, v in _item("oldkey").items() if k != "account_status"} | {"status": "active"},
            ],
            next_cursor="1",
        ),
        _page([_item("UKIM", phone=None, updated="2026-12-10T09:06:00+09:00"), _item("yoy", email="")]),
    ]
    run = _sync(client, admin_headers, "FULL")
    assert run["status"] == "SUCCEEDED", run
    assert (run["fetched"], run["inserted"], run["updated"], run["failed"]) == (8, 2, 1, 5)
    assert {f["member_id"] for f in run["failures"]} == {"bad@id", "", "odd", "baddate", "oldkey"}
    rows = run_sql("select member_id, email, phone, last_sync_run_id from core.partner_members order by 1")
    assert [(r["member_id"], r["email"], r["phone"]) for r in rows] == [
        ("ukim", "shared@example.com", None),
        ("yoy", None, "01012345678"),
    ]
    assert fake_api.calls == [(None, None), (None, "1")]


def test_deleted_deactivates_and_restores_account(client, sent_emails, fake_api, admin_headers):  # noqa: F811
    fake_api.pages = [_page([_item("ukim"), _item("kept")])]
    _sync(client, admin_headers, "FULL")
    _activate(client, sent_emails, "ukim")
    _activate(client, sent_emails, "kept")
    assert _login(client, email="ukim").status_code == 200

    fake_api.pages = [_page([_item("ukim", status="deleted", updated="2026-12-11T09:00:00+09:00")])]
    run = _sync(client, admin_headers)
    assert run["deactivated"] == 1
    assert run["since"].startswith("2026-12-10T00:05:00")  # as_of 09:10 KST − 5분 (UTC 표기)
    assert _login(client, email="ukim").json()["error_code"] == "account_deactivated"
    reason = run_sql(
        "select h.reason from core.user_status_history h join core.users u on u.id = h.user_id"
        " where u.partner_member_id = 'ukim' order by h.id desc limit 1"
    )[0]["reason"]
    assert reason == "PARTNER_DELETED"

    # 관리자가 직접 막은 계정은 제휴사 상태가 돌아와도 그대로
    kept = run_sql("select id from core.users where partner_member_id = 'kept'")[0]["id"]
    res = client.post(f"/api/v1/admin/users/{kept}/suspend", headers=admin_headers, json={"reason": "manual"})
    assert res.status_code == 200, res.text

    fake_api.pages = [
        _page([_item("ukim", updated="2026-12-12T09:00:00+09:00"), _item("kept", status="suspended", updated="2026-12-12T09:00:00+09:00")])
    ]
    run = _sync(client, admin_headers)
    assert (run["reactivated"], run["deactivated"]) == (1, 0)
    assert _login(client, email="ukim").status_code == 200
    assert run_sql("select status from core.users where partner_member_id = 'kept'")[0]["status"] == "INACTIVE"

    linked = client.get(BASE, headers=admin_headers, params={"linked": True}).json()
    assert {m["member_id"] for m in linked["items"]} == {"ukim", "kept"}
    assert all(m["user_uid"] for m in linked["items"])


def test_api_error_fails_run_and_next_run_keeps_since(client, admin_headers, fake_api):  # noqa: F811
    fake_api.pages = [_page([_item("ukim")])]
    ok = _sync(client, admin_headers, "FULL")
    fake_api.error = partner_sync.PartnerApiError("허용되지 않은 IP입니다(403)", 403)
    failed = _sync(client, admin_headers)
    assert failed["status"] == "FAILED" and "403" in failed["error"]
    fake_api.error = None
    fake_api.pages = [_page([])]
    retry = _sync(client, admin_headers)
    assert retry["status"] == "SUCCEEDED"
    assert retry["since"] == failed["since"]  # 기준은 마지막 성공 회차
    assert ok["status"] == "SUCCEEDED"


def test_scheduled_run(client, admin_headers, mock_api):  # noqa: F811
    from app import db

    db.get_engine()

    async def schedule():
        async with db._sessionmaker() as session:
            return await partner_sync.start_scheduled(session)

    assert "queued_run" in asyncio.run(schedule())
    assert asyncio.run(schedule()) == {}  # 실행 중이면 넣지 않는다
    _work()
    run = run_sql("select status, requested_by, fetched from core.partner_member_sync_runs")[0]
    assert (run["status"], run["requested_by"], run["fetched"]) == ("SUCCEEDED", None, 25)
