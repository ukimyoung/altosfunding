from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "local"  # local | sandbox | live
    database_url: str = ""
    # 테스트처럼 이벤트 루프가 자주 바뀌는 환경에서는 연결 풀을 쓰지 않는다.
    database_null_pool: bool = False
    redis_url: str = "redis://localhost:6379/0"

    # 이메일 인증코드 HMAC, JWT 서명 등에 쓰는 비밀 값. 배포 환경에서는 반드시 바꾼다.
    secret_key: str = "change-me-local-only"

    # Google reCAPTCHA 서버 키. 비어 있으면 local/sandbox에서는 검증을 건너뛴다. live에서는 필수.
    recaptcha_secret_key: str = ""
    recaptcha_min_score: float = 0.5

    # 메일 발송 방식: console(로그로만 출력) | notification_hub
    email_backend: str = "console"
    notification_hub_url: str = "http://localhost:8002"

    # 이메일 인증코드 정책
    email_code_ttl_minutes: int = 30
    email_code_resend_cooldown_seconds: int = 60
    email_code_max_attempts: int = 5
    # 인증을 마친 뒤 이 시간 안에 가입을 끝내야 한다.
    signup_verification_valid_minutes: int = 30

    @property
    def is_live(self) -> bool:
        return self.app_env == "live"


settings = Settings()
