# Notification Hub

이메일(SES), 웹/앱 푸시 등 알림 발송 서비스.

```bash
cd backend/services/notification_hub
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8002
pytest
```
