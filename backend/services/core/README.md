# Core Backend

회원, 챌린지, MT4 계좌, 거래 기록 조회 등 핵심 API (공개 Web Service).

```bash
cd backend/services/core
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
pytest
```
