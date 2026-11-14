import { UserPlus, Target, ShieldCheck, TrendingUp, ChevronRight, ChevronDown } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { useOptionalMeQuery } from '@/app/queries/profile';
import { useLocale } from '../../i18n/LocaleContext';

const STEP_ICONS = [UserPlus, Target, ShieldCheck, TrendingUp];
const STEP_NUMBERS = ['01', '02', '03', '04'];

export function AlphaHowItWorks() {
  const { T } = useLocale();
  const text = T.howItWorks;
  const { data: me } = useOptionalMeQuery();
  const startChallengePath = me ? '/my-page/start-new-challenge' : '/login';

  return (
    <section
      id="how-it-works"
      className="py-32 bg-gradient-to-b from-[#0a0a0f] to-[#12121a] relative overflow-hidden"
    >
      {/* Background accent */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#0052FF] rounded-full blur-[150px]"></div>
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-5xl mb-4 text-white">{text.title}</h2>
          <p className="text-xl text-gray-400">{text.subtitle}</p>
        </motion.div>

        {/* Horizontal Infographic */}
        <div className="relative">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-4">
            {text.steps.map((step, index) => {
              const Icon = STEP_ICONS[index];

              return (
                <div key={index}>
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="relative"
                  >
                    <div className="bg-gradient-to-br from-[#1a1a24] to-[#12121a] p-8 rounded-2xl border border-[#2a2a3a] hover:border-[#0052FF]/50 transition-all group">
                      {/* Step number badge */}
                      <div className="absolute -top-4 -right-4 w-12 h-12 bg-gradient-to-br from-[#0052FF] to-[#00FF94] rounded-full flex items-center justify-center shadow-lg shadow-[#0052FF]/50 flex-shrink-0">
                        <span className="text-white text-sm font-bold">{STEP_NUMBERS[index]}</span>
                      </div>

                      {/* Icon */}
                      <div className="w-16 h-16 bg-gradient-to-br from-[#0052FF]/20 to-[#00FF94]/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform flex-shrink-0">
                        <Icon className="w-8 h-8 text-[#0052FF] flex-shrink-0" />
                      </div>

                      {/* Content */}
                      <h3 className="text-2xl mb-3 text-white">{step.title}</h3>
                      <p className="text-gray-400 leading-relaxed">{step.description}</p>

                      {/* Connector arrow for desktop - horizontal right arrow */}
                      {index < text.steps.length - 1 && (
                        <div
                          className="hidden lg:flex absolute top-1/2 -translate-y-1/2 -right-6 items-center justify-center flex-shrink-0"
                          style={{ width: '32px', height: '32px' }}
                        >
                          <ChevronRight
                            className="text-[#0052FF] flex-shrink-0"
                            size={32}
                            strokeWidth={3}
                          />
                        </div>
                      )}
                    </div>
                  </motion.div>

                  {/* Connector arrow for mobile/tablet - vertical down arrow between cards */}
                  {index < text.steps.length - 1 && (
                    <div
                      className="lg:hidden flex justify-center items-center py-4 flex-shrink-0"
                      style={{ width: '100%', height: '32px' }}
                    >
                      <ChevronDown
                        className="text-[#0052FF] flex-shrink-0"
                        size={32}
                        strokeWidth={3}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="text-center mt-16"
        >
          <Link
            to={startChallengePath}
            className="inline-block px-8 py-4 bg-gradient-to-r from-[#0052FF] to-[#0066FF] text-white rounded-lg hover:shadow-lg hover:shadow-[#0052FF]/50 transition-all"
          >
            {text.cta}
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

