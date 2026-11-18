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
| POST | `/api/v1/auth/account/withdraw` | 본인 탈퇴. 개인정보 익명화, 모든 로그인 해제 (관리자 계정은 불가) |
| GET | `/api/v1/admin/users` | 회원 목록 (`keyword`, `status`, `grade`, `kyc_status`, `is_active`, `page`, `size`). 탈퇴 회원은 `status=WITHDRAWN`일 때만 |
| GET | `/api/v1/admin/users/summary` | 회원 수 요약 (상태·등급·KYC·어제 가입) |
| POST | `/api/v1/admin/users` | 회원 직접 생성 (이메일 인증 완료 상태) |
| GET | `/api/v1/admin/users/{id}` | 회원 상세 |
| PATCH | `/api/v1/admin/users/{id}/profile` | 회원 정보·등급·KYC 상태·상태·비밀번호 수정 |
| POST | `/api/v1/admin/users/{id}/suspend` · `/ban` · `/activate` | 비활성 / 영구 정지 / 활성 복귀. 막으면 그 회원의 모든 로그인을 바로 끊는다 |
| POST | `/api/v1/admin/users/{id}/withdraw` | 관리자 탈퇴 처리 |
| POST | `/api/v1/admin/users/{id}/reset-password` | 비밀번호 강제 재설정 |
| GET | `/api/v1/admin/users/{id}/status-history` | 상태 변경 이력 |

| GET | `/api/v1/catalog/products` | 상품 목록 (로그인 불필요, `tier_type`, `active_only`, `page`, `size`) |
| POST | `/api/v1/catalog/products` | 상품 생성. `product_id`를 비우면 `CHALLENGE_10K`처럼 만든다. 펀디드 상품은 `related_id`(연관 챌린지 상품 id, 예: 1001)를 지정할 수 있고, 챌린지 상품 하나에 펀디드 상품 하나만 연결된다 |
| PUT | `/api/v1/catalog/products/{id}` | 상품 수정 |
| PATCH | `/api/v1/catalog/products/{id}/status` | 상품 활성/비활성 |
| GET·POST | `/api/v1/admin/rulesets` | 룰셋 목록·생성 (`id`를 비우면 `RS-XXXXXX`) |
| GET·PATCH | `/api/v1/admin/rulesets/{id}` | 룰셋 상세·수정 |
| GET | `/api/v1/demo/options` | 데모 계좌 레버리지·자본금 선택지 (`core.platform_config`의 `DEMO` 값) |

| GET | `/api/v1/challenges/summary` | 모집 중·진행 중 챌린지 회차 (로그인 불필요) |
| GET | `/api/v1/challenges/products` | Start New Challenge 상품 카드: 활성 챌린지 상품(원가격·할인가격·추천·레버리지·Trading 기간), 룰셋 조건(금액 환산), 펀디드 단계(이 상품을 연관 챌린지 상품 `related_id`로 지정한 펀디드 상품, 없으면 next_product_id), 지금 신청할 수 있는 모집 중 회차 (로그인 불필요) |
| GET·POST | `/api/v1/admin/challenges` | 회차 목록(`status`, `date`, `product_id`, `schedule_id`)·직접 생성 |
| GET | `/api/v1/admin/challenges/{id}` | 회차 상세 |
| POST | `/api/v1/admin/challenges/{id}/start`, `/close` | 바로 시작, 종료 (`cancel_reason`을 넣으면 취소) |
| GET | `/api/v1/admin/challenges/active-dates`, `/grouped` | 회차 시작일 목록, 기간별 묶음 (백오피스 대회 목록) |
| GET·POST | `/api/v1/admin/schedules` | 자동 생성 스케줄 목록·생성 |
| GET·PATCH·DELETE | `/api/v1/admin/schedules/{id}` | 스케줄 상세·수정·중지(PAUSED) |
| POST | `/api/v1/admin/schedules/{id}/trigger` | 다음 회차 지금 만들기 |
| POST | `/api/v1/admin/schedules/run-due` | 주기 작업 한 번 실행 (관리자, 테스트용) |
| GET·POST·PATCH·DELETE | `/api/v1/admin/holidays` | 휴장일 관리 |
| POST | `/api/v1/internal/jobs/challenges` | 주기 작업 (외부 스케줄러용, `X-System-Api-Key` 헤더) |
| GET | `/api/v1/auth/kyc/status` | 내 KYC 상태 (NONE/PENDING/APPROVED/REJECTED, 반려 사유) |
| GET | `/api/v1/auth/kyc/sumsub/token` | Sumsub WebSDK 접근 토큰 (`SUMSUB_APP_TOKEN`, `SUMSUB_SECRET_KEY` 필요) |
| POST | `/api/v1/webhooks/sumsub` | Sumsub 심사 결과 웹훅 (`X-Payload-Digest` 서명 확인, `SUMSUB_WEBHOOK_SECRET` 필요) |

| GET | `/api/v1/accounts/my-asset` | My Asset Total Asset (통합 지갑 잔고). Live 계좌는 지원하지 않아 `live_accounts`는 빈 목록 |
| GET | `/api/v1/payouts/config/networks` | 입금·출금 팝업 네트워크 목록과 출금 수수료 (사용 중인 것만) |
| GET | `/api/v1/wallets/me`, `/wallets/me/transactions` | 내 지갑, 입출금 내역 (`category`, `status`, `start_date`·`end_date` YYYYMMDD KST) |
| POST | `/api/v1/wallets/me/deposit` | 입금 확인 요청 (USDT 송금 후 TX hash, 최소 10 USDT, 같은 hash 중복 불가) |
| POST | `/api/v1/wallets/me/withdraw` | 출금 신청 (KYC 승인 필요, 2FA·출금 이메일 인증, 잔고에서 바로 차감, 받는 금액 = 금액 - 수수료) |
| GET | `/api/v1/admin/wallets/requests/pending`, `/history`, `/summary` | 입출금 승인 대기(오래된 순)·처리 이력·대기 건수 |
| POST | `/api/v1/admin/wallets/deposits/{id}/approve`, `/reject` | 입금 승인(잔고 반영)·반려(`reason`) |
| POST | `/api/v1/admin/wallets/withdrawals/{id}/approve`, `/reject` | 출금 승인(송금 `tx_hash`)·반려(`note`, 잔고 되돌림) |
| GET·PUT | `/api/v1/admin/payout-settings/network-fees`, `/profit-split` | 네트워크별 출금 수수료, 기본 수익 분배 비율 (`/profit-split/history` 변경 이력) |

상품의 MT4 계좌번호 범위는 같은 MT4 서버를 쓰는 상품끼리 겹칠 수 없다 (챌린지·데모 = 데모 서버, 펀디드·라이브 = 실서버).

챌린지 회차 자동 생성 (`app/services/challenge.py`)
- 주기 작업 한 번 = 시작·종료 시각이 된 회차 상태 변경(PENDING→ACTIVE→CLOSED, 시작 못 하고 끝난 PENDING은 CANCELLED) + 때가 된 스케줄의 다음 회차 생성.
- 스케줄마다 모집 중 회차는 하나. 그 회차가 시작되면 다음 회차를 만든다. 시작 = 직전 회차 시작일 + `interval_days`의 `start_time`, 종료 = 시작일 + `duration_days`의 `end_time` (모두 UTC, 기본 22:00 / 21:00).
- `exclude_holiday`이면 주말과 휴장일을 건너뛰고 종료일도 영업일만 센다.
- Background Worker가 1분마다 이 작업을 돌린다 (아래 'Background Worker'). 백오피스 '지금 실행'(`run-due`)은 즉시 확인용으로만 남겨 둔다.

관리자 API는 `role=ADMIN` 계정만 쓸 수 있다. 첫 관리자는 가입 후 Supabase SQL Editor에서 `update core.users set role = 'ADMIN' where email = '...'`로 지정한다.
아직 없는 기능: 회원별 파트너 실적(`partner-stats`)은 쿠폰 기능과 함께, 계좌 수·총자산은 트레이딩 계좌 기능과 함께 채운다.

## Background Worker (`python -m app.worker`)
Core와 같은 코드·같은 DB를 쓰는 Render Background Worker(`altosfunding-worker-sandbox`). Celery·Redis 없이 Postgres만 쓴다.
- 1분마다(`WORKER_TICK_SECONDS`): 챌린지 회차 시작·종료·다음 회차 생성(`challenge.run_due_jobs`), 예약 수동 메일 발송(`manual_email.run_due_jobs`). 서로 따로 돌아서 메일을 오래 보내는 중에도 회차는 제때 바뀐다.
- 5초마다(`WORKER_POLL_SECONDS`): 작업 큐 `core.jobs` 처리 (`app/services/jobs.py`).
  - API는 `jobs.enqueue(session, kind, payload, dedupe_key=..., ref_type=..., ref_id=...)`로 넣고 커밋만 한다. 처리기는 `@jobs.handler("kind")`로 등록하고 `app/worker.py`의 `import_job_handlers()`에 모듈을 추가한다.
  - `FOR UPDATE SKIP LOCKED`로 꺼내므로 Worker를 여러 개 띄워도 같은 작업을 두 번 잡지 않는다.
  - 실패하면 30초·1분·2분…(최대 1시간) 뒤 재시도, `max_attempts`(기본 5)를 다 쓰면 FAILED. 재시도해도 소용없는 오류는 `PermanentJobError`. 시도마다 `core.job_attempts`에 기록.
  - Worker가 처리 중에 죽어 RUNNING으로 10분(`WORKER_JOB_LEASE_SECONDS`) 넘게 남은 작업은 다시 시도한다. 그래서 처리기는 두 번 실행돼도 괜찮게(멱등) 만든다 (MT4 호출은 현재 상태를 먼저 확인).
- 생존 기록: `core.worker_heartbeats`. 관리자 API `GET /api/v1/admin/system/worker`(살아 있는지, 마지막 실행 결과, 작업 수), `GET /api/v1/admin/system/jobs`(작업 목록).
- 종료 신호(SIGTERM)를 받으면 진행 중인 반복을 마치고 끝낸다.
- 로컬: `.env`에 `DATABASE_URL`을 넣고 `python -m app.worker`.

## 배포 (Render, 테스트용)
`render.yaml`의 `altosfunding-core-sandbox` 서비스. Render 대시보드에서 Blueprint를 동기화하면 만들어지고, `DATABASE_URL`(Supabase staging Session pooler 연결 문자열) 등 `sync: false` 값을 입력해야 한다.
- 배포 확인: `/health`, `/health/db`, API 문서 `/docs`
- 로컬 웹에서 시험: `frontend/web/.env.local`에 `API_PROXY_TARGET=https://altosfunding-core-sandbox.onrender.com`

Google 로그인 참고
- 같은 이메일로 이메일 가입한 회원은 Google로도 로그인된다 (Google이 인증한 이메일만 허용, 기존 서버와 동일). 처음 쓰는 이메일이면 바로 가입된다.
- `state`는 서명해서 쓰고 같은 값의 쿠키와 비교해 위조된 콜백을 막는다. 돌아갈 주소는 `WEB_BASE_URL`과 `FRONTEND_ALLOWED_ORIGINS`에 있는 주소만 허용한다.
- Google Cloud 콘솔의 OAuth 클라이언트에 `GOOGLE_REDIRECT_URI`를 "승인된 리디렉션 URI"로 등록해야 한다.

지갑·원장 (`app/services/wallet.py`)
- 잔고(`core.wallets`)는 이 모듈 함수로만 바꾸고, 바꿀 때마다 `wallet_transactions` 1건과 복식부기 분개(`journal_entries`/`journal_lines`)를 같은 트랜잭션에서 만든다. 이력·분개는 DB 트리거로 수정·삭제를 막는다.
- 분개: 입금 승인 차)현금/대)회원지갑, 출금 신청 차)회원지갑/대)출금대기, 출금 승인 차)출금대기/대)현금+수수료수입, 출금 반려 차)출금대기/대)회원지갑.
- 출금 이메일 코드는 `POST /auth/email/send-verification` (`purpose=WITHDRAW_REQUEST`, 로그인 필요, 본인 이메일만)로 받는다.

인증이 필요한 API는 `app/deps.py`의 `CurrentUser`(회원), `AdminUser`(관리자)를 쓴다.
