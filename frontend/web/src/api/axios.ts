import { createApiClient } from '@altosfunding/shared/api/createApiClient';
import type { Locale } from '@/app/i18n/translations';

const isAuthPage = () => {
  const { pathname } = window.location;
  return pathname === '/login' || pathname.startsWith('/login/') || pathname.startsWith('/signup');
};

const getBrowserTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
};

const getCurrentLocale = (): Locale => {
  try {
    // 화면 언어: 주소의 ?lang= → 저장해 둔 언어(LocaleContext) → 영어
    const lang =
      new URLSearchParams(window.location.search).get('lang') ??
      window.localStorage.getItem('altos.locale');
    return lang === 'ko' ? 'ko' : 'en';
  } catch {
    return 'en';
  }
};

const api = createApiClient({
  getTimeZone: getBrowserTimeZone,
  getLocale: getCurrentLocale,
  isAuthPage,
});

export default api;
