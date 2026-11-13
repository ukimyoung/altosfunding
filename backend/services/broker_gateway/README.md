# Broker Gateway

MT4 서버와 통신하는 내부 전용 서비스 (Render Private Service). Sandbox는 데모 MT4 서버에만 연결합니다.

```bash
cd backend/services/broker_gateway
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8001
pytest
```
