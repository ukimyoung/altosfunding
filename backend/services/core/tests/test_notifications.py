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
    client,
    admin_headers,  # noqa: F811
    trader,  # noqa: F811
    sent_emails,
):
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


def test_member_locale_is_saved_and_used(client, admin_headers, trader, sent_emails):  # noqa: F811
    from tests.test_login import _login as login

    assert client.get("/api/v1/auth/me", headers=trader).json()["locale"] == "en"
    # 로그인한 화면 언어를 저장한다.
    res = client.post(
        "/api/v1/auth/login",
        json={"email": TRADER, "password": "Target123!", "recaptcha_token": "t"},
        headers={"Accept-Language": "ko"},
    )
    assert res.status_code == 200
    assert (
        run_sql("select locale from core.users where email = $1", TRADER)[0]["locale"]
        == "ko"
    )
    # Accept-Language가 없으면 바꾸지 않는다.
    login(client, email=TRADER, password="Target123!")
    assert (
        run_sql("select locale from core.users where email = $1", TRADER)[0]["locale"]
        == "ko"
    )

    sent_emails.clear()
    dep = _deposit(client, trader, amount=100).json()["request_id"]
    client.post(f"/api/v1/admin/wallets/deposits/{dep}/approve", headers=admin_headers)
    assert (
        sent_emails[-1]["subject"]
        == "[Altos Funding] 100.00 USDT 입금이 완료되었습니다"
    )

    # 웹에서 언어를 바꾸면 저장
    assert (
        client.put(
            "/api/v1/auth/account/locale", headers=trader, json={"locale": "en"}
        ).status_code
        == 200
    )
    assert (
        client.put(
            "/api/v1/auth/account/locale", headers=trader, json={"locale": "ja"}
        ).status_code
        == 422
    )
    assert client.get("/api/v1/auth/me", headers=trader).json()["locale"] == "en"

    # 관리자가 바꿀 수도 있다
    user_id = run_sql("select id from core.users where email = $1", TRADER)[0]["id"]
    res = client.patch(
        f"/api/v1/admin/users/{user_id}/profile",
        headers=admin_headers,
        json={"locale": "ko"},
    )
    assert res.status_code == 200 and res.json()["locale"] == "ko"


def test_register_saves_page_locale(client, sent_emails):
    from tests.test_signup import _payload, _send, _verify

    assert _send(client).status_code == 201
    assert _verify(client, sent_emails[-1]["code"]).status_code == 200
    res = client.post(
        "/api/v1/auth/register", json=_payload(), headers={"Accept-Language": "ko"}
    )
    assert res.status_code == 201, res.text
    assert res.json()["locale"] == "ko"
    assert (
        sent_emails[-1]["purpose"] == "user_registered"
        and sent_emails[-1]["locale"] == "ko"
    )
    assert sent_emails[-1]["subject"] == "[Altos Funding] 알토스 펀딩 가입을 환영합니다"


def test_member_requests_use_member_locale(client, admin_headers, trader, sent_emails):  # noqa: F811
    """출금 인증코드·출금 신청 메일은 브라우저 언어가 아니라 회원 메일 언어로 보낸다."""
    run_sql("update core.users set locale = 'ko', is_email_enabled = true where email = $1", TRADER)
    dep = _deposit(client, trader, amount=100).json()["request_id"]
    client.post(f"/api/v1/admin/wallets/deposits/{dep}/approve", headers=admin_headers)
    en = {**trader, "Accept-Language": "en-US,en;q=0.9"}
    res = client.post(
        "/api/v1/auth/email/send-verification",
        headers=en,
        json={"email": TRADER, "purpose": "WITHDRAW_REQUEST"},
    )
    assert res.status_code == 201, res.text
    code = sent_emails[-1]["code"]
    res = _withdraw(client, en, amount=50, verification_code=code)
    assert res.status_code == 200, res.text
    rows = run_sql(
        "select template_id, locale from core.email_logs"
        " where template_id in ('withdraw_verification_code', 'withdrawal_requested')"
    )
    assert {r["template_id"] for r in rows} == {"withdraw_verification_code", "withdrawal_requested"}
    assert all(r["locale"] == "ko" for r in rows)


def test_withdraw_code_expires_in_60_seconds(client, trader, sent_emails):  # noqa: F811
    from app.services import email_templates

    run_sql("update core.users set is_email_enabled = true where email = $1", TRADER)
    res = client.post(
        "/api/v1/auth/email/send-verification",
        headers=trader,
        json={"email": TRADER, "purpose": "WITHDRAW_REQUEST"},
    )
    assert res.status_code == 201, res.text
    row = run_sql(
        "select extract(epoch from expires_at - created_at) as ttl from core.email_verifications"
        " where purpose = 'WITHDRAW_REQUEST'"
    )[0]
    assert round(float(row["ttl"])) == 60
    mail = email_templates.render_default(
        "withdraw_verification_code", "ko", {"verification_code": "123456", "expiry_minutes": 1}
    )
    assert "1분 동안 유효" in mail.html
    # 만료된 코드로는 출금할 수 없다
    code = sent_emails[-1]["code"]
    run_sql("update core.email_verifications set expires_at = now() - interval '1 second'")
    res = _withdraw(client, trader, amount=10, verification_code=code)
    assert res.status_code == 400
