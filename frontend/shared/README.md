# Shared (공용 코드)

`web`과 `backoffice`가 함께 쓰는 코드입니다. 빌드 단계 없이 TypeScript 소스를 그대로 import 합니다.

```ts
import { createApiClient } from '@altosfunding/shared/api/createApiClient';
import { getApiErrorMessage } from '@altosfunding/shared/api/errors';
```

| 경로 | 내용 |
|---|---|
| `api/createApiClient.ts` | 인증 처리가 들어간 axios 인스턴스 팩토리 (토큰 첨부, 401 시 자동 재발급, 실패 시 로그인 이동) |
| `api/errors.ts` | `getApiErrorMessage`, `isUnauthorizedError` |
| `auth/tokenStore.ts` | 메모리 access token 저장소 |
| `query/createQueryClient.ts` | TanStack Query 기본 설정 |

## 규칙

- 앱(`web`, `backoffice`)을 import 하지 않습니다.
- 한쪽 앱만 쓰는 코드, 관리자 전용 API(`/v1/admin/*`)는 두지 않습니다.
- 앞으로 옮길 후보: 공통 auth API(login·logout·me)와 응답 타입, 날짜·금액 포맷 유틸, 디자인 토큰을 맞춘 뒤의 공용 UI 컴포넌트.
