from functools import lru_cache

from app.broker.base import AccountType, BrokerClient, MT4Account
from app.broker.http import HttpBrokerClient
from app.broker.mock import MockBrokerClient
from app.config import settings

__all__ = ["AccountType", "BrokerClient", "MT4Account", "get_broker_client"]


@lru_cache
def get_broker_client() -> BrokerClient:
    """MT4_MODE에 따라 브로커 클라이언트를 고릅니다. 기본값은 mock 입니다."""
    if settings.mt4_mode == "live":
        return HttpBrokerClient(
            challenge_url=settings.mt4_challenge_api_url,
            funded_url=settings.mt4_funded_api_url,
            api_key=settings.mt4_api_key,
        )
    return MockBrokerClient()
