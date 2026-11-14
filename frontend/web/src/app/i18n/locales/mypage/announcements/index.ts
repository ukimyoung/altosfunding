import type { AnnouncementsTranslations } from './types';
import { announcementsEn } from './en';
import { announcementsKo } from './ko';

export type * from './types';

// 새 언어 추가 시 {locale}.ts를 만들고, 여기 import와 record 항목을 함께 추가한다.
export const announcementsTranslations: Record<'en' | 'ko', AnnouncementsTranslations> = {
  en: announcementsEn,
  ko: announcementsKo,
};
