import { ArrowRight, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { useOptionalMeQuery } from '@/app/queries/profile';
import { useLocale } from '../../i18n/LocaleContext';
import { ImageWithFallback } from '../shared/figma/ImageWithFallback';
import backgroundImg from '../../assets/Backgroundimg.png';

export function AlphaHero() {
  const { locale, T } = useLocale();
  const text = T.hero;
  const { data: me } = useOptionalMeQuery();
  const startChallengePath = me ? '/my-page/start-new-challenge' : '/login';

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#0a0a0f]">
      {/* Futuristic Trading Floor Background */}
      <div className="absolute inset-0">
        <ImageWithFallback
          src={backgroundImg}
          alt="Professional automated trading floor with robot trader and advanced monitoring systems"
          className="w-full h-full object-cover"
        />
        {/* Dark overlay for text legibility */}
        <div className="absolute inset-0 bg-black/70"></div>
        {/* Gradient overlay for depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-black/50 to-transparent"></div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-24 text-center">
        {/* Tagline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#0052FF]/10 border border-[#0052FF]/30 rounded-full mb-8 backdrop-blur-sm"
        >
          <TrendingUp className="w-4 h-4 text-[#00FF94]" />
          <span className="text-[#00FF94] text-sm font-semibold tracking-wide">
            {text.tagline}
          </span>
        </motion.div>

        {/* Main Title - Industrial Sans-Serif, Massive & Bold */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl mb-6 text-white leading-[1.05] mx-auto max-w-5xl tracking-tight"
          style={{
            fontWeight: 900,
            fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
          }}
        >
          {locale === 'ko' ? (
            <>
              <span className="block lg:inline">{text.titlePart1}</span>{' '}
              <span className="block lg:inline whitespace-nowrap text-transparent bg-clip-text bg-gradient-to-r from-[#0052FF] to-[#00FF94]">
                {text.titlePart2}
              </span>
            </>
          ) : (
            <>
              {text.titlePart1}{' '}
              <span className="whitespace-nowrap text-transparent bg-clip-text bg-gradient-to-r from-[#0052FF] to-[#00FF94]">
                {text.titlePart2}
              </span>
            </>
          )}
        </motion.h1>

        {/* Subtitle - Professional & Clear */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-xl sm:text-2xl lg:text-3xl text-gray-200 mb-12 max-w-4xl mx-auto leading-relaxed font-medium"
        >
          {text.subtitle}
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16"
        >
          <Link
            to={startChallengePath}
            className="group px-10 py-5 bg-gradient-to-r from-[#0052FF] to-[#0066FF] text-white rounded-lg hover:shadow-lg hover:shadow-[#0052FF]/50 transition-all flex items-center justify-center gap-2 relative overflow-hidden text-lg font-semibold"
          >
            <span className="relative z-10 flex items-center gap-2">
              {text.cta1}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-[#0066FF] to-[#0052FF] opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </Link>
          <Link
            to="/help-center/challenge-rules"
            className="px-10 py-5 bg-white/10 backdrop-blur-md text-white rounded-lg hover:bg-white/20 transition-all border border-white/20 text-lg font-semibold"
          >
            {text.cta2}
          </Link>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-12 max-w-3xl mx-auto pt-12 border-t border-white/10"
        >
          <div>
            <div className="text-4xl sm:text-5xl text-[#00FF94] mb-2 font-bold">$100K</div>
            <div className="text-base text-gray-300 font-medium">{text.statCapitalLabel}</div>
          </div>
          <div>
            <div className="text-4xl sm:text-5xl text-[#00FF94] mb-2 font-bold">80%</div>
            <div className="text-base text-gray-300 font-medium">{text.statSplitLabel}</div>
          </div>
          <div>
            <div className="text-4xl sm:text-5xl text-[#00FF94] mb-2 font-bold">24H</div>
            <div className="text-base text-gray-300 font-medium">{text.statPayoutLabel}</div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

