# Core Backend

회원, 챌린지, MT4 계좌, 거래 기록 조회 등 핵심 API (공개 Web Service).

- API 경로는 기존 서버와 같은 `/api/v1/...`이고, 요청·응답 형태도 기존 서버(openapi.json)와 맞춘다.
- DB는 Supabase Postgres에 SQLAlchemy(async) + asyncpg로 직접 접속한다. 테이블 정의의 기준은 `supabase/migrations/`의 SQL이다.
- 에러 응답: `{"detail": {"error_code": "...", "message": "..."}, "message": "..."}`

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
