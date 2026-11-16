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
from app.services import email_templates
from app.services.email_templates import RenderedEmail

logger = logging.getLogger(__name__)


class EmailSender(Protocol):
    async def send_verification_code(self, email: str, code: str, purpose: str, locale: str) -> None: ...

    async def send_password_reset(self, email: str, reset_url: str, locale: str) -> None: ...

    async def send_contact_received(self, email: str, name: str, subject: str, contact_id: int, locale: str) -> None: ...

    async def send_contact_replied(
        self, email: str, name: str, subject: str, inquiry: str, reply: str, contact_id: int, locale: str
    ) -> None: ...


class ConsoleEmailSender:
    """메일을 보내지 않고 로그에 남긴다. local/sandbox 전용."""

    def __init__(self) -> None:
        self.sent: list[dict[str, str]] = []

    async def send_verification_code(self, email: str, code: str, purpose: str, locale: str) -> None:
        self.sent.append({"email": email, "code": code, "purpose": purpose, "locale": locale})
        logger.warning("[console email] %s 인증코드 → %s: %s", purpose, email, code)

    async def send_password_reset(self, email: str, reset_url: str, locale: str) -> None:
        self.sent.append({"email": email, "reset_url": reset_url, "purpose": "PASSWORD_RESET", "locale": locale})
        logger.warning("[console email] 비밀번호 재설정 링크 → %s: %s", email, reset_url)

    async def send_contact_received(self, email: str, name: str, subject: str, contact_id: int, locale: str) -> None:
        self.sent.append({"email": email, "purpose": "CONTACT_RECEIVED", "contact_id": str(contact_id), "locale": locale})
        logger.warning("[console email] 문의 접수 안내 → %s: #%s %s", email, contact_id, subject)

    async def send_contact_replied(
        self, email: str, name: str, subject: str, inquiry: str, reply: str, contact_id: int, locale: str
    ) -> None:
        self.sent.append(
            {"email": email, "purpose": "CONTACT_REPLIED", "contact_id": str(contact_id), "reply": reply, "locale": locale}
        )
        logger.warning("[console email] 문의 답변 → %s: #%s %s", email, contact_id, subject)


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

    async def send_verification_code(self, email: str, code: str, purpose: str, locale: str) -> None:
        mail = email_templates.verification_code(code, purpose, locale, settings.email_code_ttl_minutes)
        await self._send(email, mail, purpose)

    async def send_password_reset(self, email: str, reset_url: str, locale: str) -> None:
        mail = email_templates.password_reset(reset_url, locale, settings.password_reset_ttl_minutes)
        await self._send(email, mail, "PASSWORD_RESET")

    async def send_contact_received(self, email: str, name: str, subject: str, contact_id: int, locale: str) -> None:
        await self._send(email, email_templates.contact_received(name, subject, contact_id, locale), "CONTACT_RECEIVED")

    async def send_contact_replied(
        self, email: str, name: str, subject: str, inquiry: str, reply: str, contact_id: int, locale: str
    ) -> None:
        mail = email_templates.contact_replied(name, subject, inquiry, reply, contact_id, locale)
        await self._send(email, mail, "CONTACT_REPLIED")


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
