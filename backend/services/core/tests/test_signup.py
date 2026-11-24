from tests.conftest import run_sql

EMAIL = "Trader@Example.com"


def _payload(**overrides):
    body = {
        "email": EMAIL,
        "password": "Str0ngPass!",
        "agree_to_terms": True,
        "subscribe_newsletter": False,
        "referral_code": "",
        "auth_provider": "LOCAL",
        "first_name": "Gil",
        "last_name": "Hong",
        "country": "KR",
        "city": "Seoul",
        "state_province": "",
        "address_line1": "1 Main St",
        "address_line2": "",
        "zip_code": "04524",
        "phone": "+821012345678",
    }
    body.update(overrides)
    return body


def _send(client, email=EMAIL):
    return client.post(
        "/api/v1/auth/email/send-verification",
        json={"email": email, "purpose": "SIGNUP", "recaptcha_token": "token"},
    )


def _verify(client, code, email=EMAIL):
    return client.post(
        "/api/v1/auth/email/verify", json={"email": email, "code": code, "purpose": "SIGNUP"}
    )


def _signup(client, sent_emails, **overrides):
    email = overrides.get("email", EMAIL)
    assert _send(client, email).status_code == 201
    assert _verify(client, sent_emails[-1]["code"], email).status_code == 200
    return client.post("/api/v1/auth/register", json=_payload(**overrides))


def test_full_signup_flow(client, sent_emails):
    res = _send(client)
    assert res.status_code == 201
    assert res.json() == {"ok": True, "message_key": "auth.email.verification_sent"}
    assert sent_emails[-1]["email"] == "trader@example.com"
    code = sent_emails[-1]["code"]
    assert len(code) == 6 and code.isdigit()

    assert _verify(client, code).status_code == 200

    res = client.post("/api/v1/auth/register", json=_payload())
    assert res.status_code == 201, res.text
    user = res.json()
    assert user["email"] == "trader@example.com"
    assert user["role"] == "USER"
    assert user["status"] == "ACTIVE"
    assert user["is_active"] is True
    assert user["email_verified"] is True
    assert user["auth_provider"] == "LOCAL"
    assert user["can_change_password"] is True
    assert user["uid"].isdigit() and len(user["uid"]) == 10 and user["uid"][0] != "0"
    assert len(user["referral_code"]) == 8
    assert user["state_province"] is None  # 빈 문자열은 null로 저장

    rows = run_sql("select password_hash from core.users")
    assert rows[0]["password_hash"].startswith("$argon2")
    assert "Str0ngPass!" not in rows[0]["password_hash"]


def test_register_requires_verified_email(client, sent_emails):
    res = client.post("/api/v1/auth/register", json=_payload())
    assert res.status_code == 400
    assert res.json()["detail"]["error_code"] == "email_not_verified"

    _send(client)
    res = client.post("/api/v1/auth/register", json=_payload())
    assert res.json()["detail"]["error_code"] == "email_not_verified"


def test_verification_cannot_be_reused(client, sent_emails):
    assert _signup(client, sent_emails).status_code == 201
    run_sql("update core.users set status = 'WITHDRAWN'")
    # 탈퇴 후 같은 이메일 재가입은 새 인증이 필요하다.
    res = client.post("/api/v1/auth/register", json=_payload())
    assert res.json()["detail"]["error_code"] == "email_not_verified"


def test_duplicate_email_rejected(client, sent_emails):
    assert _signup(client, sent_emails).status_code == 201

    res = _send(client, "trader@example.com")
    assert res.status_code == 409
    body = res.json()
    assert body["detail"]["error_code"] == "email_already_exists"
    assert body["message"] == body["detail"]["message"]
    assert body["error_code"] == "email_already_exists"


def test_wrong_code_and_attempt_limit(client, sent_emails):
    _send(client)
    code = sent_emails[-1]["code"]
    wrong = "000000" if code != "000000" else "111111"

    for _ in range(5):
        res = _verify(client, wrong)
        assert res.status_code == 400
        assert res.json()["detail"]["error_code"] == "invalid_verification_code"

    res = _verify(client, code)
    assert res.status_code == 429
    assert res.json()["detail"]["error_code"] == "verification_too_many_attempts"


def test_expired_code(client, sent_emails):
    _send(client)
    run_sql("update core.email_verifications set expires_at = now() - interval '1 minute'")
    res = _verify(client, sent_emails[-1]["code"])
    assert res.status_code == 400
    assert res.json()["detail"]["error_code"] == "verification_code_expired"


def test_resend_cooldown(client, sent_emails):
    assert _send(client).status_code == 201
    res = _send(client)
    assert res.status_code == 429
    assert res.json()["detail"]["error_code"] == "rate_limit_exceeded"

    run_sql("update core.email_verifications set created_at = now() - interval '2 minutes'")
    assert _send(client).status_code == 201
    # 마지막으로 받은 코드만 유효하다.
    assert _verify(client, sent_emails[-1]["code"]).status_code == 200


def test_terms_required(client, sent_emails):
    res = _signup(client, sent_emails, agree_to_terms=False)
    assert res.status_code == 400
    assert res.json()["detail"]["error_code"] == "tos_not_accepted"


def test_referral_code(client, sent_emails):
    referrer = _signup(client, sent_emails).json()

    res = _signup(
        client,
        sent_emails,
        email="friend@example.com",
        referral_code=referrer["referral_code"].lower(),
    )
    assert res.status_code == 201, res.text
    assert res.json()["referrer_code"] == referrer["referral_code"]

    rows = run_sql(
        "select r.sponsor_id::text, r.placement_parent_id::text from core.member_relations r"
        " join core.users u on u.id = r.member_id where u.email = 'friend@example.com'"
    )
    assert rows[0]["sponsor_id"] == referrer["id"]
    assert rows[0]["placement_parent_id"] == referrer["id"]
    history = run_sql(
        "select h.change_type, h.new_sponsor_id::text from core.member_relation_history h"
        " join core.users u on u.id = h.member_id where u.email = 'friend@example.com'"
    )
    assert [(h["change_type"], h["new_sponsor_id"]) for h in history] == [("SIGNUP", referrer["id"])]


def test_invalid_referral_code(client, sent_emails):
    res = _signup(client, sent_emails, referral_code="NOPE1234")
    assert res.status_code == 400
    assert res.json()["detail"]["error_code"] == "invalid_referrer_code"


def test_validation_errors(client):
    res = client.post("/api/v1/auth/register", json=_payload(password="short"))
    assert res.status_code == 422
    res = client.post(
        "/api/v1/auth/email/verify", json={"email": EMAIL, "code": "12ab56", "purpose": "SIGNUP"}
    )
    assert res.status_code == 422


def test_generate_uid_skips_existing(client, monkeypatch):
    """이미 있는 번호가 나오면 다시 뽑는다."""
    import asyncio

    from app.db import get_session
    from app.services import signup

    run_sql(
        "insert into core.users (uid, email, referral_code) values ('1111111111', 'taken@example.com', 'TAKEN001')"
    )
    real = signup._random_uid
    assert all(len(u := real()) == 10 and u.isdigit() and u[0] != "0" for _ in range(200))
    picks = iter(["1111111111", "1111111111", "2222222222"])
    monkeypatch.setattr(signup, "_random_uid", lambda: next(picks))

    async def _go():
        gen = get_session()
        session = await gen.__anext__()
        try:
            return await signup.generate_uid(session)
        finally:
            await gen.aclose()

    assert asyncio.run(_go()) == "2222222222"
