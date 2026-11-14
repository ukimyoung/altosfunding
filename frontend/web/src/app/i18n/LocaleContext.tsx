import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { type Locale, type Translations, translations } from './translations';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  T: Translations;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: 'en',
  setLocale: () => {},
  T: translations.en,
});

const LOCALE_STORAGE_KEY = 'altos.locale';
const URL_CHANGE_EVENT = 'altos:urlchange';

let isHistoryPatched = false;

function isLocale(value: string | null): value is Locale {
  return value === 'en' || value === 'ko';
}

function syncLocaleToUrl(locale: Locale) {
  try {
    const url = new URL(window.location.href);
    const before = url.toString();

    if (locale === 'en') {
      url.searchParams.delete('lang');
    } else {
      url.searchParams.set('lang', locale);
    }

    if (url.toString() === before) {
      return;
    }

    window.history.replaceState({}, '', url.toString());
  } catch {}
}

function patchHistoryForUrlChangeEvent() {
  if (isHistoryPatched) {
    return;
  }

  try {
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function pushState(...args) {
      const result = originalPushState.apply(this, args);
      window.dispatchEvent(new Event(URL_CHANGE_EVENT));
      return result;
    };

    window.history.replaceState = function replaceState(...args) {
      const result = originalReplaceState.apply(this, args);
      window.dispatchEvent(new Event(URL_CHANGE_EVENT));
      return result;
    };

    isHistoryPatched = true;
  } catch {}
}

function getInitialLocale(): Locale {
  try {
    const params = new URLSearchParams(window.location.search);
    const lang = params.get('lang');
    if (isLocale(lang)) return lang;

    const savedLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(savedLocale)) return savedLocale;
  } catch {}

  return 'en';
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, l);
      syncLocaleToUrl(l);
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
      syncLocaleToUrl(locale);
    } catch {}
  }, [locale]);

  useEffect(() => {
    patchHistoryForUrlChangeEvent();

    const handleUrlChange = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const lang = params.get('lang');

        if (isLocale(lang) && lang !== locale) {
          setLocaleState(lang);
          localStorage.setItem(LOCALE_STORAGE_KEY, lang);
          return;
        }

        syncLocaleToUrl(locale);
      } catch {}
    };

    window.addEventListener(URL_CHANGE_EVENT, handleUrlChange);
    window.addEventListener('popstate', handleUrlChange);

    return () => {
      window.removeEventListener(URL_CHANGE_EVENT, handleUrlChange);
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, [locale]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, T: translations[locale] }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
