# Worker (Celery)

정산, MT4 거래 동기화, 챌린지 룰 집계 같은 비동기·주기 작업을 처리합니다 (Render Background Worker).

```bash
cd backend/worker
pip install -r requirements.txt
celery -A worker.celery_app worker --loglevel=info
```
