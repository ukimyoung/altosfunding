# altosfunding

Altos Funding 모노레포입니다.

## 폴더 구조

```
altosfunding/
├── frontend/
│   ├── web/                      # 사용자용 웹
│   ├── backoffice/               # 관리자용 백오피스
│   └── shared/                   # 두 앱의 공용 코드
├── backend/
│   ├── services/
│   │   ├── core/                 # Core Backend (FastAPI, 공개 API)
│   │   ├── broker_gateway/       # Broker Gateway (FastAPI, MT4 연동, 내부 전용)
│   │   └── notification_hub/     # Notification Hub (FastAPI, 이메일·푸시)
│   └── worker/                   # Celery 워커 (비동기·주기 작업)
├── supabase/
│   ├── config.toml               # Supabase CLI 설정
│   ├── migrations/               # DB 마이그레이션 (develop → staging, main → production 자동 반영)
│   └── seed.sql                  # 로컬 개발용 시드
└── .github/workflows/ci.yml      # PR·push 시 서비스별 테스트
```

## 환경과 브랜치

| 환경 | 브랜치 | Supabase 프로젝트 | Render 환경 |
|---|---|---|---|
| Sandbox (테스트) | `develop` | altosfunding_staging | `sandbox` |
| Live (운영) | `main` | altosfunding_production | `live` |

## 작업 흐름

1. `develop`에서 기능 브랜치를 만들어 작업합니다.
2. 기능 브랜치를 `develop`으로 PR·머지하면 Sandbox에 반영됩니다. `supabase/migrations`의 새 파일은 staging DB에 자동 적용됩니다.
3. Sandbox에서 테스트한 뒤 `develop` → `main`으로 PR·머지하면 Live에 반영됩니다.

## DB 마이그레이션

```bash
supabase migration new <이름>   # supabase/migrations/에 새 SQL 파일 생성
supabase start                   # 로컬 Supabase 실행 (Docker 필요)
supabase db reset                # 로컬 DB에 마이그레이션 + seed 적용
```

서비스별 스키마: `core` (Core Backend), `notification` (Notification Hub).

## 비밀 값

`.env`는 커밋하지 않습니다. 각 폴더의 `.env.example`을 복사해 사용하고, 배포 환경 값은 Render Environment Group(`sandbox` / `live`)에 둡니다. 실 MT4·실 결제·운영 이메일 키는 `live` 그룹에만 넣습니다.
