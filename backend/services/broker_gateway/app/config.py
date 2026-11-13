from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "local"  # local | sandbox | live
    database_url: str = ""
    redis_url: str = "redis://localhost:6379/0"

    # 브로커 MT4 REST API. 기본값은 데모 서버이며, Live 주소는 live 환경 변수로만 주입합니다.
    mt4_api_base_url: str = "https://mexn-mt4-alto-demo.tfb-api.com"
    mt4_api_key: str = ""


settings = Settings()
