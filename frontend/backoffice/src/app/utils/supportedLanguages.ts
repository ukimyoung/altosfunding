import type { AdminLanguage } from '@/api/languages';
import { ISO_LANGUAGE_CATALOG } from '../constants/languages';
import type { SupportedLanguage } from '../types/language';

export const toSupportedLanguage = (language: AdminLanguage): SupportedLanguage => {
  const catalogLanguage = ISO_LANGUAGE_CATALOG.find((entry) => entry.code === language.code);

  return {
    code: language.code,
    flag: catalogLanguage?.flag ?? '??',
    label: language.name_native,
    englishName: language.name_en,
    required: language.is_default,
  };
};

export const toSupportedLanguages = (languages: AdminLanguage[]): SupportedLanguage[] =>
  [...languages]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((language) => toSupportedLanguage(language));
