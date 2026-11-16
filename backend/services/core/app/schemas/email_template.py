"""메일 템플릿 관리 스키마. 백오피스 템플릿 관리 탭이 쓰던 기존 서버 형태(template_id·rule·locales)를 따른다."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

SendMode = Literal["instant", "delay"]
TEMPLATE_ID_PATTERN = r"^[a-z][a-z0-9_]{2,63}$"


class TemplateLocaleContent(BaseModel):
    subject: str = Field(min_length=1, max_length=300)
    html_content: str = Field(min_length=1, max_length=100_000)


class TemplateRule(BaseModel):
    event_type: str
    is_active: bool = True
    send_mode: SendMode = "instant"
    delay_minutes: int = Field(default=0, ge=0, le=4320)
    event_name: str | None = None


class TemplateListItem(BaseModel):
    template_id: str
    template_name: str
    description: str | None
    is_system: bool
    rule: TemplateRule
    locales: dict[str, TemplateLocaleContent]


class TemplateListResponse(BaseModel):
    items: list[TemplateListItem]


class TemplateDetail(TemplateListItem):
    variables: list[str]
    updated_at: datetime


class TemplateRuleUpdate(BaseModel):
    is_active: bool | None = None
    send_mode: SendMode = "instant"
    delay_minutes: int = Field(default=0, ge=0, le=4320)


class TemplateUpdateRequest(BaseModel):
    template_name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=300)
    rule: TemplateRuleUpdate
    # 보낸 언어만 바꾼다. en은 지울 수 없고, 다른 언어는 비워 둘 수 있다.
    locales: dict[str, TemplateLocaleContent] = Field(default_factory=dict)


class TemplateCreateRequest(TemplateUpdateRequest):
    template_id: str = Field(pattern=TEMPLATE_ID_PATTERN)
    variables: list[str] = Field(default_factory=list, max_length=30)


class TemplatePreviewRequest(BaseModel):
    content_html: str = Field(max_length=100_000)
    subject: str | None = Field(default=None, max_length=300)
    locale: str = "en"
    # 변수 자리에 넣어 볼 값. 없으면 {{ 변수 }}가 그대로 보인다.
    sample: dict[str, str] | None = None


class TemplatePreviewResponse(BaseModel):
    html: str
    subject: str | None
