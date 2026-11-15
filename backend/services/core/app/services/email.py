"""메일 발송. 지금은 로그 출력(console)만 있고, 실제 발송은 Notification Hub(SES)를 붙일 때 추가한다."""

import logging
from typing import Protocol

from app.config import settings

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


_console_sender = ConsoleEmailSender()


def get_email_sender() -> EmailSender:
    if settings.email_backend == "console":
        if settings.is_live:
            raise RuntimeError("live 환경에서는 console 메일 발송을 쓸 수 없습니다.")
        return _console_sender
    raise RuntimeError(f"지원하지 않는 EMAIL_BACKEND: {settings.email_backend}")
