"""업무 처리 뒤 보내는 회원 알림 메일 (입출금·KYC·회원 상태·가입)."""

from tests.conftest import run_sql
from tests.test_admin_users import _create, admin_headers  # noqa: F401
from tests.test_kyc import _user_id, _webhook, auth, sumsub  # noqa: F401
from tests.test_login import _login, member  # noqa: F401
from tests.test_signup import EMAIL
from tests.test_wallets import TRADER, _deposit, _withdraw, trader  # noqa: F401


def _purposes(sent):
    return [m["purpose"] for m in sent]


def test_welcome_mail_on_register(client, member, sent_emails):  # noqa: F811
    welcome = [m for m in sent_emails if m["purpose"] == "user_registered"]
    assert len(welcome) == 1 and welcome[0]["email"] == EMAIL.lower()
    assert welcome[0]["subject"] == "[Altos Funding] Welcome to Altos Funding"


def test_deposit_and_withdrawal_mails(client, admin_headers, trader, sent_emails):  # noqa: F811
    sent_emails.clear()
    dep1 = _deposit(client, trader, amount=100, tx_hash="0xaaa").json()["request_id"]
    dep2 = _deposit(client, trader, amount=5000, tx_hash="0xbbb").json()["request_id"]
    client.post(f"/api/v1/admin/wallets/deposits/{dep1}/approve", headers=admin_headers)
    client.post(
        f"/api/v1/admin/wallets/deposits/{dep2}/reject",
        headers=admin_headers,
        json={"reason": "TX not found"},
    )
    approved, rejected = sent_emails
    assert approved["purpose"] == "deposit_confirmed" and approved["email"] == TRADER
    assert (
        approved["subject"] == "[Altos Funding] Your deposit of 100.00 USDT is complete"
    )
    assert rejected["purpose"] == "deposit_rejected"

    sent_emails.clear()
    w1 = _withdraw(
        client,
        trader,
        amount=60,
    ).json()["request_id"]
    w2 = _withdraw(client, trader, amount=40).json()["request_id"]
    url = "/api/v1/admin/wallets/withdrawals"
    client.post(
        f"{url}/{w1}/approve", headers=admin_headers, json={"tx_hash": "0xsent"}
    )
    client.post(
        f"{url}/{w2}/reject", headers=admin_headers, json={"note": "wrong address"}
    )
    assert _purposes(sent_emails) == [
        "withdrawal_requested",
        "withdrawal_requested",
        "withdrawal_confirmed",
        "withdrawal_rejected",
    ]
    assert (
        sent_emails[2]["subject"]
        == "[Altos Funding] Your withdrawal of 60.00 USDT is complete"
    )


def test_disabled_template_is_skipped_and_failure_does_not_break(
    client, admin_headers, trader, sent_emails
):  # noqa: F811
    from app.main import app
    from app.services.email import EmailSendError, get_email_sender

    run_sql(
        "update core.email_templates set is_active = false where id = 'deposit_confirmed'"
    )
    dep = _deposit(client, trader, amount=100).json()["request_id"]
    sent_emails.clear()
    assert (
        client.post(
            f"/api/v1/admin/wallets/deposits/{dep}/approve", headers=admin_headers
        ).status_code
        == 200
    )
    assert sent_emails == []

    class Failing:
        async def send(self, *a, **k):
            raise EmailSendError("boom")

    app.dependency_overrides[get_email_sender] = lambda: Failing()
    try:
        res = _withdraw(client, trader, amount=50)
        assert res.status_code == 200 and res.json()["status"] == "REQUESTED"
    finally:
        app.dependency_overrides.pop(get_email_sender, None)


def test_member_status_mails(client, admin_headers, sent_emails):  # noqa: F811
    user_id = _create(client, admin_headers)["id"]
    sent_emails.clear()
    base = f"/api/v1/admin/users/{user_id}"
    client.post(
        f"{base}/suspend", headers=admin_headers, json={"reason": "Suspicious login"}
    )
    client.post(
        f"{base}/suspend", headers=admin_headers, json={"reason": "again"}
    )  # 이미 정지 → 메일 없음
    client.post(f"{base}/activate", headers=admin_headers)
    client.post(f"{base}/ban", headers=admin_headers, json={"reason": "Abuse"})
    client.post(f"{base}/withdraw", headers=admin_headers)
    assert _purposes(sent_emails) == [
        "user_suspended",
        "user_reactivated",
        "user_banned",
        "user_withdrawn",
    ]
    assert all(m["email"] == "target@example.com" for m in sent_emails)


def test_self_withdraw_mail_goes_to_original_email(client, member, sent_emails):  # noqa: F811
    headers = {"Authorization": f"Bearer {_login(client).json()['access_token']}"}
    sent_emails.clear()
    client.post(
        "/api/v1/auth/account/withdraw",
        headers=headers,
    )
    assert (
        _purposes(sent_emails) == ["user_withdrawn"]
        and sent_emails[0]["email"] == EMAIL.lower()
    )


def test_kyc_mails(client, auth, sumsub, sent_emails):  # noqa: F811
    user_id = _user_id()
    sent_emails.clear()
    _webhook(client, {"type": "applicantPending", "externalUserId": user_id})
    _webhook(
        client,
        {
            "type": "applicantReviewed",
            "externalUserId": user_id,
            "reviewResult": {"reviewAnswer": "RED", "moderationComment": "Blurry"},
        },
    )
    _webhook(
        client,
        {
            "type": "applicantReviewed",
            "externalUserId": user_id,
            "reviewResult": {"reviewAnswer": "GREEN"},
        },
    )
    _webhook(
        client,
        {
            "type": "applicantReviewed",
            "externalUserId": user_id,
            "reviewResult": {"reviewAnswer": "GREEN"},
        },
    )
    assert _purposes(sent_emails) == ["kyc_rejected", "kyc_approved"]


def test_admin_kyc_change_sends_mail(client, admin_headers, sent_emails):  # noqa: F811
    user_id = _create(client, admin_headers)["id"]
    sent_emails.clear()
    res = client.patch(
        f"/api/v1/admin/users/{user_id}/profile",
        headers=admin_headers,
        json={"kyc_status": "APPROVED"},
    )
    assert res.status_code == 200, res.text
    assert _purposes(sent_emails) == ["kyc_approved"]
