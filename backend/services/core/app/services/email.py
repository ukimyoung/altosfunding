"""메일 발송.

EMAIL_BACKEND
- console: 메일을 보내지 않고 로그에만 남긴다 (local/sandbox/test).
- ses: AWS SES로 실제 발송한다. AWS_ACCESS_KEY_ID·AWS_SECRET_ACCESS_KEY·AWS_REGION·EMAIL_FROM_ADDRESS가 필요하다.
"""

import asyncio
import logging
import uuid
from email.utils import formataddr
from functools import lru_cache
from typing import Any, Protocol

from app.config import settings
from app.services.email_templates import RenderedEmail

logger = logging.getLogger(__name__)


class EmailSender(Protocol):
    async def send(self, to: str, mail: RenderedEmail, kind: str, meta: dict[str, str] | None = None) -> str | None:
        """mail: 템플릿으로 만든 제목·본문. kind: 템플릿 코드(발송 이력·태그용). meta: 부가 정보.

        meta의 user_id·locale·batch_id는 발송 이력에 남는다 (그 밖의 값은 남기지 않는다).
        돌려주는 값은 메일 서비스의 메시지 ID (없으면 None).
        """
        ...


class ConsoleEmailSender:
    """메일을 보내지 않고 로그에 남긴다. local/sandbox 전용."""

    def __init__(self) -> None:
        self.sent: list[dict[str, str]] = []

    async def send(self, to: str, mail: RenderedEmail, kind: str, meta: dict[str, str] | None = None) -> str | None:
        record = {"email": to, "purpose": kind, "subject": mail.subject, **(meta or {})}
        self.sent.append(record)
        extra = " ".join(f"{k}={v}" for k, v in (meta or {}).items())
        logger.warning("[console email] %s → %s: %s %s", kind, to, mail.subject, extra)
        return None


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

    async def _send(self, to: str, mail: RenderedEmail, kind: str) -> str | None:
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
        message_id = response.get("MessageId")
        logger.info("SES 메일 발송 (%s → %s, id=%s)", kind, to, message_id)
        return message_id

    async def send(self, to: str, mail: RenderedEmail, kind: str, meta: dict[str, str] | None = None) -> str | None:
        return await self._send(to, mail, kind)


class LoggingEmailSender:
    """보낸 결과(성공·실패)를 발송 이력(core.email_logs)에 남긴다.

    이력은 별도 DB 세션으로 바로 저장한다 — 업무 처리가 롤백돼도 '보냈다'는 사실은 남는다.
    이력 저장이 실패해도 메일 발송 결과에는 영향을 주지 않는다.
    """

    def __init__(self, inner: EmailSender, provider: str) -> None:
        self.inner = inner
        self.provider = provider

    @property
    def sent(self) -> list[dict[str, str]]:  # console 발송 기록 (테스트용)
        return getattr(self.inner, "sent", [])

    async def send(self, to: str, mail: RenderedEmail, kind: str, meta: dict[str, str] | None = None) -> str | None:
        try:
            message_id = await self.inner.send(to, mail, kind, meta)
        except Exception as exc:
            await self._record(to, mail, kind, meta, "FAILED", error=str(exc)[:1000])
            raise
        await self._record(to, mail, kind, meta, "SENT", message_id=message_id)
        return message_id

    async def _record(self, to, mail, kind, meta, status, *, error=None, message_id=None) -> None:
        from app import db
        from app.models import EmailLog

        meta = meta or {}
        try:
            db.get_engine()
            assert db._sessionmaker is not None
            async with db._sessionmaker() as session:
                session.add(
                    EmailLog(
                        batch_id=_uuid_or_none(meta.get("batch_id")) or uuid.uuid4(),
                        template_id=kind,
                        recipient=to,
                        user_id=_uuid_or_none(meta.get("user_id")),
                        locale=meta.get("locale"),
                        subject=mail.subject[:500],
                        status=status,
                        error_message=error,
                        provider=self.provider,
                        provider_message_id=message_id,
                    )
                )
                await session.commit()
        except Exception:
            logger.exception("메일 발송 이력 저장 실패 (%s → %s, %s)", kind, to, status)


def _uuid_or_none(value: object) -> uuid.UUID | None:
    try:
        return uuid.UUID(str(value)) if value else None
    except ValueError:
        return None


_console_sender = LoggingEmailSender(ConsoleEmailSender(), "console")


@lru_cache(maxsize=1)
def _ses_sender() -> LoggingEmailSender:
    if not settings.email_from_address:
        raise RuntimeError("EMAIL_BACKEND=ses에는 EMAIL_FROM_ADDRESS(SES에서 인증된 발신 주소)가 필요합니다.")
    return LoggingEmailSender(SesEmailSender(), "ses")


def get_email_sender() -> EmailSender:
    if settings.email_backend == "console":
        if settings.is_live:
            raise RuntimeError("live 환경에서는 console 메일 발송을 쓸 수 없습니다.")
        return _console_sender
    if settings.email_backend == "ses":
        return _ses_sender()
    raise RuntimeError(f"지원하지 않는 EMAIL_BACKEND: {settings.email_backend}")
