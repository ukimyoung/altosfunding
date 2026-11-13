# Broker Gateway

브로커 MT4 REST API를 호출하는 내부 전용 서비스 (Render Private Service). Sandbox는 데모 API(mexn-mt4-alto-demo.tfb-api.com), Live는 운영 API(mexn-mt4-alto.tfb-api.com)에 연결합니다.

```bash
cd backend/services/broker_gateway
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8001
pytest
```
