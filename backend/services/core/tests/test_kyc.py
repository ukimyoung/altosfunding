import hashlib
import hmac
import json

import httpx
import pytest

from app.config import settings
from app.services import kyc
from tests.conftest import run_sql
from tests.test_login import _login, member  # noqa: F401
from tests.test_signup import EMAIL

WEBHOOK_SECRET = "webhook-secret"


@pytest.fixture
def auth(client, member):  # noqa: F811
    return {"Authorization": f"Bearer {_login(client, email=EMAIL).json()['access_token']}"}


@pytest.fixture
def sumsub(monkeypatch):
    monkeypatch.setattr(settings, "sumsub_app_token", "app-token")
    monkeypatch.setattr(settings, "sumsub_secret_key", "secret-key")
    monkeypatch.setattr(settings, "sumsub_webhook_secret", WEBHOOK_SECRET)
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(200, json={"token": "sdk-token", "userId": "x"})

    real_client = httpx.AsyncClient
    monkeypatch.setattr(
        kyc.httpx, "AsyncClient", lambda **kw: real_client(transport=httpx.MockTransport(handler), **kw)
    )
    return calls


def _user_id():
    return str(run_sql("select id from core.users where email = lower($1)", EMAIL)[0]["id"])


def _webhook(client, payload, secret=WEBHOOK_SECRET, alg="HMAC_SHA256_HEX"):
    body = json.dumps(payload).encode()
    digest = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return client.post(
        "/api/v1/webhooks/sumsub", content=body,
        headers={"X-Payload-Digest": digest, "X-Payload-Digest-Alg": alg, "Content-Type": "application/json"},
    )


def test_status_defaults_to_none(client, auth):
    res = client.get("/api/v1/auth/kyc/status", headers=auth)
    assert res.status_code == 200
    assert res.json() == {"status": "NONE", "message_key": "kyc.status.none", "reject_reason": None}
    assert client.get("/api/v1/auth/kyc/status").status_code == 401


def test_token_requires_sumsub_keys(client, auth, monkeypatch):
    monkeypatch.setattr(settings, "sumsub_app_token", "")
    res = client.get("/api/v1/auth/kyc/sumsub/token", headers=auth)
    assert res.status_code == 503 and res.json()["error_code"] == "kyc_not_configured"


def test_token_is_signed_and_bound_to_member(client, auth, sumsub):
    res = client.get("/api/v1/auth/kyc/sumsub/token", headers=auth)
    assert res.status_code == 200, res.text
    assert res.json() == {"ok": True, "token": "sdk-token"}

    request = sumsub[0]
    assert request.url.path == "/resources/accessTokens/sdk"
    body = json.loads(request.content)
    assert body["userId"] == _user_id() and body["levelName"] == settings.sumsub_level_name
    ts = request.headers["X-App-Access-Ts"]
    expected = hmac.new(b"secret-key", ts.encode() + b"POST/resources/accessTokens/sdk" + request.content,
                        hashlib.sha256).hexdigest()
    assert request.headers["X-App-Access-Sig"] == expected
    assert request.headers["X-App-Token"] == "app-token"


def test_webhook_flow(client, auth, sumsub):
    user_id = _user_id()
    assert _webhook(client, {"type": "applicantPending", "externalUserId": user_id}).status_code == 200
    assert client.get("/api/v1/auth/kyc/status", headers=auth).json()["status"] == "PENDING"
    # 심사 중에는 새로 시작할 수 없다.
    assert client.get("/api/v1/auth/kyc/sumsub/token", headers=auth).status_code == 409

    _webhook(client, {"type": "applicantReviewed", "externalUserId": user_id,
                      "reviewResult": {"reviewAnswer": "RED", "reviewRejectType": "RETRY",
                                       "moderationComment": "Document is blurry"}})
    body = client.get("/api/v1/auth/kyc/status", headers=auth).json()
    assert body["status"] == "REJECTED" and body["reject_reason"] == "Document is blurry"
    # 반려되면 다시 시작할 수 있다.
    assert client.get("/api/v1/auth/kyc/sumsub/token", headers=auth).status_code == 200

    _webhook(client, {"type": "applicantReviewed", "externalUserId": user_id,
                      "reviewResult": {"reviewAnswer": "GREEN"}})
    body = client.get("/api/v1/auth/kyc/status", headers=auth).json()
    assert body == {"status": "APPROVED", "message_key": "kyc.status.approved", "reject_reason": None}
    row = run_sql("select kyc_approved_at, kyc_submitted_at, kyc_rejected_at from core.users")[0]
    assert all(row.values())


def test_webhook_rejects_bad_signature(client, auth, sumsub):
    res = _webhook(client, {"type": "applicantPending", "externalUserId": _user_id()}, secret="wrong")
    assert res.status_code == 401
    assert client.get("/api/v1/auth/kyc/status", headers=auth).json()["status"] == "NONE"
    # 모르는 회원이나 이벤트는 무시하고 200
    assert _webhook(client, {"type": "applicantPending", "externalUserId": "not-a-uuid"}).status_code == 200
    assert _webhook(client, {"type": "applicantCreated", "externalUserId": _user_id()}).status_code == 200
