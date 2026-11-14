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
    const params = new URLSearchParams(window.location.search);
    return params.get('lang') === 'ko' ? 'ko' : 'en';
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
