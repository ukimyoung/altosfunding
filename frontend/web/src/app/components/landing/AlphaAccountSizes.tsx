import { ArrowRight, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { useOptionalMeQuery } from '@/app/queries/profile';
import { useLocale } from '../../i18n/LocaleContext';

const accounts = [
  {
    size: '$25K',
    originalFee: '$150',
    discountedFee: '$68',
    challengeStage: {
      profitTarget: '$1,500',
      maxDrawdown: '$1,500',
      dailyLossLimit: null,
      maxContracts: '2 Mini (20 Micro)',
      consistency: '40%',
      tradingPeriod: '5 Days',
    },
    fundedStage: {
      profitTarget: null,
      maxDrawdown: '$1,500',
      dailyLossLimit: '$500',
      maxContracts: '2 Mini (20 Micro)',
      consistency: null,
    },
    popular: false,
    badgeKey: null as null | 'mostPopular' | 'bestValue',
  },
  {
    size: '$50K',
    originalFee: '$200',
    discountedFee: '$90',
    challengeStage: {
      profitTarget: '$3,000',
      maxDrawdown: '$2,000',
      dailyLossLimit: null,
      maxContracts: '4 Mini (40 Micro)',
      consistency: '40%',
      tradingPeriod: '5 Days',
    },
    fundedStage: {
      profitTarget: null,
      maxDrawdown: '$2,000',
      dailyLossLimit: '$1,000',
      maxContracts: '4 Mini (40 Micro)',
      consistency: null,
    },
    popular: true,
    badgeKey: 'mostPopular' as const,
  },
  {
    size: '$100K',
    originalFee: '$270',
    discountedFee: '$122',
    challengeStage: {
      profitTarget: '$6,000',
      maxDrawdown: '$3,500',
      dailyLossLimit: null,
      maxContracts: '6 Mini (60 Micro)',
      consistency: '40%',
      tradingPeriod: '5 Days',
    },
    fundedStage: {
      profitTarget: null,
      maxDrawdown: '$3,500',
      dailyLossLimit: '$2,000',
      maxContracts: '6 Mini (60 Micro)',
      consistency: null,
    },
    popular: false,
    badgeKey: 'bestValue' as const,
  },
];

export function AlphaAccountSizes() {
  const { T } = useLocale();
  const text = T.accounts;
  const labels = text.labels;
  const { data: me } = useOptionalMeQuery();
  const startChallengePath = me ? '/my-page/start-new-challenge' : '/login';

  return (
    <section
      id="pricing"
      className="py-32 bg-gradient-to-b from-[#12121a] to-[#0a0a0f] relative overflow-hidden"
    >
      {/* Background accent circles */}
      <div className="absolute top-20 right-20 w-96 h-96 bg-[#0052FF]/10 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-20 left-20 w-96 h-96 bg-[#00FF94]/10 rounded-full blur-[120px]"></div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <h2 className="text-5xl mb-6 text-white">{text.title}</h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">{text.subtitle}</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {accounts.map((account, index) => {
            const badgeLabel = account.badgeKey ? labels[account.badgeKey] : null;

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={`relative group ${account.popular ? 'md:scale-105' : ''}`}
              >
                {/* Badge */}
                {badgeLabel && (
                  <div
                    className={`absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 text-xs rounded-full z-10 flex items-center gap-1 whitespace-nowrap ${
                      account.popular
                        ? 'bg-gradient-to-r from-[#0052FF] to-[#00FF94] text-white'
                        : 'bg-[#00FF94] text-[#0a0a0f]'
                    }`}
                  >
                    {account.popular && <Sparkles className="w-3 h-3 shrink-0" />}
                    {badgeLabel}
                  </div>
                )}

                <div
                  className={`h-full bg-gradient-to-br from-[#1a1a24] to-[#12121a] p-8 rounded-2xl border-2 transition-all ${
                    account.popular
                      ? 'border-[#0052FF] shadow-xl shadow-[#0052FF]/20'
                      : 'border-[#2a2a3a] hover:border-[#0052FF]/50'
                  }`}
                >
                  {/* Account size header */}
                  <div className="text-center mb-8 pb-8 border-b border-[#2a2a3a]">
                    <div className="text-sm text-gray-400 mb-2">{text.tierNames[index]}</div>
                    <div className="text-6xl mb-4 text-transparent bg-clip-text bg-gradient-to-r from-[#0052FF] to-[#00FF94]">
                      {account.size}
                    </div>
                    <div className="text-gray-400">{labels.fundingCapital}</div>
                  </div>

                  {/* One-time fee */}
                  <div className="text-center mb-8">
                    <div className="flex items-baseline justify-center gap-2.5 mb-2">
                      <span className="text-sm text-gray-500 line-through">
                        {account.originalFee}
                      </span>
                      <span className="text-4xl text-white">{account.discountedFee}</span>
                    </div>
                    <div className="text-sm text-gray-400">{labels.oneTimeFee}</div>
                  </div>

                  {/* Trading Rules - Two Stage Layout */}
                  <div className="mb-8 space-y-6">
                    {/* Challenge Stage */}
                    <div>
                      <h3 className="text-white text-base font-bold mb-4">{labels.challengeStage}</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-gray-400 text-sm shrink-0">{labels.profitTarget}</span>
                          <span className="text-white text-sm font-bold">{account.challengeStage.profitTarget}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-gray-400 text-sm shrink-0">{labels.maxDrawdownEod}</span>
                          <span className="text-white text-sm font-bold">{account.challengeStage.maxDrawdown}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-gray-400 text-sm shrink-0">{labels.dailyLossLimit}</span>
                          <span className="text-white text-sm font-bold">
                            {account.challengeStage.dailyLossLimit ?? labels.none}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-gray-400 text-sm shrink-0">{labels.maxContracts}</span>
                          <span className="text-white text-sm font-bold">{account.challengeStage.maxContracts}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-gray-400 text-sm shrink-0">{labels.consistency}</span>
                          <span className="text-white text-sm font-bold">{account.challengeStage.consistency}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-gray-400 text-sm shrink-0">{labels.tradingPeriod}</span>
                          <span className="text-white text-sm font-bold">{account.challengeStage.tradingPeriod}</span>
                        </div>
                      </div>
                    </div>

                    {/* Funded Stage */}
                    <div>
                      <h3 className="text-white text-base font-bold mb-4">{labels.fundedStage}</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-gray-400 text-sm shrink-0">{labels.profitTarget}</span>
                          <span className="text-white text-sm font-bold">
                            {account.fundedStage.profitTarget ?? labels.none}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-gray-400 text-sm shrink-0">{labels.maxDrawdownEod}</span>
                          <span className="text-white text-sm font-bold">{account.fundedStage.maxDrawdown}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-gray-400 text-sm shrink-0">{labels.dailyLossLimit}</span>
                          <span className="text-white text-sm font-bold">{account.fundedStage.dailyLossLimit}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-gray-400 text-sm shrink-0">{labels.maxContracts}</span>
                          <span className="text-white text-sm font-bold">{account.fundedStage.maxContracts}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-gray-400 text-sm shrink-0">{labels.consistency}</span>
                          <span className="text-white text-sm font-bold">
                            {account.fundedStage.consistency ?? labels.none}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CTA Button */}
                  <Link
                    to={startChallengePath}
                    className={`w-full py-4 rounded-lg flex items-center justify-center gap-2 transition-all group/btn ${
                      account.popular
                        ? 'bg-gradient-to-r from-[#0052FF] to-[#00FF94] text-white hover:shadow-lg hover:shadow-[#0052FF]/50'
                        : 'bg-[#1a1a24] text-white border border-[#2a2a3a] hover:border-[#0052FF] hover:bg-[#0052FF]/10'
                    }`}
                  >
                    {labels.getStarted}
                    <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

