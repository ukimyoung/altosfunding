"""메일 발송. 지금은 로그 출력(console)만 있고, 실제 발송은 Notification Hub(SES)를 붙일 때 추가한다."""

import logging
from typing import Protocol

from app.config import settings

logger = logging.getLogger(__name__)


class EmailSender(Protocol):
    async def send_verification_code(self, email: str, code: str, purpose: str, locale: str) -> None: ...


class ConsoleEmailSender:
    """메일을 보내지 않고 로그에 남긴다. local/sandbox 전용."""

    def __init__(self) -> None:
        self.sent: list[dict[str, str]] = []

    async def send_verification_code(self, email: str, code: str, purpose: str, locale: str) -> None:
        self.sent.append({"email": email, "code": code, "purpose": purpose, "locale": locale})
        logger.warning("[console email] %s 인증코드 → %s: %s", purpose, email, code)


_console_sender = ConsoleEmailSender()


def get_email_sender() -> EmailSender:
    if settings.email_backend == "console":
        if settings.is_live:
            raise RuntimeError("live 환경에서는 console 메일 발송을 쓸 수 없습니다.")
        return _console_sender
    raise RuntimeError(f"지원하지 않는 EMAIL_BACKEND: {settings.email_backend}")
