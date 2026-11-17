from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ManualEmailFilter(BaseModel):
    """조건 검색. 날짜는 YYYY-MM-DD (KST)."""

    email: str | None = None
    joined_from: str | None = None
    joined_to: str | None = None
    unsubscribed_from: str | None = None  # 수신거부 관리: 수신거부 시각 기준
    unsubscribed_to: str | None = None
    grade: str | None = "ALL"  # ALL | NORMAL | VIP
    challenge_type_code: str | None = "ALL"  # 챌린지 주문이 Core로 옮겨 오면 적용
    marketing_preview: bool = False  # true면 수신 동의하지 않은 회원을 '제외' 대상으로 표시
    newsletter_filter: str | None = "ALL"  # ALL | SUBSCRIBED | UNSUBSCRIBED
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)


class LocaleContent(BaseModel):
    subject: str = Field("", max_length=300)
    html_content: str = Field("", max_length=500_000)


class DraftPayload(BaseModel):
    target_mode: Literal["filter_all", "manual_input", "csv_import"]
    filter: ManualEmailFilter | None = None
    manual_entries: list[str] | None = Field(None, max_length=10_000)
    import_id: str | None = None
    is_marketing: bool = True
    is_urgent: bool = False
    content_locales: dict[str, LocaleContent]
    preview_locale: str = "en"
    sample_user_name: str = Field("John Doe", max_length=100)
    send_at: datetime | None = None


class DraftUpdatePayload(BaseModel):
    target_mode: Literal["filter_all", "manual_input", "csv_import"] | None = None
    filter: ManualEmailFilter | None = None
    manual_entries: list[str] | None = Field(None, max_length=10_000)
    import_id: str | None = None
    is_marketing: bool | None = None
    is_urgent: bool | None = None
    content_locales: dict[str, LocaleContent] | None = None
    preview_locale: str | None = None
    sample_user_name: str | None = Field(None, max_length=100)
    send_at: datetime | None = None
