import httpx

from app.broker.base import AccountType, MT4Account


class HttpBrokerClient:
    """Live 전용. 브로커 MT4 REST API를 호출합니다.

    Challenge 계정은 challenge_url(MT4 데모 서버), Funded 계정은 funded_url(MT4 실서버)로 보냅니다.
    """

    def __init__(self, challenge_url: str, funded_url: str, api_key: str) -> None:
        self._base_urls = {AccountType.challenge: challenge_url, AccountType.funded: funded_url}
        self._api_key = api_key

    async def create_account(
        self, account_type: AccountType, name: str, email: str, balance: float
    ) -> MT4Account:
        # TODO: 브로커 API 문서에 맞춰 경로·요청·응답 필드를 확정해야 합니다.
        raise NotImplementedError("브로커 API 명세를 받은 뒤 구현합니다.")

    def _client(self, account_type: AccountType) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self._base_urls[account_type],
            headers={"Authorization": f"Bearer {self._api_key}"},
            timeout=10.0,
        )
