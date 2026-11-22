from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "local"  # local | sandbox | live
    database_url: str = ""
    # 테스트처럼 이벤트 루프가 자주 바뀌는 환경에서는 연결 풀을 쓰지 않는다.
    database_null_pool: bool = False
    # 프로세스 하나가 여는 DB 연결 수 = pool_size + max_overflow.
    # Supabase 풀러(session 모드, 5432)는 프로젝트 전체 동시 연결이 15개로 제한된다.
    # Core 5개 + Worker 5개 = 10개로 두어, 배포 중 새·옛 인스턴스가 잠시 겹쳐도 15개를 넘지 않게 한다.
    db_pool_size: int = 3
    db_max_overflow: int = 2
    # 연결이 모두 사용 중이면 이만큼 기다린 뒤 실패한다 (풀러 한도 초과로 바로 실패하는 대신).
    db_pool_timeout: float = 30
    redis_url: str = "redis://localhost:6379/0"

    # 이메일 인증코드 HMAC, JWT 서명 등에 쓰는 비밀 값. 배포 환경에서는 반드시 바꾼다.
    secret_key: str = "change-me-local-only"

    # 로그인 토큰. access token은 짧게 두고, 만료되면 프론트가 refresh 쿠키로 다시 받는다.
    jwt_access_expire_minutes: int = 30
    jwt_refresh_expire_days: int = 7
    jwt_2fa_temp_expire_minutes: int = 10
    # refresh 쿠키. Render rewrite 덕분에 프론트와 API가 같은 도메인이라 lax로 충분하다.
    cookie_secure: bool = True
    cookie_samesite: str = "lax"

    # Google reCAPTCHA 서버 키. 비어 있으면 local/sandbox에서는 검증을 건너뛴다. live에서는 필수.
    recaptcha_secret_key: str = ""
    recaptcha_min_score: float = 0.5

    # 사용자 웹 주소. 비밀번호 재설정 메일의 링크에 쓴다.
    web_base_url: str = "http://localhost:5173"
    password_reset_ttl_minutes: int = 30
    password_reset_cooldown_seconds: int = 60

    # 2FA 코드를 연속으로 틀리면 잠시 잠근다.
    two_factor_max_failures: int = 5
    two_factor_lock_minutes: int = 15

    # Google 로그인 (OAuth 2.0 인가 코드 방식)
    google_client_id: str = ""
    google_client_secret: str = ""
    # Google 콘솔에 등록한 콜백 주소. 예: https://altosfunding-web-sandbox.onrender.com/api/v1/auth/google/callback
    google_redirect_uri: str = ""
    # 로그인 뒤 돌아갈 수 있는 사용자 웹 주소 (쉼표로 구분). web_base_url은 항상 허용된다.
    frontend_allowed_origins: str = ""

    # 외부 스케줄러가 내부 작업 API(/internal/jobs/...)를 부를 때 X-System-Api-Key 헤더로 보내는 값.
    # 비어 있으면 내부 작업 API를 막는다.
    system_api_key: str = ""

    # Background Worker (python -m app.worker)
    # 챌린지 회차·예약 메일을 확인하는 주기(초)
    worker_tick_seconds: float = 60
    # 작업 큐(core.jobs)를 확인하는 주기(초)
    worker_poll_seconds: float = 5
    # 한 번에 꺼내는 작업 수
    worker_job_batch_size: int = 10
    # RUNNING 작업이 이 시간(초)보다 오래 끝나지 않으면 Worker가 죽은 것으로 보고 다시 시도한다
    worker_job_lease_seconds: int = 600

    # Core의 공개 주소. 메일 본문 이미지 주소(/api/v1/files/{id})에 쓴다.
    # 비어 있으면 Render가 넣어 주는 RENDER_EXTERNAL_URL, 그것도 없으면 요청 주소를 쓴다.
    core_public_url: str = ""
    render_external_url: str = ""
    # 수동 발송 속도 (초당 통수). SES 계정 발송 한도(샌드박스 1, 기본 14)보다 낮게 둔다.
    manual_email_rate_per_second: float = 10.0

    # MT4 API (Tools For Brokers). 요청마다 X-API-KEY 헤더로 키를 보낸다.
    # demo: 챌린지·데모 계좌 서버(mexn-mt4-alto-demo), live: 펀디드·라이브 계좌 서버(mexn-mt4-alto)
    # 비어 있으면 계좌 발급 작업이 "설정되지 않음"으로 재시도하다가 환불된다.
    mt4_demo_base_url: str = ""
    mt4_demo_api_key: str = ""
    mt4_live_base_url: str = ""
    mt4_live_api_key: str = ""
    mt4_http_timeout_seconds: float = 20
    # 계좌 발급 메일·화면에 보여 주는 MT4 서버 이름
    mt4_demo_server_name: str = "MexnLimited-Demo"
    mt4_live_server_name: str = "MexnLimited-Live"
    # 거래 내역·잔고 수집 (Worker). 주기마다 거래 가능(ACTIVE) 계좌 전체를 동시에 조회한다.
    mt4_ingest_seconds: float = 60
    mt4_ingest_concurrency: int = 10
    # 다음 조회는 마지막 청산 시각에서 이만큼 앞부터 다시 받는다 (늦게 기록된 청산·시간대 차이 대비).
    mt4_ingest_overlap_seconds: int = 3600
    # 잔고·평가금액 이력을 쌓는 최소 간격 (최근 값은 매 주기 계좌에 갱신)
    mt4_equity_snapshot_seconds: int = 300
    # 계좌가 ACTIVE를 벗어난 뒤(대회 종료 등) 이 시간 동안 더 수집해 마지막 청산 내역을 받는다.
    mt4_ingest_after_close_seconds: int = 1800
    # MT4 서버 시각의 시간대. 조회 기간(dateFrom/dateTo)을 이 시간대로 보내고, 시간대 없는 응답 시각도 이 시간대로 읽는다.
    mt4_server_timezone: str = "Europe/Athens"
    # 트레이딩 룰 자동 검증 (Worker). 거래일 = 이 시간대의 날짜, 마감 = 그 날짜 다음 날 0시.
    risk_enabled: bool = True
    risk_seconds: float = 60
    # 평가금액만 따로 이 주기로 일괄 조회해 Max Drawdown·Daily Loss를 바로 판정한다 (0이면 끔)
    risk_equity_watch_seconds: float = 5
    risk_trading_timezone: str = "Europe/Athens"
    # 마감 후 이만큼 기다렸다가 결산한다 (마감 직전 청산 내역이 수집될 시간)
    risk_close_grace_seconds: int = 300
    # 이보다 오래된 평가금액으로는 위반 판정을 하지 않는다 (수집 실패 계좌)
    risk_equity_max_age_seconds: int = 180
    # 대회 종료 후 이만큼 지나 자동 최종 판정을 기록한다 (종료 후 마지막 수집을 기다림)
    risk_final_delay_seconds: int = 600
    # 2단계 조치: Max Drawdown 위반 → 전량 청산·ReadOnly·FAILED, 펀디드 Daily Loss → 그날 청산·정지,
    # 대회 종료 → 전량 청산, 최종 판정 → 계좌 상태 PASSED/FAILED. false면 1단계처럼 기록만 한다.
    risk_enforce: bool = True

    # Sumsub KYC. 비어 있으면 본인 인증 시작(토큰 발급)과 웹훅을 막는다. 상태 조회는 된다.
    sumsub_app_token: str = ""
    sumsub_secret_key: str = ""
    sumsub_webhook_secret: str = ""
    sumsub_base_url: str = "https://api.sumsub.com"
    sumsub_level_name: str = "id-and-liveness"

    # 메일 발송 방식: console(로그로만 출력) | ses(AWS SES로 실제 발송)
    email_backend: str = "console"
    # AWS SES. 키는 SES 발송 권한(ses:SendEmail)만 있는 IAM 사용자 것을 쓴다.
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "ap-southeast-1"
    # SES에서 인증(verify)된 발신 주소 또는 도메인의 주소. 예: noreply@altosfunding.com
    email_from_address: str = ""
    email_from_name: str = "Altos Funding"
    # 발송 추적용 SES Configuration Set 이름 (없으면 비워 둔다)
    ses_configuration_set: str = ""
    # 메일 하단에 안내하는 고객센터 주소
    email_support_address: str = "support@altosfunding.com"

    # 이메일 인증코드 정책
    email_code_ttl_minutes: int = 30
    email_code_resend_cooldown_seconds: int = 60
    # 출금 신청 인증코드는 짧게 둔다 (출금 화면의 재전송 대기 60초와 같게). 메일 문구는 분 단위(올림)로 보인다.
    withdraw_code_ttl_seconds: int = 60
    email_code_max_attempts: int = 5
    # 인증을 마친 뒤 이 시간 안에 가입을 끝내야 한다.
    signup_verification_valid_minutes: int = 30

    @field_validator("database_url")
    @classmethod
    def _use_asyncpg_driver(cls, value: str) -> str:
        # Supabase 대시보드의 연결 문자열(postgresql://...)을 그대로 넣어도 되게 한다.
        for prefix in ("postgresql://", "postgres://"):
            if value.startswith(prefix):
                return "postgresql+asyncpg://" + value[len(prefix):]
        return value

    @property
    def allowed_frontend_origins(self) -> set[str]:
        origins = {o.strip().rstrip("/") for o in self.frontend_allowed_origins.split(",") if o.strip()}
        origins.add(self.web_base_url.rstrip("/"))
        return origins

    @property
    def is_live(self) -> bool:
        return self.app_env == "live"


settings = Settings()
