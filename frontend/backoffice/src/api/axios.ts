import { createApiClient } from '@altosfunding/shared/api/createApiClient';

// 관리자 화면은 한국 시간 기준으로 데이터를 보여주므로 타임존을 고정한다.
const APP_TIMEZONE = 'Asia/Seoul';

const api = createApiClient({
  getTimeZone: () => APP_TIMEZONE,
});

export default api;
