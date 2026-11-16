"""메일 발송.

EMAIL_BACKEND
- console: 메일을 보내지 않고 로그에만 남긴다 (local/sandbox/test).
- ses: AWS SES로 실제 발송한다. AWS_ACCESS_KEY_ID·AWS_SECRET_ACCESS_KEY·AWS_REGION·EMAIL_FROM_ADDRESS가 필요하다.
"""

import asyncio
import logging
from email.utils import formataddr
from functools import lru_cache
from typing import Any, Protocol

from app.config import settings
from app.services.email_templates import RenderedEmail

logger = logging.getLogger(__name__)


class EmailSender(Protocol):
    async def send(self, to: str, mail: RenderedEmail, kind: str, meta: dict[str, str] | None = None) -> None:
        """mail: 템플릿으로 만든 제목·본문. kind: 템플릿 코드나 목적(로그·태그용). meta: 로그·테스트용 부가 정보."""
        ...


class ConsoleEmailSender:
    """메일을 보내지 않고 로그에 남긴다. local/sandbox 전용."""

    def __init__(self) -> None:
        self.sent: list[dict[str, str]] = []

    async def send(self, to: str, mail: RenderedEmail, kind: str, meta: dict[str, str] | None = None) -> None:
        record = {"email": to, "purpose": kind, "subject": mail.subject, **(meta or {})}
        self.sent.append(record)
        extra = " ".join(f"{k}={v}" for k, v in (meta or {}).items())
        logger.warning("[console email] %s → %s: %s %s", kind, to, mail.subject, extra)


class EmailSendError(Exception):
    """메일 서비스가 발송을 거부했거나 연결에 실패했다."""


class SesEmailSender:
    """AWS SES(SendEmail API)로 HTML+텍스트 메일을 보낸다."""

    def __init__(self, client: Any = None) -> None:
        self._client = client

    def _get_client(self) -> Any:
        if self._client is None:
            import boto3
            from botocore.config import Config

            self._client = boto3.client(
                "ses",
                region_name=settings.aws_region,
                aws_access_key_id=settings.aws_access_key_id or None,
                aws_secret_access_key=settings.aws_secret_access_key or None,
                config=Config(connect_timeout=5, read_timeout=10, retries={"max_attempts": 2}),
            )
        return self._client

    def _source(self) -> str:
        name = settings.email_from_name.strip()
        address = settings.email_from_address.strip()
        return formataddr((name, address)) if name else address

    async def _send(self, to: str, mail: RenderedEmail, kind: str) -> None:
        params: dict[str, Any] = {
            "Source": self._source(),
            "Destination": {"ToAddresses": [to]},
            "Message": {
                "Subject": {"Data": mail.subject, "Charset": "UTF-8"},
                "Body": {
                    "Html": {"Data": mail.html, "Charset": "UTF-8"},
                    "Text": {"Data": mail.text, "Charset": "UTF-8"},
                },
            },
            "Tags": [{"Name": "kind", "Value": kind}],
        }
        if settings.ses_configuration_set:
            params["ConfigurationSetName"] = settings.ses_configuration_set
        try:
            response = await asyncio.to_thread(self._get_client().send_email, **params)
        except Exception as exc:  # botocore ClientError·연결 오류 모두
            logger.error("SES 메일 발송 실패 (%s → %s): %s", kind, to, exc)
            raise EmailSendError(str(exc)) from exc
        logger.info("SES 메일 발송 (%s → %s, id=%s)", kind, to, response.get("MessageId"))

    async def send(self, to: str, mail: RenderedEmail, kind: str, meta: dict[str, str] | None = None) -> None:
        await self._send(to, mail, kind)


_console_sender = ConsoleEmailSender()


@lru_cache(maxsize=1)
def _ses_sender() -> SesEmailSender:
    if not settings.email_from_address:
        raise RuntimeError("EMAIL_BACKEND=ses에는 EMAIL_FROM_ADDRESS(SES에서 인증된 발신 주소)가 필요합니다.")
    return SesEmailSender()


def get_email_sender() -> EmailSender:
    if settings.email_backend == "console":
        if settings.is_live:
            raise RuntimeError("live 환경에서는 console 메일 발송을 쓸 수 없습니다.")
        return _console_sender
    if settings.email_backend == "ses":
        return _ses_sender()
    raise RuntimeError(f"지원하지 않는 EMAIL_BACKEND: {settings.email_backend}")
