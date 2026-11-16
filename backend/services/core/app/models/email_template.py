import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, func
from sqlalchemy.dialects.postgresql import ARRAY, TEXT, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class EmailTemplate(Base):
    __tablename__ = "email_templates"

    # 템플릿 코드. 서버 코드가 이 값으로 찾으므로 만든 뒤에는 바꾸지 않는다.
    id: Mapped[str] = mapped_column(primary_key=True)
    name: Mapped[str]
    description: Mapped[str | None]
    # Core 코드가 직접 보내는 기본 템플릿 (삭제 불가)
    is_system: Mapped[bool] = mapped_column(server_default="false")
    is_active: Mapped[bool] = mapped_column(server_default="true")
    send_mode: Mapped[str] = mapped_column(server_default="instant")
    delay_minutes: Mapped[int] = mapped_column(server_default="0")
    variables: Mapped[list[str]] = mapped_column(ARRAY(TEXT), server_default="{}")
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("core.users.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())


class EmailTemplateContent(Base):
    __tablename__ = "email_template_contents"

    template_id: Mapped[str] = mapped_column(ForeignKey("core.email_templates.id"), primary_key=True)
    locale: Mapped[str] = mapped_column(primary_key=True)
    subject: Mapped[str]
    html_content: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())
