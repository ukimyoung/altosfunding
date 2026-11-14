import { ArrowRight, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { useOptionalMeQuery } from '@/app/queries/profile';
import { useLocale } from '../../i18n/LocaleContext';
import { InfoTooltip } from '../shared/InfoTooltip';

// Static tier data — only values that don't change with locale
const TIERS = [
  {
    size: '$10K',
    originalFee: '$80',
    discountedFee: '$48',
    challengeStage: {
      profitTarget: '$600',
      maxDrawdown: '$500',
      dailyLossLimit: null,   // null = use labels.none
      maxContracts: '1 Mini (10 Micro)',
      consistency: '40%',
      tradingPeriod: '5 Days',
    },
    fundedStage: {
      profitTarget: null,
      maxDrawdown: '$500',
      dailyLossLimit: '$200',
      maxContracts: '2 Mini (20 Micro)',
      consistency: null,
    },
    popular: false,
    badgeKey: null as null | 'mostPopular' | 'bestValue',
  },
  {
    size: '$25K',
    originalFee: '$131',
    discountedFee: '$79',
    challengeStage: {
      profitTarget: '$1,500',
      maxDrawdown: '$1,000',
      dailyLossLimit: null,
      maxContracts: '2 Mini (20 Micro)',
      consistency: '40%',
      tradingPeriod: '5 Days',
    },
    fundedStage: {
      profitTarget: null,
      maxDrawdown: '$1,000',
      dailyLossLimit: '$500',
      maxContracts: '2 Mini (20 Micro)',
      consistency: null,
    },
    popular: false,
    badgeKey: null as null | 'mostPopular' | 'bestValue',
  },
  {
    size: '$50K',
    originalFee: '$188',
    discountedFee: '$113',
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
    originalFee: '$320',
    discountedFee: '$192',
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
  const section = T.accounts;
  const L = section.labels;
  const TT = L.tooltips;
  const { data: me } = useOptionalMeQuery();
  const startChallengePath = me ? '/my-page/start-new-challenge' : '/login';

  return (
    <section
      id="pricing"
      className="py-32 bg-gradient-to-b from-[#12121a] to-[#0a0a0f] relative overflow-hidden">
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
          <h2 className="text-5xl mb-6 text-white">
            {section.title}
          </h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            {section.subtitle}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-8">
          {TIERS.map((tier, index) => {
            const tierName = section.tierNames[index];
            const badgeLabel = tier.badgeKey ? L[tier.badgeKey] : null;

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={`relative group ${tier.popular ? 'md:scale-105' : ''}`}
              >
                {/* Badge */}
                {badgeLabel && (
                  <div className={`absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 text-xs rounded-full z-10 flex items-center gap-1 whitespace-nowrap ${
                    tier.popular
                      ? 'bg-gradient-to-r from-[#0052FF] to-[#00FF94] text-white'
                      : 'bg-[#00FF94] text-[#0a0a0f]'
                  }`}>
                    {tier.popular && <Sparkles className="w-3 h-3 shrink-0" />}
                    {badgeLabel}
                  </div>
                )}

                <div className={`h-full bg-gradient-to-br from-[#1a1a24] to-[#12121a] p-5 rounded-2xl border-2 transition-all ${
                  tier.popular
                    ? 'border-[#0052FF] shadow-xl shadow-[#0052FF]/20'
                    : 'border-[#2a2a3a] hover:border-[#0052FF]/50'
                }`}>
                  {/* Compact header — tier name + two-column capital / fee */}
                  <div className="mb-4 pb-4 border-b border-[#2a2a3a]">
                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">{tierName}</div>
                    <div className="flex items-end justify-between gap-2">
                      {/* Funding capital */}
                      <div>
                        <div className="text-3xl font-bold leading-tight text-transparent bg-clip-text bg-gradient-to-r from-[#0052FF] to-[#00FF94]">
                          {tier.size}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">{L.fundingCapital}</div>
                      </div>
                      {/* One-time fee */}
                      <div className="text-right">
                        <div className="flex items-baseline justify-end gap-1.5">
                          <span className="text-xs text-gray-500 line-through">{tier.originalFee}</span>
                          <span className="text-2xl font-bold text-white leading-tight">{tier.discountedFee}</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">{L.oneTimeFee}</div>
                      </div>
                    </div>
                  </div>

                  {/* Trading Rules */}
                  <div className="mb-5 space-y-4">
                    {/* Challenge Stage */}
                    <div>
                      <h3 className="text-white text-sm font-bold mb-3">{L.challengeStage}</h3>
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <span className="inline-flex items-center gap-1.5 text-gray-400 text-sm shrink-0">
                            <InfoTooltip content={TT.profitTarget} />
                            {L.profitTarget}
                          </span>
                          <span className="text-white text-sm font-bold text-right">{tier.challengeStage.profitTarget}</span>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <span className="inline-flex items-center gap-1.5 text-gray-400 text-sm shrink-0">
                            <InfoTooltip content={TT.maxDrawdownEod} />
                            {L.maxDrawdownEod}
                          </span>
                          <span className="text-white text-sm font-bold text-right">{tier.challengeStage.maxDrawdown}</span>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <span className="inline-flex items-center gap-1.5 text-gray-400 text-sm shrink-0">
                            <InfoTooltip content={TT.dailyLossLimit} />
                            {L.dailyLossLimit}
                          </span>
                          <span className="text-white text-sm font-bold text-right">
                            {tier.challengeStage.dailyLossLimit ?? L.none}
                          </span>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <span className="inline-flex items-center gap-1.5 text-gray-400 text-sm shrink-0">
                            <InfoTooltip content={TT.maxContracts} />
                            {L.maxContracts}
                          </span>
                          <span className="text-white text-sm font-bold text-right">{tier.challengeStage.maxContracts}</span>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <span className="inline-flex items-center gap-1.5 text-gray-400 text-sm shrink-0">
                            <InfoTooltip content={TT.consistency} />
                            {L.consistency}
                          </span>
                          <span className="text-white text-sm font-bold text-right">{tier.challengeStage.consistency}</span>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <span className="inline-flex items-center gap-1.5 text-gray-400 text-sm shrink-0">
                            <InfoTooltip content={TT.tradingPeriod} />
                            {L.tradingPeriod}
                          </span>
                          <span className="text-white text-sm font-bold text-right">{tier.challengeStage.tradingPeriod}</span>
                        </div>
                      </div>
                    </div>

                    {/* Funded Stage */}
                    <div>
                      <h3 className="text-white text-sm font-bold mb-3">{L.fundedStage}</h3>
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <span className="inline-flex items-center gap-1.5 text-gray-400 text-sm shrink-0">
                            <InfoTooltip content={TT.profitTarget} />
                            {L.profitTarget}
                          </span>
                          <span className="text-white text-sm font-bold text-right">
                            {tier.fundedStage.profitTarget ?? L.none}
                          </span>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <span className="inline-flex items-center gap-1.5 text-gray-400 text-sm shrink-0">
                            <InfoTooltip content={TT.maxDrawdownEod} />
                            {L.maxDrawdownEod}
                          </span>
                          <span className="text-white text-sm font-bold text-right">{tier.fundedStage.maxDrawdown}</span>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <span className="inline-flex items-center gap-1.5 text-gray-400 text-sm shrink-0">
                            <InfoTooltip content={TT.dailyLossLimit} />
                            {L.dailyLossLimit}
                          </span>
                          <span className="text-white text-sm font-bold text-right">{tier.fundedStage.dailyLossLimit}</span>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <span className="inline-flex items-center gap-1.5 text-gray-400 text-sm shrink-0">
                            <InfoTooltip content={TT.maxContracts} />
                            {L.maxContracts}
                          </span>
                          <span className="text-white text-sm font-bold text-right">{tier.fundedStage.maxContracts}</span>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <span className="inline-flex items-center gap-1.5 text-gray-400 text-sm shrink-0">
                            <InfoTooltip content={TT.consistency} />
                            {L.consistency}
                          </span>
                          <span className="text-white text-sm font-bold text-right">
                            {tier.fundedStage.consistency ?? L.none}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CTA Button */}
                  <Link
                    to={startChallengePath}
                    className={`w-full py-4 rounded-lg flex items-center justify-center gap-2 transition-all group/btn ${
                    tier.popular
                      ? 'bg-gradient-to-r from-[#0052FF] to-[#00FF94] text-white hover:shadow-lg hover:shadow-[#0052FF]/50'
                      : 'bg-[#1a1a24] text-white border border-[#2a2a3a] hover:border-[#0052FF] hover:bg-[#0052FF]/10'
                  }`}>
                    {L.getStarted}
                    <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform shrink-0" />
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
