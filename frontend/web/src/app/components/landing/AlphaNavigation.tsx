import { Check, ChevronDown, Menu, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useLocation } from 'react-router';
import { useLocale } from '../../i18n/LocaleContext';
import { AppBrand } from '../shared/AppBrand';
import { useOptionalMeQuery } from '@/app/queries/profile';
import { useContentLanguagesQuery } from '@/app/queries/support';
import {
  DEFAULT_LANGUAGE_OPTIONS,
  getDisplayLanguageOptions,
  type DisplayLanguageOption,
} from '@/app/i18n/languageOptions';

const getUserDisplayName = (me: { first_name?: string; last_name?: string; email?: string }) =>
  [me.first_name, me.last_name].filter(Boolean).join(' ') || me.email || '';

export function AlphaNavigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const location = useLocation();
  const { locale, setLocale, T } = useLocale();
  const { data: me } = useOptionalMeQuery();
  const { data: contentLanguages } = useContentLanguagesQuery();
  const displayLanguages = useMemo(
    () => getDisplayLanguageOptions(contentLanguages),
    [contentLanguages],
  );
  const userDisplayName = me ? getUserDisplayName(me) : '';
  const currentDisplay =
    displayLanguages.find((language) => language.code === locale) ?? DEFAULT_LANGUAGE_OPTIONS[0];
  const navItems = [
    { label: T.nav.home, to: '/' },
    { label: T.nav.howItWorks, to: '/#how-it-works' },
    { label: T.nav.pricing, to: '/#pricing' },
    { label: T.nav.testimonials, to: '/#testimonials' },
    { label: T.nav.faq, to: '/#faq' },
  ];

  const handleLangSelect = (language: DisplayLanguageOption) => {
    setLocale(language.code);
    setShowLanguageMenu(false);
  };

  const handleLogoClick = () => {
    setIsOpen(false);
    setShowLanguageMenu(false);

    if (location.pathname === '/') {
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      return;
    }

    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 0);
  };

  const handleNavClick = (to: string) => {
    setIsOpen(false);
    setShowLanguageMenu(false);

    if (location.pathname !== '/') {
      return;
    }

    if (to === '/') {
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      return;
    }

    const targetId = to.split('#')[1];

    if (!targetId) {
      return;
    }

    requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0f]/95 backdrop-blur-xl border-b border-[#2a2a3a]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" onClick={handleLogoClick} className="flex items-center gap-2">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="flex items-center gap-2"
            >
              <AppBrand />
            </motion.div>
          </Link>

          {/* Desktop Navigation */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="hidden md:flex items-center gap-8"
          >
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => handleNavClick(item.to)}
                className="text-gray-300 hover:text-[#00FF94] transition-colors text-base font-semibold"
              >
                {item.label}
              </Link>
            ))}
          </motion.div>

          {/* Desktop CTA & Language Switcher */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="hidden md:flex items-center gap-6"
          >
            {/* Language Switcher - Dropdown Menu */}
            <div className="relative">
              <button
                onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                onBlur={() => setTimeout(() => setShowLanguageMenu(false), 150)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#1a1a24] transition-colors border border-[#2a2a3a]"
              >
                <span className="w-6 h-4 flex items-center justify-center rounded text-base text-gray-100">
                  {currentDisplay.flag}
                </span>
                <span className="text-white text-sm font-bold uppercase tracking-wide">
                  {currentDisplay.displayCode}
                </span>
                <ChevronDown
                  size={14}
                  className={`text-gray-400 transition-transform ${
                    showLanguageMenu ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Language Dropdown Menu */}
              <AnimatePresence>
                {showLanguageMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-0 mt-2 w-48 bg-[#12121e] border border-[#2a2a3a] rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50"
                  >
                    {displayLanguages.map((lang) => {
                      const isActive = locale === lang.code;

                      return (
                        <button
                          key={lang.displayCode}
                          onMouseDown={() => handleLangSelect(lang)}
                          className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                            isActive
                              ? 'bg-[#0052FF]/10 text-white'
                              : 'text-gray-100 hover:bg-[#1a1a28] hover:text-white'
                          }`}
                        >
                          <span className="w-6 h-4 flex items-center justify-center rounded text-base text-gray-100">
                            {lang.flag}
                          </span>
                          <span className="text-sm flex-1 text-left">{lang.name}</span>
                          {isActive && <Check size={13} className="text-[#00FF94] shrink-0" />}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Login/User & Get Started Buttons */}
            <Link to={me ? '/my-page' : '/login'}>
              <button className="px-6 py-2 text-white hover:text-[#00FF94] transition-colors text-base font-semibold">
                {userDisplayName || T.nav.login}
              </button>
            </Link>
            <Link to="/signup">
              <button className="px-6 py-2.5 bg-gradient-to-r from-[#0052FF] to-[#00FF94] text-white rounded-lg hover:shadow-lg hover:shadow-[#0052FF]/50 transition-all text-base font-semibold">
                {T.nav.getStarted}
              </button>
            </Link>
          </motion.div>

          {/* Mobile menu button */}
          <button onClick={() => setIsOpen(!isOpen)} className="md:hidden text-white p-2">
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="md:hidden pb-6 space-y-4 border-t border-[#2a2a3a] pt-4"
          >
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="block text-gray-300 hover:text-[#00FF94] transition-colors py-2 text-base font-semibold"
                onClick={() => handleNavClick(item.to)}
              >
                {item.label}
              </Link>
            ))}

            {/* Mobile Language Switcher */}
            <div className="pt-2 pb-2">
              <p className="text-gray-400 text-sm mb-2">{T.nav.language}</p>
              <div className="flex items-center gap-2 flex-wrap">
                {displayLanguages.map((lang) => {
                  const isActive = locale === lang.code;

                  return (
                    <button
                      key={lang.displayCode}
                      onClick={() => handleLangSelect(lang)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all border ${
                        isActive
                          ? 'bg-[#0052FF]/10 border-[#0052FF]/40 text-white'
                          : 'bg-[#1a1a24] border-[#2a2a3a] text-gray-300 hover:bg-[#2a2a3a]'
                      }`}
                    >
                      <span className="text-base leading-none">{lang.flag}</span>
                      <span className="font-medium">{lang.displayCode}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 space-y-3">
              <Link to={me ? '/my-page' : '/login'} onClick={() => setIsOpen(false)}>
                <button className="w-full px-6 py-2 text-white border border-[#2a2a3a] rounded-lg hover:bg-[#1a1a24] transition-colors text-base font-semibold">
                  {userDisplayName || T.nav.login}
                </button>
              </Link>
              <Link to="/signup" onClick={() => setIsOpen(false)}>
                <button className="w-full px-6 py-2.5 bg-gradient-to-r from-[#0052FF] to-[#00FF94] text-white rounded-lg hover:shadow-lg hover:shadow-[#0052FF]/50 transition-all text-base font-semibold">
                  {T.nav.getStarted}
                </button>
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </nav>
  );
}
