"""챌린지 회차·스케줄·휴장일 스키마. 필드 이름과 기본값은 기존 서버와 같다."""

import datetime as dt
from datetime import datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

ScheduleStatus = Literal["ACTIVE", "PAUSED", "COMPLETED"]
ChallengeStatus = Literal["PENDING", "ACTIVE", "CLOSED", "CANCELLED"]

TEMPLATE_FIELDS = {"date", "month", "day", "seq", "weekday"}


def _check_template(value: str) -> str:
    from string import Formatter

    try:
        names = {name for _, name, _, _ in Formatter().parse(value) if name is not None}
    except ValueError as exc:
        raise ValueError("name_template 형식이 올바르지 않습니다.") from exc
    unknown = names - TEMPLATE_FIELDS
    if unknown:
        raise ValueError(f"name_template에 쓸 수 없는 항목: {', '.join(sorted(unknown))}")
    return value


# ── 스케줄 ──────────────────────────────────────────────────


class ScheduleCreate(BaseModel):
    name_template: str = Field(min_length=1, max_length=200)
    product_id: str
    # 비우면(null) 정원 무제한
    group_size: int | None = Field(default=None, gt=0)
    interval_days: int = Field(ge=0)
    duration_days: int = Field(ge=0)
    start_time: time = time(22, 0)
    end_time: time = time(21, 0)
    exclude_holiday: bool = True
    max_occurrences: int | None = Field(default=None, gt=0)
    next_run_at: datetime | None = None
    description: str | None = None
    # 테스트 전용 (분 단위). 운영 스케줄에서는 비워 둔다.
    interval_minutes: int | None = Field(default=None, gt=0)
    duration_minutes: int | None = Field(default=None, gt=0)

    _template = field_validator("name_template")(_check_template)

    @model_validator(mode="after")
    def _duration(self):
        if self.duration_days == 0 and self.duration_minutes is None:
            raise ValueError("duration_days는 1 이상이어야 합니다.")
        return self


class ScheduleUpdate(BaseModel):
    name_template: str | None = Field(default=None, min_length=1, max_length=200)
    product_id: str | None = None
    group_size: int | None = Field(default=None, gt=0)
    interval_days: int | None = Field(default=None, ge=0)
    duration_days: int | None = Field(default=None, ge=0)
    start_time: time | None = None
    end_time: time | None = None
    exclude_holiday: bool | None = None
    max_occurrences: int | None = Field(default=None, gt=0)
    status: ScheduleStatus | None = None
    next_run_at: datetime | None = None
    description: str | None = None
    interval_minutes: int | None = Field(default=None, gt=0)
    duration_minutes: int | None = Field(default=None, gt=0)

    @field_validator("name_template")
    @classmethod
    def _template(cls, value: str | None) -> str | None:
        return None if value is None else _check_template(value)


class ScheduleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name_template: str
    product_id: str
    group_size: int | None
    interval_days: int
    interval_minutes: int | None
    duration_days: int
    duration_minutes: int | None
    start_time: time
    end_time: time
    exclude_holiday: bool
    max_occurrences: int | None
    status: str
    created_count: int
    last_created_at: datetime | None
    next_run_at: datetime | None
    description: str | None
    created_at: datetime
    updated_at: datetime


class SchedulePage(BaseModel):
    items: list[ScheduleOut]
    total: int
    page: int
    size: int
    pages: int


class ScheduleTriggerResponse(BaseModel):
    created: bool
    challenge: "ChallengeOut | None" = None
    reason: str | None = None
    schedule: ScheduleOut


# ── 회차 ────────────────────────────────────────────────────


class ChallengeCreate(BaseModel):
    challenge_id: str | None = Field(default=None, max_length=50)
    product_id: str
    challenge_schedule_id: int | None = None
    name: str = Field(min_length=1, max_length=200)
    # 비우면(null) 정원 무제한
    group_size: int | None = Field(default=None, gt=0)
    start_at: datetime
    end_at: datetime

    @model_validator(mode="after")
    def _period(self):
        if self.end_at <= self.start_at:
            raise ValueError("end_at은 start_at보다 뒤여야 합니다.")
        return self


class ChallengeCloseRequest(BaseModel):
    # 비우면 정상 종료(CLOSED), 값을 넣으면 그 사유로 취소(CANCELLED)한다.
    cancel_reason: str | None = None


class ChallengeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    challenge_id: str
    product_id: str
    challenge_schedule_id: int | None
    name: str
    group_size: int | None
    status: str
    start_at: datetime
    end_at: datetime
    started_at: datetime | None
    closed_at: datetime | None
    cancel_reason: str | None
    current_participants: int


class ChallengePage(BaseModel):
    items: list[ChallengeOut]
    total: int
    page: int
    size: int
    pages: int


class ChallengeGroupedTier(BaseModel):
    challenge_id: str
    product_id: str
    product_name: str
    capital: float
    participants: int
    group_size: int | None


class ChallengeGroupedItem(BaseModel):
    start_at: datetime
    end_at: datetime
    status: str
    # 상품 type_code(예: '100', '300', '500')별 참가자 수 (기존 서버 형태)
    participants: dict[str, int]
    # 묶인 회차를 상품 자본금 순으로 (백오피스 대회 목록의 티어별 참가자)
    tiers: list[ChallengeGroupedTier] = []


class ChallengeGroupedPage(BaseModel):
    items: list[ChallengeGroupedItem]
    total: int
    page: int
    size: int
    pages: int


class ChallengeSummaryItem(BaseModel):
    status: str
    challenge_id: str
    challenge_name: str
    product_id: str
    description: str | None
    capital: float
    price_usdt: float
    discount_price_usdt: float | None = None
    type_code: str | None
    is_most_popular: bool
    current_participants: int
    group_size: int | None
    start_at: datetime


class ChallengeSummaryResponse(BaseModel):
    challenges: list[ChallengeSummaryItem]
    total_active_accounts: int


class OfferRules(BaseModel):
    """상품에 연결된 룰셋 중 화면에 보여줄 값. 금액은 상품 자본금으로 계산한다."""

    ruleset_id: str
    ruleset_name: str
    profit_target_pct: float | None
    profit_target_amt: float | None
    max_drawdown_pct: float
    max_drawdown_amt: float
    daily_loss_limit_pct: float
    daily_loss_limit_amt: float
    dd_calc_method: str
    min_trading_days: int
    pass_condition_type: str
    pass_condition_pct: float | None
    pass_condition_amt: float | None
    # 최대 Mini·Micro 거래 계약수, 일관성(%). null이면 제한 없음.
    max_mini_contracts: int | None = None
    max_micro_contracts: int | None = None
    consistency_pct: float | None = None


class OfferFunded(BaseModel):
    product_id: str
    name: str
    capital: float
    leverage: int
    payout_ratio: float
    rules: OfferRules | None


class OfferRound(BaseModel):
    challenge_id: str
    challenge_name: str
    start_at: datetime
    end_at: datetime
    current_participants: int
    group_size: int | None


class ChallengeOffer(BaseModel):
    product_id: str
    name: str
    description: str | None
    capital: float
    price_usdt: float
    discount_price_usdt: float | None
    final_price_usdt: float
    is_most_popular: bool
    leverage: int
    duration_days: int
    rules: OfferRules | None
    funded: OfferFunded | None
    # 지금 신청할 수 있는 모집 중 회차. 없으면 상품만 보여주고 선택은 막는다.
    open_challenge: OfferRound | None


class ChallengeOffersResponse(BaseModel):
    items: list[ChallengeOffer]


class JobRunResponse(BaseModel):
    created: int
    started: int
    closed: int
    cancelled: int


# ── 휴장일 ──────────────────────────────────────────────────


class HolidayCreate(BaseModel):
    date: dt.date
    name: str = Field(min_length=1, max_length=100)
    is_active: bool = True


class HolidayUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    is_active: bool | None = None


class HolidayOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date: dt.date
    name: str
    is_active: bool


ScheduleTriggerResponse.model_rebuild()
