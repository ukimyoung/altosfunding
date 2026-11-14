import type { ContentLanguage } from '@/api/support';
import type { Locale } from './translations';

export type DisplayLanguageOption = {
  code: Locale;
  flag: string;
  name: string;
  short: string;
  displayCode: string;
};

// 앱에서 새 언어를 실제로 지원하려면 아래 항목을 함께 추가해야 한다.
// 1. translations.ts의 Locale 타입과 translations 리소스
// 2. src/app/i18n/locales 하위 각 도메인의 {locale}.ts와 index.ts record
// 3. 아래 APP_SUPPORTED_LOCALES
// 4. 아래 LANGUAGE_DISPLAY_BY_CODE 표시 메타데이터
// 5. LanguageSelector 전용 이름이 필요하면 아래 LANGUAGE_SELECTOR_NAME_BY_CODE
export const APP_SUPPORTED_LOCALES = ['en', 'ko'] as const satisfies readonly Locale[];

const LANGUAGE_DISPLAY_BY_CODE: Record<Locale, DisplayLanguageOption> = {
  en: { code: 'en', flag: '🇺🇸', name: 'English', short: 'EN', displayCode: 'EN' },
  ko: { code: 'ko', flag: '🇰🇷', name: '한국어', short: 'KR', displayCode: 'KR' },
};

const LANGUAGE_SELECTOR_NAME_BY_CODE: Partial<Record<Locale, string>> = {
  en: 'US English',
  ko: 'KR 한국어',
};

export const DEFAULT_LANGUAGE_OPTIONS: DisplayLanguageOption[] = APP_SUPPORTED_LOCALES.map(
  (code) => LANGUAGE_DISPLAY_BY_CODE[code],
);

export const isSupportedLocale = (code: string): code is Locale =>
  APP_SUPPORTED_LOCALES.includes(code as Locale);

const isActiveSupportedContentLanguage = (
  language: ContentLanguage,
): language is ContentLanguage & { code: Locale } =>
  language.is_active && isSupportedLocale(language.code);

export const getDisplayLanguageOptions = (
  contentLanguages?: ContentLanguage[],
): DisplayLanguageOption[] => {
  if (!contentLanguages?.length) {
    return DEFAULT_LANGUAGE_OPTIONS;
  }

  const displayLanguages = contentLanguages
    .filter(isActiveSupportedContentLanguage)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((language) => LANGUAGE_DISPLAY_BY_CODE[language.code]);

  return displayLanguages.length > 0 ? displayLanguages : DEFAULT_LANGUAGE_OPTIONS;
};

export const getLanguageSelectorOptions = (
  contentLanguages?: ContentLanguage[],
): DisplayLanguageOption[] =>
  getDisplayLanguageOptions(contentLanguages).map((language) => ({
    ...language,
    name: LANGUAGE_SELECTOR_NAME_BY_CODE[language.code] ?? language.name,
  }));
