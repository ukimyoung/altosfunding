# Core Backend

회원, 챌린지, MT4 계좌, 거래 기록 조회 등 핵심 API (공개 Web Service).

- API 경로는 기존 서버와 같은 `/api/v1/...`이고, 요청·응답 형태도 기존 서버(openapi.json)와 맞춘다.
- DB는 Supabase Postgres에 SQLAlchemy(async) + asyncpg로 직접 접속한다. 테이블 정의의 기준은 `supabase/migrations/`의 SQL이다.
- 에러 응답: `{"error_code", "message_key", "message", "detail": {"error_code", "message"}}` (error_code는 기존 서버와 같은 소문자 snake_case)

```bash
cd backend/services/core
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

## 테스트

DB 테스트는 실제 Postgres에 마이그레이션을 적용해서 돌린다. `TEST_DATABASE_URL`이 없으면 DB 테스트는 건너뛴다.
테스트 DB는 매번 `core`·`notification` 스키마를 지우고 다시 만들므로 전용 DB를 쓴다.

```bash
TEST_DATABASE_URL=postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/altos_test pytest
```

## 구현된 API

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| POST | `/api/v1/auth/email/send-verification` | 가입용 6자리 인증코드 발송 (30분 유효, 60초 재발송 제한) |
| POST | `/api/v1/auth/email/verify` | 인증코드 확인 (5회 오입력 시 재발송 필요) |
| POST | `/api/v1/auth/register` | 회원가입 (인증 완료 후 30분 안에) |
| POST | `/api/v1/auth/login` | 이메일 로그인. access token은 본문, refresh token은 HttpOnly 쿠키(`refreshToken`, Path `/api/v1/auth`) |
| POST | `/api/v1/auth/refresh` | 쿠키로 access token 재발급. refresh token도 매번 새로 바뀌고, 이미 쓴 토큰이 다시 오면 그 회원의 세션을 모두 끊는다 |
| POST | `/api/v1/auth/logout` | 현재 refresh token 폐기, 쿠키 삭제 |
| GET | `/api/v1/auth/me` | 내 정보 (Bearer 토큰 필요) |
| POST | `/api/v1/auth/2fa/login` | 2FA 로그인 2단계. 임시 토큰 쿠키(`2fa_temp_token`, 10분) + TOTP 또는 백업 코드. 5회 틀리면 15분 잠금 |
| POST | `/api/v1/auth/2fa/setup` | 2FA 설정 시작. 비밀키·QR 주소·백업 코드 10개 반환 (아직 꺼진 상태) |
| POST | `/api/v1/auth/2fa/verify` | TOTP 코드를 확인하고 2FA 켜기 |
| POST | `/api/v1/auth/2fa/disable` | TOTP 또는 백업 코드로 2FA 끄기 |
| POST | `/api/v1/auth/2fa/backup-codes/regenerate` | TOTP 코드로 백업 코드 재발급 (기존 코드 폐기) |
| PUT | `/api/v1/auth/password` | 비밀번호 변경. 지금 기기를 뺀 다른 기기 로그인은 끊는다 |
| POST | `/api/v1/auth/password/forgot` | 재설정 링크 메일 발송 (`{WEB_BASE_URL}/reset-password?token=...`, 30분 유효). 가입 여부와 관계없이 같은 응답 |
| POST | `/api/v1/auth/password/reset` | 토큰으로 비밀번호 재설정. 모든 기기 로그인을 끊는다 |
| PUT | `/api/v1/auth/profile` | 프로필 수정 (초대 코드는 비어 있을 때 한 번만 등록) |
| PATCH | `/api/v1/auth/security/withdraw-email` | 출금 시 이메일 인증 사용 여부 |
| GET | `/api/v1/auth/login-history` | 로그인 이력 (`page`, `size`) |
| GET | `/api/v1/auth/google/login` | Google 로그인 화면으로 이동 (`state`=돌아갈 사용자 웹 주소, `prompt`) |
| GET | `/api/v1/auth/google/callback` | Google 콜백. 성공 시 `{웹}/my-page?login_success=true`(신규 가입이면 `&welcome=true`), 2FA 회원은 `{웹}/login/2fa`, 실패 시 `{웹}/login?error=google_auth_failed&detail=...` |
| GET | `/api/v1/auth/google/url` | Google 로그인 주소만 반환 |

Google 로그인 참고
- 같은 이메일로 이메일 가입한 회원은 Google로도 로그인된다 (Google이 인증한 이메일만 허용, 기존 서버와 동일). 처음 쓰는 이메일이면 바로 가입된다.
- `state`는 서명해서 쓰고 같은 값의 쿠키와 비교해 위조된 콜백을 막는다. 돌아갈 주소는 `WEB_BASE_URL`과 `FRONTEND_ALLOWED_ORIGINS`에 있는 주소만 허용한다.
- Google Cloud 콘솔의 OAuth 클라이언트에 `GOOGLE_REDIRECT_URI`를 "승인된 리디렉션 URI"로 등록해야 한다.

인증이 필요한 API는 `app/deps.py`의 `CurrentUser`(회원), `AdminUser`(관리자)를 쓴다.
