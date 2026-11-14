from enum import Enum
from typing import Protocol

from pydantic import BaseModel


class AccountType(str, Enum):
    challenge = "challenge"  # Challenge 티켓 구매 → MT4 데모 서버 계정
    funded = "funded"  # Funded 계정 → MT4 실서버 계정


class MT4Account(BaseModel):
    login: int
    password: str
    server: str
    account_type: AccountType
    balance: float
    is_mock: bool = False


class BrokerClient(Protocol):
    async def create_account(
        self, account_type: AccountType, name: str, email: str, balance: float
    ) -> MT4Account: ...
