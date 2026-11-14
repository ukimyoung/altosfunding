# Broker Gateway

브로커 MT4 REST API를 호출하는 내부 전용 서비스 (Render Private Service).

## 브로커 API

| 용도 | 주소 | 환경 변수 |
|---|---|---|
| Challenge 티켓 구매 → 거래 계정 생성 (MT4 데모 서버) | https://mexn-mt4-alto-demo.tfb-api.com | `MT4_CHALLENGE_API_URL` |
| Funded 계정 생성 (MT4 실서버) | https://mexn-mt4-alto.tfb-api.com | `MT4_FUNDED_API_URL` |

두 주소 모두 브로커의 **운영 API**이고, 브로커는 Sandbox용 API를 따로 제공하지 않습니다.

## Mock 모드

| 환경 | `APP_ENV` | `MT4_MODE` | 동작 |
|---|---|---|---|
| 로컬 | `local` | `mock` (기본값) | 가짜 MT4 계정 반환, 브로커 호출 없음 |
| Sandbox | `sandbox` | `mock` | 가짜 MT4 계정 반환, 브로커 호출 없음 |
| Live | `live` | `live` | 실제 브로커 API 호출 |

- `MT4_MODE=live`는 `APP_ENV=live`일 때만 허용됩니다. 다른 환경에서 켜면 서비스가 시작되지 않습니다.
- Mock 계정은 로그인 번호가 900000001부터 시작하고, 서버 이름이 `MOCK-CHALLENGE` / `MOCK-FUNDED`, 응답에 `is_mock: true`가 붙습니다.
- 실제 브로커 호출(`app/broker/http.py`)은 브로커 API 명세를 받은 뒤 구현합니다.

```bash
cd backend/services/broker_gateway
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8001
pytest
```
