import itertools
import secrets

from app.broker.base import AccountType, MT4Account

# 실제 계정과 헷갈리지 않도록 mock 로그인 번호는 9억 번대부터 씁니다.
_logins = itertools.count(900_000_001)


class MockBrokerClient:
    """Sandbox·로컬용. 브로커를 호출하지 않고 가짜 MT4 계정을 돌려줍니다."""

    async def create_account(
        self, account_type: AccountType, name: str, email: str, balance: float
    ) -> MT4Account:
        return MT4Account(
            login=next(_logins),
            password=secrets.token_urlsafe(9),
            server=f"MOCK-{account_type.value.upper()}",
            account_type=account_type,
            balance=balance,
            is_mock=True,
        )
