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


settings = Settings()
