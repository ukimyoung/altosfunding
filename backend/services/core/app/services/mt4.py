"""MT4 API (Tools For Brokers) 클라이언트.

API 명세: /mnt/project-files/api-specs/mt4-demo-swagger.json (demo·live 같음)
- demo 서버: 챌린지·데모 계좌 (MT4_DEMO_BASE_URL, MT4_DEMO_API_KEY)
- live 서버: 펀디드·라이브 계좌 (MT4_LIVE_BASE_URL, MT4_LIVE_API_KEY)

Core API 요청 안에서 부르지 않는다. 계좌 발급·잠금 같은 MT4 호출은 Worker 작업(app.jobs.mt4)에서만 한다.
요청 형식은 기존 서버의 Broker Gateway(altos_funding_broker/app/services/mt4_client.py)와 같다.
"""

import logging
from dataclasses import dataclass
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

DEMO, LIVE = "demo", "live"
# 상품 등급 → MT4 서버
SERVER_OF_TIER = {"CHALLENGE": DEMO, "DEMO": DEMO, "FUNDED": LIVE, "LIVE": LIVE}


class Mt4Error(Exception):
    """MT4 호출 실패. status가 None이면 응답을 받지 못한 것(타임아웃·연결 실패)이다."""

    def __init__(self, operation: str, message: str, status: int | None = None, body: Any = None) -> None:
        self.operation = operation
        self.status = status
        self.body = body
        super().__init__(f"MT4 {operation} 실패 (HTTP {status if status is not None else '-'}): {message}")

    @property
    def no_response(self) -> bool:
        """요청이 MT4에 닿았는지 알 수 없다 (생성·입금이 됐을 수도 있다)."""
        return self.status is None or self.status >= 500


class Mt4NotConfigured(Mt4Error):
    pass


def server_name(server: str) -> str:
    return settings.mt4_live_server_name if server == LIVE else settings.mt4_demo_server_name


def encode_name(name: str) -> str:
    """MT4 서버(Windows, CP949)에 한글 이름이 깨지지 않게 보낸다 (기존 Broker Gateway와 같음)."""
    if not name:
        return name
    try:
        return name.encode("cp949").decode("latin-1")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return name


def _error_text(resp: httpx.Response) -> tuple[str, Any]:
    try:
        body = resp.json()
    except ValueError:
        text = (resp.text or "").strip()[:500]
        return text or resp.reason_phrase, text
    if isinstance(body, dict):
        errors = body.get("errors")
        if isinstance(errors, list) and errors:
            text = "; ".join(str(e.get("message") if isinstance(e, dict) else e) for e in errors)
        else:
            text = str(body.get("message") or body.get("detail") or body.get("title") or body.get("code") or body)
        return text, body
    return str(body), body


def normalize_base_url(url: str) -> str:
    """환경변수에 Swagger 화면 주소(…/index.html, …/swagger)를 넣어도 API 주소(https://호스트)로 맞춘다."""
    url = (url or "").strip().rstrip("/")
    for suffix in ("/index.html", "/swagger/index.html", "/swagger", "/api/mt4", "/api"):
        if url.lower().endswith(suffix):
            url = url[: -len(suffix)].rstrip("/")
    return url


@dataclass
class CreatedAccount:
    login: int


class Mt4Client:
    def __init__(self, server: str, base_url: str, api_key: str, transport: httpx.AsyncBaseTransport | None = None):
        self.server = server
        self.base_url = normalize_base_url(base_url)
        self.api_key = api_key
        self._transport = transport
        self._shared: httpx.AsyncClient | None = None

    async def __aenter__(self) -> "Mt4Client":
        """여러 요청을 한 연결 풀로 보낼 때 (거래 수집처럼 짧은 시간에 많이 부를 때)."""
        self._shared = self._client()
        return self

    async def __aexit__(self, *exc) -> None:
        if self._shared is not None:
            await self._shared.aclose()
            self._shared = None

    def _client(self) -> httpx.AsyncClient:
        if not self.base_url or not self.api_key:
            env = "MT4_LIVE" if self.server == LIVE else "MT4_DEMO"
            raise Mt4NotConfigured("config", f"{env}_BASE_URL·{env}_API_KEY가 설정되지 않았습니다.")
        return httpx.AsyncClient(
            base_url=self.base_url,
            headers={"X-API-KEY": self.api_key, "Accept": "application/json"},
            timeout=settings.mt4_http_timeout_seconds,
            transport=self._transport,
        )

    async def _request(self, operation: str, method: str, path: str, **kwargs) -> httpx.Response:
        if self._shared is not None:
            return await self._send(self._shared, operation, method, path, **kwargs)
        async with self._client() as client:
            return await self._send(client, operation, method, path, **kwargs)

    @staticmethod
    async def _send(client: httpx.AsyncClient, operation: str, method: str, path: str, **kwargs) -> httpx.Response:
        try:
            return await client.request(method, path, **kwargs)
        except httpx.HTTPError as exc:
            raise Mt4Error(operation, f"{type(exc).__name__}: {exc}") from exc

    async def _call(self, operation: str, method: str, path: str, **kwargs) -> Any:
        resp = await self._request(operation, method, path, **kwargs)
        if resp.status_code >= 400:
            text, body = _error_text(resp)
            logger.warning("MT4 %s %s → %s %s", self.server, operation, resp.status_code, text)
            raise Mt4Error(operation, text, resp.status_code, body)
        if not resp.content:
            return None
        try:
            return resp.json()
        except ValueError:
            return resp.text

    async def server_time(self) -> Any:
        """연결 확인용: MT4 서버 시각. 주소가 틀리면 404, API 키가 틀리면 401/403."""
        return await self._call("server_time", "GET", "/api/mt4/server/time")

    async def get_account(self, login: int) -> dict | None:
        """계좌 정보. 없으면 None. (명세상 없는 계좌는 404, 일부 서버는 400을 준다)"""
        resp = await self._request("get_account", "GET", f"/api/mt4/accounts/{login}")
        if resp.status_code == 404:
            return None
        if resp.status_code >= 400:
            text, body = _error_text(resp)
            if resp.status_code == 400 and "not found" in text.lower():
                return None
            raise Mt4Error("get_account", text, resp.status_code, body)
        data = resp.json()
        return data if isinstance(data, dict) else {}

    async def create_account(
        self,
        *,
        login: int,
        name: str,
        group: str,
        leverage: int,
        password: str,
        investor_password: str,
        email: str | None,
        comment: str | None,
        pool_start: int,
        pool_end: int,
        read_only: bool,
    ) -> CreatedAccount:
        payload = {
            "login": login,
            "name": encode_name(name),
            "group": group,
            "leverage": leverage,
            "pwd": password,
            "pwdInvestor": investor_password,
            "email": email,
            "comment": comment,
            "accountsPool": {"loginsPoolStart": pool_start, "loginsPoolEnd": pool_end},
            "stateIsReadOnly": read_only,
        }
        data = await self._call("create_account", "POST", "/api/mt4/accounts/create", json=payload)
        created = int((data or {}).get("login") or 0)
        return CreatedAccount(login=created or login)

    async def balance_operation(self, login: int, value: float, comment: str) -> int | None:
        """잔고 입금(+)·출금(-). MT4 거래 번호(orderId)를 돌려준다."""
        data = await self._call(
            "balance", "POST", f"/api/mt4/accounts/{login}/balance", json={"value": value, "comment": comment}
        )
        order_id = (data or {}).get("orderId") if isinstance(data, dict) else None
        return int(order_id) if order_id else None

    async def set_read_only(self, login: int, read_only: bool) -> None:
        await self._call("readonly", "POST", f"/api/mt4/accounts/{login}/readonly", json={"value": read_only})

    async def all_orders(self, login: int, date_from: str, date_to: str) -> list[dict]:
        """청산 시각이 기간 안인 주문 + 지금 열린 포지션 (명세: 기간은 청산 시각에만 적용).

        기간은 MT4 서버 시각 문자열(YYYY-MM-DDTHH:MM:SS)로 보낸다. 기존 서버와 같이 400·404는 거래 없음으로 본다.
        """
        resp = await self._request(
            "all_orders", "GET", f"/api/mt4/accounts/{login}/orders/all", params={"dateFrom": date_from, "dateTo": date_to}
        )
        if resp.status_code in (400, 404):
            text, _ = _error_text(resp)
            logger.info("MT4 %s all_orders login=%s → %s %s (거래 없음으로 처리)", self.server, login, resp.status_code, text)
            return []
        if resp.status_code >= 400:
            text, body = _error_text(resp)
            raise Mt4Error("all_orders", text, resp.status_code, body)
        data = resp.json() if resp.content else []
        return data if isinstance(data, list) else []

    async def balance(self, login: int) -> dict | None:
        """한 계좌의 잔고·평가금액(balance, equity, margin, marginFree, marginLevel, credit). 없는 계좌는 None."""
        resp = await self._request("get_balance", "GET", f"/api/mt4/accounts/{login}/balance")
        if resp.status_code in (400, 404):
            return None
        if resp.status_code >= 400:
            text, body = _error_text(resp)
            raise Mt4Error("get_balance", text, resp.status_code, body)
        data = resp.json() if resp.content else None
        return data if isinstance(data, dict) else None

    async def balances(self, logins: list[int]) -> list[dict]:
        """여러 계좌의 잔고·평가금액을 한 번에 (MT4 API 캐시). 응답에 없는 계좌는 balance()로 따로 묻는다."""
        data = await self._call("get_balances", "POST", "/api/mt4/accounts/balances", json={"logins": logins})
        items = data.get("balances") if isinstance(data, dict) else data
        return [b for b in items or [] if isinstance(b, dict)]

    async def open_orders(self, login: int) -> list[dict]:
        """미결 포지션(열린 주문) 목록."""
        data = await self._call("open_orders", "GET", f"/api/mt4/accounts/{login}/orders/open")
        return data if isinstance(data, list) else []


# 테스트에서 모의 MT4 서버(httpx.MockTransport)를 끼워 넣는다.
_transport: httpx.AsyncBaseTransport | None = None


def set_transport(transport: httpx.AsyncBaseTransport | None) -> None:
    global _transport
    _transport = transport


def client_for(server: str) -> Mt4Client:
    if server == LIVE:
        return Mt4Client(LIVE, settings.mt4_live_base_url, settings.mt4_live_api_key, _transport)
    return Mt4Client(DEMO, settings.mt4_demo_base_url, settings.mt4_demo_api_key, _transport)


# ── 생성 거부(400) 분류: 기존 서버 shared/mts_create_errors.py와 같은 기준 ──

DUPLICATE_LOGIN, DUPLICATE_UID, INVALID_NAME, UNKNOWN = "duplicate_login", "duplicate_uid", "invalid_name", "unknown"


def classify_create_rejection(error: Mt4Error) -> str:
    text = f"{error} {error.body}".lower()
    if any(t in text for t in ("name is required", "name required", "invalid name", "empty name", "holder")):
        return INVALID_NAME
    if any(t in text for t in ("duplicate id", "uid already", "identifier already", "duplicate identifier")):
        return DUPLICATE_UID
    if any(
        t in text
        for t in (
            "login already", "duplicate login", "account already", "already exist", "duplicate account",
            "login exists", "account exists",
        )
    ):
        return DUPLICATE_LOGIN
    return UNKNOWN
