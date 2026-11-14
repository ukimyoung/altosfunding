from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "local"  # local | sandbox | live
    database_url: str = ""
    redis_url: str = "redis://localhost:6379/0"

    # 브로커 MT4 REST API (둘 다 브로커의 운영 API이며, 브로커 쪽에 Sandbox용 API는 없습니다)
    #   challenge: Challenge 티켓 구매 시 거래 계정 생성 (MT4 데모 서버)
    #   funded   : Funded 계정 생성 (MT4 실서버)
    # 기본값은 비워 두고, 각 환경의 환경 변수로만 주입합니다.
    mt4_challenge_api_url: str = ""
    mt4_funded_api_url: str = ""
    mt4_api_key: str = ""

    # mock: 브로커를 호출하지 않고 가짜 응답을 돌려줍니다 (local, sandbox).
    # live: 실제 브로커 API를 호출합니다. APP_ENV=live 에서만 허용됩니다.
    mt4_mode: Literal["mock", "live"] = "mock"

    @model_validator(mode="after")
    def _guard_live_broker(self) -> "Settings":
        if self.mt4_mode == "live" and self.app_env != "live":
            raise ValueError(
                f"MT4_MODE=live 는 APP_ENV=live 에서만 사용할 수 있습니다 (현재 APP_ENV={self.app_env})."
            )
        if self.mt4_mode == "live" and not (
            self.mt4_challenge_api_url and self.mt4_funded_api_url and self.mt4_api_key
        ):
            raise ValueError("MT4_MODE=live 에는 MT4_CHALLENGE_API_URL, MT4_FUNDED_API_URL, MT4_API_KEY 가 필요합니다.")
        return self


settings = Settings()
