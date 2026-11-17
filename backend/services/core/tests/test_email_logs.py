"""메일 발송 이력: 보낸 메일마다 남고, 백오피스에서 조회한다."""

from app.services.email import EmailSendError, LoggingEmailSender, get_email_sender
from tests.conftest import run_sql
from tests.test_admin_users import admin_headers  # noqa: F401
from tests.test_login import member  # noqa: F401
from tests.test_signup import EMAIL
from tests.test_wallets import TRADER, _deposit, trader  # noqa: F401

URL = "/api/v1/admin/logs"


class Failing:
    async def send(self, *args, **kwargs):
        raise EmailSendError("MessageRejected: Email address is not verified.")


def test_every_mail_is_logged_without_secrets(client, member, sent_emails):  # noqa: F811
    rows = run_sql("select * from core.email_logs order by id")
    # 회원가입 인증코드 + 가입 환영
    assert [r["template_id"] for r in rows] == [
        "email_verification_requested",
        "user_registered",
    ]
    assert all(r["status"] == "SENT" and r["provider"] == "console" for r in rows)
    assert rows[0]["recipient"] == EMAIL.lower() and rows[1]["user_id"] is not None
    code = sent_emails[0]["code"]
    # 인증코드는 이력 어디에도 남지 않는다
    assert all(code not in str(v) for r in rows for v in r.values())


def test_list_filters_summary_and_detail(client, admin_headers, trader, sent_emails):  # noqa: F811
    from app.main import app

    assert client.get(URL, headers=trader).status_code == 403
    dep = _deposit(client, trader, amount=100).json()["request_id"]
    client.post(f"/api/v1/admin/wallets/deposits/{dep}/approve", headers=admin_headers)

    # 발송 실패도 이력에 남는다
    app.dependency_overrides[get_email_sender] = lambda: LoggingEmailSender(
        Failing(), "ses"
    )
    try:
        dep2 = _deposit(client, trader, amount=50, tx_hash="0xdef").json()["request_id"]
        res = client.post(
            f"/api/v1/admin/wallets/deposits/{dep2}/approve", headers=admin_headers
        )
        assert res.status_code == 200  # 메일 실패해도 승인은 완료
    finally:
        app.dependency_overrides.pop(get_email_sender, None)

    body = client.get(
        URL, headers=admin_headers, params={"event_type": "deposit_confirmed"}
    ).json()
    assert body["total"] == 2 and body["summary"] == {
        "total": 2,
        "sent": 1,
        "failed": 1,
    }
    failed, sent = body["items"]  # 최신순
    assert failed["status"] == "FAILED" and "not verified" in failed["error_message"]
    assert sent["status"] == "SENT" and sent["recipient"] == TRADER
    assert sent["template_name"] == "입금 승인" and sent["send_mode"] == "instant"

    only_failed = client.get(
        URL, headers=admin_headers, params={"status": "FAILED"}
    ).json()
    assert [i["id"] for i in only_failed["items"]] == [failed["id"]]
    assert (
        client.get(URL, headers=admin_headers, params={"keyword": "nobody@x"}).json()[
            "total"
        ]
        == 0
    )
    assert (
        client.get(URL, headers=admin_headers, params={"keyword": "TARGET@"}).json()[
            "total"
        ]
        >= 2
    )
    assert (
        client.get(
            URL,
            headers=admin_headers,
            params={"start_date": "2000-01-01", "end_date": "2000-01-02"},
        ).json()["total"]
        == 0
    )

    detail = client.get(f"{URL}/{failed['id']}", headers=admin_headers).json()
    assert detail["provider"] == "ses" and detail["user_uid"]
    assert (
        client.get(f"{URL}/999999", headers=admin_headers).json()["error_code"]
        == "log_not_found"
    )

    grouped = client.get(
        URL,
        headers=admin_headers,
        params={"group_by_batch": True, "event_type": "deposit_confirmed"},
    ).json()
    assert grouped["total"] == 2 and grouped["items"][0]["total_count"] == 1

    events = client.get("/api/v1/admin/events", headers=admin_headers).json()["events"]
    assert {"id": "deposit_confirmed", "name": "입금 승인"} in events
