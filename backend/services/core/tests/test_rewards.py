from tests.test_login import _login, member  # noqa: F401
from tests.test_signup import _signup


def _auth(client, email="trader@example.com"):
    token = _login(client, email=email).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_referral_code_and_stats(client, member, sent_emails):  # noqa: F811
    res = _signup(client, sent_emails, email="friend@example.com", referral_code=member["referral_code"])
    assert res.status_code == 201, res.text

    headers = _auth(client)
    code = member["referral_code"]
    link = f"http://localhost:5173/signup?ref={code}"

    res = client.get("/api/v1/rewards/referral-code", headers=headers)
    assert res.status_code == 200, res.text
    assert res.json() == {"referral_code": code, "referral_link": link}

    res = client.get("/api/v1/rewards/referrals/stats", headers=headers)
    assert res.status_code == 200, res.text
    assert res.json() == {
        "total_invited": 1,
        "pending_referrals": 1,
        "total_earned": 0.0,
        "referral_link": link,
        "referral_code": code,
    }

    res = client.get("/api/v1/rewards/referrals", headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert (body["total"], body["page"], body["size"], body["pages"]) == (1, 1, 20, 1)
    item = body["items"][0]
    assert item["email"] == "friend@example.com"
    assert item["status"] == "Pending"
    assert item["total_challenge_count"] == 0


def test_referrals_require_login(client):
    assert client.get("/api/v1/rewards/referrals/stats").status_code == 401
