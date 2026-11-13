# Broker Gateway

브로커 MT4 REST API를 호출하는 내부 전용 서비스 (Render Private Service).

## 브로커 API

| 용도 | 주소 | 환경 변수 |
|---|---|---|
| Challenge 티켓 구매 → 거래 계정 생성 (MT4 데모 서버) | https://mexn-mt4-alto-demo.tfb-api.com | `MT4_CHALLENGE_API_URL` |
| Funded 계정 생성 (MT4 실서버) | https://mexn-mt4-alto.tfb-api.com | `MT4_FUNDED_API_URL` |

두 주소 모두 브로커의 **운영 API**이고, 브로커는 Sandbox용 API를 따로 제공하지 않습니다.

```bash
cd backend/services/broker_gateway
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8001
pytest
```
