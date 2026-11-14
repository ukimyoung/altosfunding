import { useMemo, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLocale } from '../../i18n/LocaleContext';
import { useContentLanguagesQuery } from '@/app/queries/support';
import {
  DEFAULT_LANGUAGE_OPTIONS,
  getLanguageSelectorOptions,
  type DisplayLanguageOption,
} from '@/app/i18n/languageOptions';

export function LanguageSelector() {
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const { data: contentLanguages } = useContentLanguagesQuery();
  const displayLanguages = useMemo(
    () => getLanguageSelectorOptions(contentLanguages),
    [contentLanguages],
  );

  const current = displayLanguages.find((l) => l.code === locale) ?? DEFAULT_LANGUAGE_OPTIONS[0];

  const handleSelect = (lang: DisplayLanguageOption) => {
    setLocale(lang.code);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#1a1a24] transition-colors border border-[#2a2a3a]"
      >
        <span className="text-base leading-none text-gray-100">{current.flag}</span>
        <span className="text-white text-sm font-bold uppercase tracking-wide">
          {current.displayCode}
        </span>
        <ChevronDown
          size={14}
          className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-48 bg-[#12121e] border border-[#2a2a3a] rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50"
          >
            {displayLanguages.map((lang) => {
              const isActive = locale === lang.code;
              return (
                <button
                  key={lang.displayCode}
                  type="button"
                  onMouseDown={() => handleSelect(lang)}
                  className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                    isActive
                      ? 'bg-[#0052FF]/10 text-white'
                      : 'text-gray-300 hover:bg-[#1a1a28] hover:text-white'
                  }`}
                >
                  <span className="text-base leading-none text-gray-100">{lang.flag}</span>
                  <span className="text-sm flex-1 text-left">{lang.name}</span>
                  {isActive && <Check size={13} className="text-[#00FF94] shrink-0" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
