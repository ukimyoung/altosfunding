"""수동 메일 발송: 대상 검색·임시 저장·발송·발송 이력 묶음."""

import json
from datetime import UTC, datetime, timedelta

import pytest

from app.config import settings
from tests.conftest import run_sql
from tests.test_admin_users import _create, admin_headers  # noqa: F401
from tests.test_login import member  # noqa: F401

BASE = "/api/v1/admin/notifications/manual-send"
CONTENT = {
    "en": {"subject": "Hello {{ user_name }}", "html_content": "<p>Hi {{user_name}}, news!</p>"},
    "ko": {"subject": "안녕하세요 {{ user_name }}님", "html_content": "<p>{{user_name}}님, 소식입니다</p>"},
}


@pytest.fixture(autouse=True)
def _fast(monkeypatch):
    monkeypatch.setattr(settings, "manual_email_rate_per_second", 0)


@pytest.fixture
def members(client, admin_headers):  # noqa: F811
    _create(client, admin_headers, email="sub@example.com", first_name="Sub")
    _create(client, admin_headers, email="nosub@example.com", first_name="No")
    _create(client, admin_headers, email="vip@example.com", first_name="Vip", grade="VIP")
    run_sql("update core.users set subscribed_newsletter = true where email in ('sub@example.com', 'vip@example.com')")
    run_sql("update core.users set locale = 'ko' where email = 'vip@example.com'")
    return admin_headers


def test_search_marks_unsubscribed_for_marketing(client, members):
    res = client.post(f"{BASE}/recipients/search", headers=members, json={"marketing_preview": True})
    body = res.json()
    assert res.status_code == 200
    # 관리자는 대상이 아니다
    assert body["total"] == 3 and body["subscribed_count"] == 2 and body["eligible"] == 2
    nosub = next(i for i in body["items"] if i["email"] == "nosub@example.com")
    assert nosub["eligible"] is False and nosub["skip_reason"] == "UNSUBSCRIBED"

    vip = client.post(f"{BASE}/recipients/search", headers=members, json={"grade": "VIP"}).json()
    assert [i["email"] for i in vip["items"]] == ["vip@example.com"]

    csv = client.get(f"{BASE}/recipients/export", headers=members, params={"grade": "NORMAL"})
    assert csv.status_code == 200 and "sub@example.com" in csv.text and "vip@" not in csv.text


def test_filter_all_marketing_send_skips_unsubscribed(client, members, sent_emails):
    draft = client.post(
        f"{BASE}/drafts",
        headers=members,
        json={"target_mode": "filter_all", "filter": {"grade": "ALL"}, "is_marketing": True, "content_locales": CONTENT},
    )
    assert draft.status_code == 200, draft.text
    d = draft.json()
    assert d["recipient_summary"]["eligible"] == 2 and d["recipient_summary"]["skipped"] == 1
    assert "Hi John Doe" in d["content_preview"]["html_rendered"]
    assert [x["draft_id"] for x in client.get(f"{BASE}/drafts", headers=members).json()["items"]] == [d["draft_id"]]

    sent_emails.clear()
    res = client.post(f"{BASE}/drafts/{d['draft_id']}/send", headers=members)
    assert res.status_code == 200, res.text
    job_id = res.json()["job_id"]
    assert res.json()["recipient_count"] == 2

    job = client.get(f"{BASE}/jobs/{job_id}", headers=members).json()
    assert job["status"] == "completed" and job["sent_count"] == 2 and job["skipped_count"] == 1
    by_email = {m["email"]: m for m in sent_emails}
    assert set(by_email) == {"sub@example.com", "vip@example.com"}
    # 회원 언어로, 이름을 넣어서
    assert by_email["vip@example.com"]["subject"] == "안녕하세요 Vip님"
    assert by_email["sub@example.com"]["subject"] == "Hello Sub"

    # 보낸 초안은 다시 보낼 수 없고 목록에서 빠진다
    assert client.post(f"{BASE}/drafts/{d['draft_id']}/send", headers=members).status_code == 409
    assert client.get(f"{BASE}/drafts", headers=members).json()["items"] == []

    # 발송 이력: 묶음 한 줄 + 묶음의 수신자별 이력
    grouped = client.get("/api/v1/admin/logs", headers=members, params={"group_by_batch": True}).json()
    batch = next(i for i in grouped["items"] if i["trace_id"] == job_id)
    assert batch["total_count"] == 2 and batch["success_count"] == 2 and batch["status"] == "SENT"
    assert batch["template_name"] == "수동 발송" and batch["recipient"] is None
    assert batch["subject"] == "Hello {{ user_name }}" and batch["send_mode"] == "instant"
    detail = client.get("/api/v1/admin/logs", headers=members, params={"trace_id": job_id}).json()
    assert {i["recipient"] for i in detail["items"]} == {"sub@example.com", "vip@example.com"}
    events = client.get("/api/v1/admin/events", headers=members).json()["events"]
    assert {"id": "manual_send", "name": "수동 발송"} in events


def test_manual_and_csv_targets(client, members, sent_emails):
    entries = ["sub@example.com", "SUB@example.com", "bad-address", "outsider@example.org", "nosub@example.com"]
    d = client.post(
        f"{BASE}/drafts",
        headers=members,
        json={"target_mode": "manual_input", "manual_entries": entries, "is_urgent": True, "content_locales": CONTENT},
    ).json()
    summary = d["recipient_summary"]
    # 긴급 공지는 수신거부 회원에게도 보낸다. 중복·형식 오류만 제외
    assert summary["total"] == 5 and summary["eligible"] == 3
    reasons = {i["email"]: i["skip_reason"] for i in summary["items"]}
    assert reasons["bad-address"] == "INVALID_EMAIL" and reasons["nosub@example.com"] is None

    # 마케팅으로 바꾸면 수신거부 회원 제외 (비회원 주소는 보낸다)
    d = client.patch(
        f"{BASE}/drafts/{d['draft_id']}", headers=members, json={"is_urgent": False, "is_marketing": True}
    ).json()
    assert d["recipient_summary"]["eligible"] == 2

    csv_body = "email,name\nvip@example.com,Vip\noutsider@example.org,Out\n"
    res = client.post(
        f"{BASE}/drafts",
        headers=members,
        data={"payload": json.dumps({"target_mode": "csv_import", "content_locales": CONTENT})},
        files={"file": ("list.csv", csv_body.encode(), "text/csv")},
    )
    assert res.status_code == 200, res.text
    c = res.json()
    assert c["target_mode"] == "csv_import" and c["recipient_summary"]["csv_rows"] == 2
    assert c["import_id"]

    sent_emails.clear()
    job = client.post(f"{BASE}/drafts/{c['draft_id']}/send", headers=members).json()
    assert {m["email"] for m in sent_emails} == {"vip@example.com", "outsider@example.org"}
    rows = run_sql("select user_id from core.email_logs where batch_id = $1 order by recipient", job["job_id"])
    assert rows[0]["user_id"] is None and rows[1]["user_id"] is not None


def test_scheduled_send_runs_when_due(client, members, sent_emails):
    send_at = (datetime.now(UTC) + timedelta(hours=1)).isoformat()
    d = client.post(
        f"{BASE}/drafts",
        headers=members,
        json={"target_mode": "manual_input", "manual_entries": ["outsider@example.org"], "is_marketing": False,
              "content_locales": CONTENT, "send_at": send_at},
    ).json()
    sent_emails.clear()
    res = client.post(f"{BASE}/drafts/{d['draft_id']}/send", headers=members).json()
    assert res["status"] == "queued" and res["scheduled_at"]
    assert sent_emails == []
    # 시각 전에는 보내지 않는다
    assert client.post(f"{BASE}/jobs/run-due", headers=members).json() == {"processed": 0}
    run_sql("update core.manual_email_jobs set send_at = now() - interval '1 minute'")
    assert client.post(f"{BASE}/jobs/run-due", headers=members).json() == {"processed": 1}
    assert [m["email"] for m in sent_emails] == ["outsider@example.org"]
    assert client.get(f"{BASE}/jobs/{res['job_id']}", headers=members).json()["status"] == "completed"


def test_validation(client, members):
    bad = client.post(
        f"{BASE}/drafts",
        headers=members,
        json={"target_mode": "manual_input", "manual_entries": ["a@b.com"],
              "content_locales": {"en": {"subject": "x", "html_content": "<p>{{ broken</p>"}}},
    )
    assert bad.status_code == 400 and bad.json()["error_code"] == "invalid_template"
    past = client.post(
        f"{BASE}/drafts",
        headers=members,
        json={"target_mode": "manual_input", "manual_entries": ["a@b.com"], "content_locales": CONTENT,
              "send_at": "2020-01-01T00:00:00+09:00"},
    )
    assert past.status_code == 422 and past.json()["error_code"] == "send_at_in_past"
    nobody = client.post(
        f"{BASE}/drafts",
        headers=members,
        json={"target_mode": "manual_input", "manual_entries": ["nosub@example.com"], "is_marketing": True,
              "content_locales": CONTENT},
    ).json()
    res = client.post(f"{BASE}/drafts/{nobody['draft_id']}/send", headers=members)
    assert res.status_code == 422 and res.json()["error_code"] == "no_recipients"


def test_image_upload_is_public(client, members):
    png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
    res = client.post(
        "/api/v1/admin/files",
        headers=members,
        params={"storage": "local", "ref_domain": "manual_send"},
        files={"file": ("a.png", png, "image/png")},
    )
    assert res.status_code == 200, res.text
    url = res.json()["url"]
    assert "/api/v1/files/" in url
    img = client.get(url.split("testserver")[-1])
    assert img.status_code == 200 and img.content == png and img.headers["content-type"] == "image/png"

    svg = client.post(
        "/api/v1/admin/files", headers=members, files={"file": ("x.svg", b"<svg onload=alert(1)>", "image/svg+xml")}
    )
    assert svg.status_code == 415


class Capture:
    """보낸 메일 본문까지 남긴다. fail_for 주소는 발송 실패."""

    def __init__(self, fail_for=()):
        self.mails = {}
        self.fail_for = set(fail_for)

    async def send(self, to, mail, kind, meta=None):
        if to in self.fail_for:
            raise RuntimeError("MessageRejected")
        self.mails[to] = mail
        return "msg-1"


def _send_with(client, headers, sender, body):
    from app.main import app
    from app.services.email import LoggingEmailSender, get_email_sender

    app.dependency_overrides[get_email_sender] = lambda: LoggingEmailSender(sender, "ses")
    try:
        d = client.post(f"{BASE}/drafts", headers=headers, json=body).json()
        res = client.post(f"{BASE}/drafts/{d['draft_id']}/send", headers=headers)
        assert res.status_code == 200, res.text
        return res.json()["job_id"]
    finally:
        app.dependency_overrides.pop(get_email_sender, None)


def test_marketing_mail_has_unsubscribe_link(client, members):
    cap = Capture()
    _send_with(client, members, cap, {"target_mode": "filter_all", "is_marketing": True, "content_locales": CONTENT})
    html = cap.mails["sub@example.com"].html
    assert "Unsubscribe" in html
    link = html.split('href="')[-2].split('"')[0].replace("&amp;", "&")
    path = link[link.index("/api/v1/newsletter/unsubscribe") :]

    assert client.get(path.replace("t=", "t=x")).status_code == 400
    page = client.get(path)
    assert page.status_code == 200 and "Unsubscribed" in page.text
    row = run_sql("select subscribed_newsletter, newsletter_unsubscribed_at from core.users where email = 'sub@example.com'")[0]
    assert row["subscribed_newsletter"] is False and row["newsletter_unsubscribed_at"] is not None

    unsub = client.post(f"{BASE}/recipients/unsubscribed/search", headers=members, json={}).json()
    assert {i["email"] for i in unsub["items"]} == {"sub@example.com", "nosub@example.com"}
    dated = client.post(
        f"{BASE}/recipients/unsubscribed/search", headers=members,
        json={"unsubscribed_from": "2020-01-01", "unsubscribed_to": "2099-12-31"},
    ).json()
    assert [i["email"] for i in dated["items"]] == ["sub@example.com"]

    # 긴급 공지에는 수신거부 링크가 없다
    cap2 = Capture()
    _send_with(client, members, cap2, {"target_mode": "manual_input", "manual_entries": ["vip@example.com"],
                                       "is_urgent": True, "content_locales": CONTENT})
    assert "수신거부" not in cap2.mails["vip@example.com"].html


def test_partial_failure_status_and_batch_row(client, members):
    job_id = _send_with(
        client, members, Capture(fail_for={"sub@example.com"}),
        {"target_mode": "filter_all", "is_marketing": True, "content_locales": CONTENT},
    )
    job = client.get(f"{BASE}/jobs/{job_id}", headers=members).json()
    assert job["status"] == "partial_failed" and job["sent_count"] == 1 and job["failed_count"] == 1
    grouped = client.get("/api/v1/admin/logs", headers=members, params={"group_by_batch": True}).json()
    batch = next(i for i in grouped["items"] if i["trace_id"] == job_id)
    assert batch["status"] == "PARTIAL" and batch["failed_count"] == 1
