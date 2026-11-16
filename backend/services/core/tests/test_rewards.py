from tests.conftest import run_sql
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
        "referral_reward_amount": 40,
        "referral_reward_condition": "FIRST_PURCHASE",
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


def _admin(client):
    run_sql("update core.users set role = 'ADMIN'")
    return _auth(client)


def test_reward_policy_defaults_and_update(client, member):  # noqa: F811
    headers = _admin(client)

    res = client.get("/api/v1/admin/rewards/policy", headers=headers)
    assert res.status_code == 200, res.text
    assert res.json() == {
        "referral_reward_amount": 40,
        "referral_reward_condition": "FIRST_PURCHASE",
        "trading_bonus_rate": 0.01,
    }

    # 추천인 리워드 카드만 저장: 추가율은 그대로
    res = client.put(
        "/api/v1/admin/rewards/policy",
        headers=headers,
        json={"referral_reward_amount": 75, "referral_reward_condition": "FUNDED_UPGRADE"},
    )
    assert res.status_code == 200, res.text
    assert res.json()["message"]

    # 트레이딩 보너스 카드만 저장 (화면은 7 / 100을 보낸다)
    res = client.put("/api/v1/admin/rewards/policy", headers=headers, json={"trading_bonus_rate": 7 / 100 + 1e-17})
    assert res.status_code == 200, res.text

    res = client.get("/api/v1/admin/rewards/policy", headers=headers)
    assert res.json() == {
        "referral_reward_amount": 75,
        "referral_reward_condition": "FUNDED_UPGRADE",
        "trading_bonus_rate": 0.07,
    }

    # 웹 Referral 'How it works'에 바뀐 값이 나온다
    body = client.get("/api/v1/rewards/referrals/stats", headers=headers).json()
    assert body["referral_reward_amount"] == 75
    assert body["referral_reward_condition"] == "FUNDED_UPGRADE"


def test_reward_policy_validation(client, member):  # noqa: F811
    headers = _admin(client)
    for payload in (
        {"referral_reward_amount": -1},
        {"referral_reward_amount": 10.555},
        {"referral_reward_condition": "SIGNUP"},
        {"trading_bonus_rate": 1.5},
    ):
        res = client.put("/api/v1/admin/rewards/policy", headers=headers, json=payload)
        assert res.status_code == 422, payload

    # 일반 플랫폼 설정 API로 REWARD 값을 바꿀 때도 같은 검사를 한다
    res = client.put(
        "/api/v1/admin/platform-config/REWARD/referral_reward_amount",
        headers=headers,
        json={"value": "abc", "value_type": "STRING"},
    )
    assert res.status_code == 422
    assert client.get("/api/v1/admin/rewards/policy", headers=headers).json()["referral_reward_amount"] == 40


def test_reward_policy_requires_admin(client, member):  # noqa: F811
    headers = _auth(client)
    assert client.get("/api/v1/admin/rewards/policy", headers=headers).status_code == 403
    assert client.put("/api/v1/admin/rewards/policy", headers=headers, json={}).status_code == 403
