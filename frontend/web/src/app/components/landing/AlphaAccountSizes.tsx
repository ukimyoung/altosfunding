import { ArrowRight, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { useOptionalMeQuery } from '@/app/queries/profile';
import { useListChallengeOffersQuery } from '@/app/queries/products';
import type { ChallengeOffer } from '@/api/products';
import type { AccountLabels } from '../../i18n/locales/landing/types';
import { useLocale } from '../../i18n/LocaleContext';
import { InfoTooltip } from '../shared/InfoTooltip';

type BadgeKey = null | 'mostPopular' | 'bestValue';

/** 카드 한 장에 보여줄 값. null은 '없음'(labels.none)으로 표시한다. */
type TierCard = {
  key: string;
  /** 상품명. 없으면 locale의 tierNames[index] */
  name?: string;
  size: string;
  /** 할인 중일 때만 원가격 (취소선) */
  originalFee: string | null;
  discountedFee: string;
  challengeStage: {
    profitTarget: string | null;
    maxDrawdown: string | null;
    dailyLossLimit: string | null;
    /** 룰셋 최소 거래일 */
    minTradingDays: string | null;
    consistency: string | null;
    tradingPeriod: string | null;
  };
  fundedStage: {
    profitTarget: string | null;
    maxDrawdown: string | null;
    dailyLossLimit: string | null;
    consistency: string | null;
  };
  popular: boolean;
  badgeKey: BadgeKey;
};

const formatMoney = (amount: number) =>
  `$${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

// 10000 → $10K, 그 외 → $12,500
const formatCapital = (capital: number) =>
  capital >= 1000 && capital % 1000 === 0
    ? `$${(capital / 1000).toLocaleString('en-US')}K`
    : formatMoney(capital);

// 0이거나 없으면 '없음'
const moneyOrNull = (amount: number | null | undefined) => (amount ? formatMoney(amount) : null);

const formatPct = (pct: number | null | undefined) =>
  pct ? `${pct.toLocaleString('en-US', { maximumFractionDigits: 2 })}%` : null;

/** Core GET /challenges/products 상품 → 랜딩 카드. MOST POPULAR 뱃지는 상품의 is_most_popular. */
const offerToTier = (offer: ChallengeOffer, labels: AccountLabels): TierCard => {
  const rules = offer.rules;
  const fundedRules = offer.funded?.rules;
  const discounted =
    offer.discount_price_usdt != null && offer.discount_price_usdt < offer.price_usdt;

  return {
    key: offer.product_id,
    name: offer.name,
    size: formatCapital(offer.capital),
    originalFee: discounted ? formatMoney(offer.price_usdt) : null,
    discountedFee: formatMoney(offer.final_price_usdt),
    challengeStage: {
      profitTarget: moneyOrNull(rules?.profit_target_amt),
      maxDrawdown: moneyOrNull(rules?.max_drawdown_amt),
      dailyLossLimit: moneyOrNull(rules?.daily_loss_limit_amt),
      // 룰셋 최소 거래일. 0이거나 없으면 '없음'
      minTradingDays: rules?.min_trading_days
        ? labels.daysFormat.replace('{n}', String(rules.min_trading_days))
        : null,
      consistency: formatPct(rules?.consistency_pct),
      tradingPeriod: offer.duration_days
        ? labels.daysFormat.replace('{n}', String(offer.duration_days))
        : null,
    },
    fundedStage: {
      profitTarget: moneyOrNull(fundedRules?.profit_target_amt),
      maxDrawdown: moneyOrNull(fundedRules?.max_drawdown_amt),
      dailyLossLimit: moneyOrNull(fundedRules?.daily_loss_limit_amt),
      consistency: formatPct(fundedRules?.consistency_pct),
    },
    popular: offer.is_most_popular,
    badgeKey: offer.is_most_popular ? 'mostPopular' : null,
  };
};

// 상품 API를 쓸 수 없을 때(기존 서버 연결 등) 보여주는 고정 카드
// Static tier data — only values that don't change with locale
const TIERS: TierCard[] = [
  {
    key: 'static-0',
    size: '$10K',
    originalFee: '$80',
    discountedFee: '$48',
    challengeStage: {
      profitTarget: '$600',
      maxDrawdown: '$500',
      dailyLossLimit: null,   // null = use labels.none
      minTradingDays: null,
      consistency: '40%',
      tradingPeriod: '5 Days',
    },
    fundedStage: {
      profitTarget: null,
      maxDrawdown: '$500',
      dailyLossLimit: '$200',
      consistency: null,
    },
    popular: false,
    badgeKey: null,
  },
  {
    key: 'static-1',
    size: '$25K',
    originalFee: '$131',
    discountedFee: '$79',
    challengeStage: {
      profitTarget: '$1,500',
      maxDrawdown: '$1,000',
      dailyLossLimit: null,
      minTradingDays: null,
      consistency: '40%',
      tradingPeriod: '5 Days',
    },
    fundedStage: {
      profitTarget: null,
      maxDrawdown: '$1,000',
      dailyLossLimit: '$500',
      consistency: null,
    },
    popular: false,
    badgeKey: null,
  },
  {
    key: 'static-2',
    size: '$50K',
    originalFee: '$188',
    discountedFee: '$113',
    challengeStage: {
      profitTarget: '$3,000',
      maxDrawdown: '$2,000',
      dailyLossLimit: null,
      minTradingDays: null,
      consistency: '40%',
      tradingPeriod: '5 Days',
    },
    fundedStage: {
      profitTarget: null,
      maxDrawdown: '$2,000',
      dailyLossLimit: '$1,000',
      consistency: null,
    },
    popular: true,
    badgeKey: 'mostPopular',
  },
  {
    key: 'static-3',
    size: '$100K',
    originalFee: '$320',
    discountedFee: '$192',
    challengeStage: {
      profitTarget: '$6,000',
      maxDrawdown: '$3,500',
      dailyLossLimit: null,
      minTradingDays: null,
      consistency: '40%',
      tradingPeriod: '5 Days',
    },
    fundedStage: {
      profitTarget: null,
      maxDrawdown: '$3,500',
      dailyLossLimit: '$2,000',
      consistency: null,
    },
    popular: false,
    badgeKey: 'bestValue',
  },
];

export function AlphaAccountSizes() {
  const { T } = useLocale();
  const section = T.accounts;
  const L = section.labels;
  const TT = L.tooltips;
  const { data: me } = useOptionalMeQuery();
  const startChallengePath = me ? '/my-page/start-new-challenge' : '/login';
  const { data: offers, isLoading: isOffersLoading } = useListChallengeOffersQuery();
  // 판매 중인 챌린지 상품이 있으면 그 값으로, 불러오는 중이면 비워 두고, 없거나 실패하면 고정 카드
  const tiers: TierCard[] = offers?.items?.length
    ? offers.items.map((offer) => offerToTier(offer, L))
    : isOffersLoading
      ? []
      : TIERS;

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
          {tiers.map((tier, index) => {
            const tierName = tier.name ?? section.tierNames[index];
            const badgeLabel = tier.badgeKey ? L[tier.badgeKey] : null;

            return (
              <motion.div
                key={tier.key}
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
                          {tier.originalFee && (
                            <span className="text-base font-semibold text-gray-400 line-through">{tier.originalFee}</span>
                          )}
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
                          <span className="text-white text-sm font-bold text-right">{tier.challengeStage.profitTarget ?? L.none}</span>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <span className="inline-flex items-center gap-1.5 text-gray-400 text-sm shrink-0">
                            <InfoTooltip content={TT.maxDrawdownEod} />
                            {L.maxDrawdownEod}
                          </span>
                          <span className="text-white text-sm font-bold text-right">{tier.challengeStage.maxDrawdown ?? L.none}</span>
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
                            <InfoTooltip content={TT.minTradingDays} />
                            {L.minTradingDays}
                          </span>
                          <span className="text-white text-sm font-bold text-right">{tier.challengeStage.minTradingDays ?? L.none}</span>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <span className="inline-flex items-center gap-1.5 text-gray-400 text-sm shrink-0">
                            <InfoTooltip content={TT.consistency} />
                            {L.consistency}
                          </span>
                          <span className="text-white text-sm font-bold text-right">{tier.challengeStage.consistency ?? L.none}</span>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <span className="inline-flex items-center gap-1.5 text-gray-400 text-sm shrink-0">
                            <InfoTooltip content={TT.tradingPeriod} />
                            {L.tradingPeriod}
                          </span>
                          <span className="text-white text-sm font-bold text-right">{tier.challengeStage.tradingPeriod ?? L.none}</span>
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
                          <span className="text-white text-sm font-bold text-right">{tier.fundedStage.maxDrawdown ?? L.none}</span>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <span className="inline-flex items-center gap-1.5 text-gray-400 text-sm shrink-0">
                            <InfoTooltip content={TT.dailyLossLimit} />
                            {L.dailyLossLimit}
                          </span>
                          <span className="text-white text-sm font-bold text-right">{tier.fundedStage.dailyLossLimit ?? L.none}</span>
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
