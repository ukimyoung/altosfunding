export interface SupportedLanguage {
  code: string;
  flag: string;
  label: string;
  englishName?: string;
  required?: boolean;
}

export interface IsoLanguageEntry {
  code: string;
  flag: string;
  englishName: string;
  nativeName: string;
  koreanName?: string;
}

export const DEFAULT_LANGUAGES: SupportedLanguage[] = [
  { code: "en", flag: "🇺🇸", label: "English", englishName: "English", required: true },
  { code: "ko", flag: "🇰🇷", label: "한국어", englishName: "Korean", required: false },
];
