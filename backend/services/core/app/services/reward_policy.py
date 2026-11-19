"""리워드 정책 (추천인 리워드 지급액·지급 조건, 트레이딩 보너스 추가율).

기존 서버와 같이 core.platform_config의 REWARD scope에 키별로 저장한다.
값이 없으면 마이그레이션 시드와 같은 기본값을 쓴다.
"""

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import AppError
from app.models import PlatformConfig
from app.schemas.reward import RewardPolicyOut

SCOPE = "REWARD"
# 펀디드 승급 시(FUNDED_UPGRADE) 지급은 하지 않기로 함 (2026-11-19 사용자 결정).
# 저장된 값이 FUNDED_UPGRADE면 get_policy가 기본값(FIRST_PURCHASE)을 쓴다.
CONDITIONS: tuple[str, ...] = ("FIRST_PURCHASE",)
DEFAULTS: dict[str, object] = {
    "referral_reward_amount": 40,
    "referral_reward_condition": "FIRST_PURCHASE",
    "trading_bonus_rate": 0.01,
}
DESCRIPTIONS = {
    "referral_reward_amount": "추천인 리워드 지급액 (USD)",
    "referral_reward_condition": "추천인 리워드 지급 조건 (FIRST_PURCHASE)",
    "trading_bonus_rate": "트레이딩 보너스 추가율 (0.01 = 1%p)",
}
MAX_REFERRAL_REWARD = 1_000_000


def _invalid(message: str) -> AppError:
    return AppError(422, "invalid_reward_policy", message)


def _number(value: object, label: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float, Decimal)):
        raise _invalid(f"{label}은(는) 숫자여야 합니다.")
    return float(value)


def validate_value(key: str, value: object) -> object:
    """키에 맞는 값인지 검사하고 저장할 형태로 바꾼다."""
    if key == "referral_reward_amount":
        amount = _number(value, "추천인 리워드 지급액")
        if amount < 0 or amount > MAX_REFERRAL_REWARD:
            raise _invalid(f"추천인 리워드 지급액은 0 이상 {MAX_REFERRAL_REWARD:,} 이하여야 합니다.")
        if round(amount, 2) != amount:
            raise _invalid("추천인 리워드 지급액은 소수점 둘째 자리까지 입력할 수 있습니다.")
        return int(amount) if amount == int(amount) else amount
    if key == "referral_reward_condition":
        if value not in CONDITIONS:
            raise _invalid("지급 조건은 FIRST_PURCHASE만 쓸 수 있습니다.")
        return value
    if key == "trading_bonus_rate":
        rate = _number(value, "트레이딩 보너스 추가율")
        if rate < 0 or rate > 1:
            raise _invalid("트레이딩 보너스 추가율은 0%p 이상 100%p 이하여야 합니다.")
        # 화면에서 %p를 100으로 나눠 보내므로 부동소수 오차를 정리한다 (0.07000000000000001 → 0.07).
        return round(rate, 6)
    raise _invalid(f"리워드 정책에는 {key} 키를 쓸 수 없습니다.")


async def get_policy(session: AsyncSession) -> RewardPolicyOut:
    rows = await session.execute(
        select(PlatformConfig.key, PlatformConfig.value).where(PlatformConfig.scope == SCOPE)
    )
    values = dict(DEFAULTS)
    for key, value in rows.all():
        if key not in DEFAULTS:
            continue
        try:
            values[key] = validate_value(key, value)
        except AppError:
            # 저장된 값이 잘못됐으면 기본값을 쓴다 (화면이 깨지지 않도록).
            pass
    return RewardPolicyOut(**values)


async def update_policy(session: AsyncSession, updates: dict[str, object]) -> RewardPolicyOut:
    """보낸 키만 바꾼다. 없는 행은 새로 만든다."""
    cleaned = {k: validate_value(k, v) for k, v in updates.items() if v is not None}
    for key, value in cleaned.items():
        config = await session.get(PlatformConfig, (SCOPE, key), with_for_update=True)
        if config is None:
            session.add(PlatformConfig(scope=SCOPE, key=key, value=value, description=DESCRIPTIONS[key]))
        else:
            config.value = value
    await session.flush()
    return await get_policy(session)

