import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.config import Settings
from app.main import app


def test_mock_is_default() -> None:
    assert Settings(_env_file=None).mt4_mode == "mock"


def test_create_account_uses_mock() -> None:
    res = TestClient(app).post(
        "/accounts",
        json={"account_type": "challenge", "name": "Test", "email": "t@example.com", "balance": 10000},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["is_mock"] is True
    assert body["server"] == "MOCK-CHALLENGE"
    assert body["login"] >= 900_000_001


@pytest.mark.parametrize("env", ["local", "sandbox"])
def test_live_broker_blocked_outside_live(env: str) -> None:
    with pytest.raises(ValidationError):
        Settings(_env_file=None, app_env=env, mt4_mode="live",
                 mt4_challenge_api_url="x", mt4_funded_api_url="y", mt4_api_key="k")


def test_live_broker_requires_urls_and_key() -> None:
    with pytest.raises(ValidationError):
        Settings(_env_file=None, app_env="live", mt4_mode="live")


def test_live_broker_allowed_in_live() -> None:
    s = Settings(_env_file=None, app_env="live", mt4_mode="live",
                 mt4_challenge_api_url="x", mt4_funded_api_url="y", mt4_api_key="k")
    assert s.mt4_mode == "live"
