# Frontend

사용자용 웹과 관리자용 백오피스를 **독립된 앱 두 개**로 두고, 공용 코드는 `shared/`에서 함께 씁니다.

```
frontend/
├── package.json        # npm workspaces 루트 (web, backoffice, shared)
├── tsconfig.base.json  # 세 패키지가 함께 쓰는 TypeScript 설정
├── web/                # @altosfunding/web        일반 사용자용 웹 (Vite + React)
├── backoffice/         # @altosfunding/backoffice 관리자용 백오피스 (Vite + React)
└── shared/             # @altosfunding/shared     두 앱이 함께 쓰는 코드
```

## 원칙

- `web`과 `backoffice`는 **따로 빌드하고 따로 배포**합니다. 도메인도 분리합니다 (예: `altosfunding.com` / `admin.altosfunding.com`).
- 백오피스는 사용자 웹 번들에 섞이지 않습니다. 관리자 화면 코드나 관리자 API 주소가 사용자에게 노출되지 않게 하기 위해서입니다.
- 두 앱이 모두 쓰는 코드만 `shared/`에 둡니다. 한쪽만 쓰는 코드는 각 앱 안에 둡니다. `/v1/admin/*` API는 `shared/`에 두지 않습니다.
- `shared/`가 앱을 import 하는 것은 금지합니다 (`web` → `shared` ← `backoffice` 방향만).

## 기술 스택

React 18 · TypeScript · Vite 6 · React Router 7 · TanStack Query 5 · axios · Tailwind CSS 4

## 시작하기

Node.js 20 이상이 필요합니다. 패키지는 **`frontend/` 폴더에서 한 번만** 설치합니다.

```bash
cd frontend
npm install

# 각 앱의 .env.example 을 복사해 값을 채운다
cp web/.env.example web/.env.local
cp backoffice/.env.example backoffice/.env.local

npm run dev:web          # https://local.altosfunding.com:5173
npm run dev:backoffice   # https://localadmin.altosfunding.com:5174
```

개발 서버는 기본으로 mkcert 로컬 인증서(HTTPS)와 커스텀 도메인을 씁니다. hosts 파일에 아래를 추가하세요.

```
127.0.0.1 local.altosfunding.com
127.0.0.1 localadmin.altosfunding.com
```

도메인·포트·HTTPS·API 프록시 대상은 `.env.local` 의 `DEV_SERVER_HOST`, `DEV_SERVER_PORT`, `DEV_SERVER_HTTPS`, `API_PROXY_TARGET` 으로 바꿀 수 있습니다.

## 자주 쓰는 명령

| 명령 | 설명 |
|---|---|
| `npm run build` | web과 backoffice 모두 빌드 (`<앱>/dist`) |
| `npm run build:web` / `npm run build:backoffice` | 한 앱만 빌드 |
| `npm run typecheck` | 세 패키지 타입 검사 |
| `npm install <패키지> -w @altosfunding/web` | 특정 앱에 의존성 추가 |

## API 호출

두 앱 모두 `/api` 상대 경로로 요청합니다. 개발 중에는 Vite proxy가 `API_PROXY_TARGET` 으로 넘기고, 운영에서는 각 앱 도메인의 `/api` 를 백엔드로 넘기는 리버스 프록시(또는 rewrite)가 필요합니다.
인증(access token 메모리 보관, refresh token 쿠키로 자동 재발급)은 `shared/src/api/createApiClient.ts` 에 있습니다.

## 배포 (Render)

저장소 루트의 `render.yaml`(Blueprint)에 Sandbox용 정적 사이트 두 개가 정의되어 있습니다.

| 서비스 | 브랜치 | 빌드 결과 |
|---|---|---|
| `altosfunding-web-sandbox` | `develop` | `frontend/web/dist` |
| `altosfunding-backoffice-sandbox` | `develop` | `frontend/backoffice/dist` |

- 각 사이트의 `/api/*` 요청은 Render rewrite로 기존 API 서버(`121.254.254.52:8200`)에 넘깁니다. 새 백엔드로 옮길 때는 `render.yaml` 의 destination만 바꾸면 됩니다.
- 그 밖의 경로는 `index.html` 로 rewrite 해서 React Router가 처리합니다.
- `VITE_*` 값은 빌드 시점에 번들에 들어가므로, Render에서 값을 바꾼 뒤에는 다시 배포해야 반영됩니다.
