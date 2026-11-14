import type { LandingTranslations } from './types';
import { landingEn } from './en';
import { landingKo } from './ko';

export type * from './types';

// 새 언어 추가 시 {locale}.ts를 만들고, 여기 import와 record 항목을 함께 추가한다.
export const landingTranslations: Record<'en' | 'ko', LandingTranslations> = {
  en: landingEn,
  ko: landingKo,
};
