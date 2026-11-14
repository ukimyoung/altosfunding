import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useReferralStatsQuery, useReferralsQuery } from '@/app/queries/rewards';
import { motion } from 'motion/react';
import {
  Users,
  CheckCircle,
  Clock,
  Copy,
  Check,
  Gift,
} from 'lucide-react';
import { copyToClipboard } from '../../utils/clipboard';
import { formatDateByBrowserTimeZone } from '@/app/utils/date';
import { applyScopedSearchParams } from '@/app/utils/url/queryParams';
import type { ReferralStatus } from '@/api/rewards';
import { useLocale } from '@/app/i18n/LocaleContext';

interface ReferralListItem {
  id: string;
  name: string;
  registerDate: string;
  totalChallengeCount: number;
  status: ReferralStatus;
}

const itemsPerPage = 20;
const REFERRAL_QUERY_KEYS = {
  page: 'page',
} as const;

const parsePage = (value: string | null) => {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
};

const formatCurrency = (value?: number) =>
  `$${(value ?? 0).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

const getInitials = (value: string) => {
  const initials = value
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return initials || '-';
};

const getHowItWorksParts = (body: string, highlight: string) => {
  const [prefix, suffix = ''] = body.split(highlight);
  return { prefix, suffix };
};

export function ReferralPage() {
  const { T } = useLocale();
  const text = T.referral;
  const [searchParams, setSearchParams] = useSearchParams();
  const [copiedInviteField, setCopiedInviteField] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(() =>
    parsePage(searchParams.get(REFERRAL_QUERY_KEYS.page)),
  );
  const { data: referralStats, isLoading: isLoadingReferralStats } = useReferralStatsQuery();
  const {
    data: referralsResponse,
    isLoading: isLoadingReferrals,
    isFetching: isFetchingReferrals,
  } = useReferralsQuery({
    page: currentPage,
    size: itemsPerPage,
  });

  const myReferralCode = referralStats?.referral_code ?? '';
  const referralLink = referralStats?.referral_link ?? '';
  const referrals: ReferralListItem[] = useMemo(
    () =>
      (referralsResponse?.items ?? []).map((referral) => ({
        id: referral.id,
        name: referral.name || referral.email || '-',
        registerDate: formatDateByBrowserTimeZone(referral.register_date) || '-',
        totalChallengeCount: referral.total_challenge_count ?? 0,
        status: referral.status,
      })),
    [referralsResponse?.items],
  );
  const totalPages = Math.max(1, referralsResponse?.pages ?? currentPage);
  const totalReferrals = referralsResponse?.total ?? referrals.length;
  const showingStart = totalReferrals === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const showingEnd = Math.min(currentPage * itemsPerPage, totalReferrals);
  const isReferralListLoading = isLoadingReferrals || isFetchingReferrals;
  const howItWorksParts = getHowItWorksParts(text.howItWorksBody, text.howItWorksRewardHighlight);
  const referralCountValues = {
    from: String(showingStart),
    to: String(showingEnd),
    total: String(totalReferrals),
  };

  const getStatusLabel = (status: ReferralStatus) => {
    switch (status) {
      case 'Active':
        return text.statusActive;
      default:
        return text.statusPending;
    }
  };

  const renderShowingReferrals = () =>
    text.showingReferrals.split(/(\{from\}|\{to\}|\{total\})/g).map((part, index) => {
      if (part === '{from}') {
        return (
          <span key={`${part}-${index}`} className="text-white font-medium">
            {referralCountValues.from}
          </span>
        );
      }

      if (part === '{to}') {
        return (
          <span key={`${part}-${index}`} className="text-white font-medium">
            {referralCountValues.to}
          </span>
        );
      }

      if (part === '{total}') {
        return (
          <span key={`${part}-${index}`} className="text-white font-medium">
            {referralCountValues.total}
          </span>
        );
      }

      return part;
    });

  useEffect(() => {
    const pageFromUrl = parsePage(searchParams.get(REFERRAL_QUERY_KEYS.page));

    setCurrentPage((prev) => (prev === pageFromUrl ? prev : pageFromUrl));
  }, [searchParams]);

  const updateReferralPage = (page: number) => {
    setCurrentPage(page);
    setSearchParams(
      applyScopedSearchParams(searchParams, Object.values(REFERRAL_QUERY_KEYS), {
        [REFERRAL_QUERY_KEYS.page]: page > 1 ? String(page) : undefined,
      }),
    );
  };

  const handleCopyInvite = async (text: string, fieldName: string) => {
    if (!text) {
      return;
    }

    try {
      await copyToClipboard(text);
      setCopiedInviteField(fieldName);
      setTimeout(() => setCopiedInviteField(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  return (
    <div className="p-8 max-w-full mx-auto">
      {/* Invite Friends Banner Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-[#0f0f17] border border-[#1a1a24] rounded-xl p-8 mb-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#FFB800] to-[#FF6B00] flex items-center justify-center">
            <Gift size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-2xl text-white font-medium">
              {text.inviteTitle}
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              {text.inviteSubtitle}
            </p>
          </div>
        </div>

        {/* Referral Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Total Referrals */}
          <div className="bg-gradient-to-br from-[#1a1a24] to-[#12121a] border border-[#2a2a3a] rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-[#0052FF]/10 flex items-center justify-center">
                <Users size={20} className="text-[#0052FF]" />
              </div>
            </div>
            <div className="text-4xl text-white font-medium mb-2">
              {isLoadingReferralStats ? '-' : (referralStats?.total_invited ?? 0)}
            </div>
            <p className="text-gray-400 text-sm">{text.totalInvitedFriends}</p>
          </div>

          {/* Pending Referrals */}
          <div className="bg-gradient-to-br from-[#1a1a24] to-[#12121a] border border-[#2a2a3a] rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-[#FFB800]/10 flex items-center justify-center">
                <Users size={20} className="text-[#FFB800]" />
              </div>
            </div>
            <div className="text-4xl text-white font-medium mb-2">
              {isLoadingReferralStats ? '-' : (referralStats?.pending_referrals ?? 0)}
            </div>
            <p className="text-gray-400 text-sm">{text.pendingReferrals}</p>
          </div>

          {/* Earned Rewards */}
          <div className="bg-gradient-to-br from-[#1a1a24] to-[#12121a] border border-[#2a2a3a] rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-[#00FF94]/10 flex items-center justify-center">
                <Gift size={20} className="text-[#00FF94]" />
              </div>
            </div>
            <div className="text-4xl text-[#00FF94] font-medium mb-2">
              {isLoadingReferralStats ? '-' : formatCurrency(referralStats?.total_earned)}
            </div>
            <p className="text-gray-400 text-sm">{text.totalEarnedRewards}</p>
          </div>
        </div>

        {/* Referral Link */}
        <div className="space-y-4">
          <div>
            <label className="block text-gray-400 text-sm mb-2">{text.yourReferralLink}</label>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={referralLink}
                  readOnly
                  className="w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#0052FF] transition-colors"
                />
              </div>
              <button
                onClick={() => handleCopyInvite(referralLink, 'Referral Link')}
                disabled={!referralLink}
                className="px-6 py-3 bg-[#0052FF] text-white rounded-lg hover:bg-[#0052FF]/90 transition-all flex items-center gap-2 font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                {copiedInviteField === 'Referral Link' ? (
                  <>
                    <Check size={18} />
                    <span>{text.copied}</span>
                  </>
                ) : (
                  <>
                    <Copy size={18} />
                    <span>{text.copyLink}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Referral Code */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">{text.yourReferralCode}</label>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={myReferralCode}
                  readOnly
                  className="w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-[#0052FF] transition-colors"
                />
              </div>
              <button
                onClick={() => handleCopyInvite(myReferralCode, 'Referral Code')}
                disabled={!myReferralCode}
                className="px-6 py-3 bg-[#00FF94] text-[#0a0a0f] rounded-lg hover:bg-[#00FF94]/90 transition-all flex items-center gap-2 font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                {copiedInviteField === 'Referral Code' ? (
                  <>
                    <Check size={18} />
                    <span>{text.copied}</span>
                  </>
                ) : (
                  <>
                    <Copy size={18} />
                    <span>{text.copyCode}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Referral Info */}
        <div className="mt-6 p-4 bg-gradient-to-r from-[#0052FF]/10 to-[#00FF94]/10 border border-[#0052FF]/30 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[#0052FF] flex items-center justify-center flex-shrink-0 mt-0.5">
              <Gift size={16} className="text-white" />
            </div>
            <div>
              <h4 className="text-white text-sm font-medium mb-1">{text.howItWorks}</h4>
              <p className="text-gray-400 text-sm leading-relaxed">
                {howItWorksParts.prefix}
                <span className="text-[#00FF94] font-medium">{text.howItWorksRewardHighlight}</span>
                {howItWorksParts.suffix}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Referral List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="bg-[#0f0f17] border border-[#1a1a24] rounded-xl overflow-hidden"
      >
        {/* Table Header */}
        <div className="p-6 border-b border-[#1a1a24]">
          <h2 className="text-white text-xl font-semibold mb-1">{text.referralList}</h2>
          <p className="text-gray-400 text-sm">{text.referralListSubtitle}</p>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          {isReferralListLoading ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <p className="text-gray-400 text-sm text-center">{text.loadingReferrals}</p>
            </div>
          ) : referrals.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="bg-[#1a1a24]">
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {text.colName}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {text.colRegisterDate}
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {text.colTotalChallengeCount}
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {text.colStatus}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a24]">
                {referrals.map((referral, index) => (
                  <motion.tr
                    key={referral.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: 0.3 + index * 0.05 }}
                    className="hover:bg-[#1a1a24]/50 transition-colors"
                  >
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0052FF] to-[#0041CC] flex items-center justify-center text-white font-semibold text-sm">
                          {getInitials(referral.name)}
                        </div>
                        <div>
                          <p className="text-white font-medium text-sm">{referral.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <p className="text-gray-400 text-sm">{referral.registerDate}</p>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-right">
                      <p className="text-white text-sm font-semibold">
                        {referral.totalChallengeCount}
                      </p>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="flex justify-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                            referral.status === 'Active'
                              ? 'bg-[#00FF94]/10 text-[#00FF94] border border-[#00FF94]/30'
                              : 'bg-[#FFB800]/10 text-[#FFB800] border border-[#FFB800]/30'
                          }`}
                        >
                          {referral.status === 'Active' ? (
                            <CheckCircle size={14} />
                          ) : (
                            <Clock size={14} />
                          )}
                          {getStatusLabel(referral.status)}
                        </span>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-16 h-16 rounded-full bg-[#1a1a24] flex items-center justify-center mb-4">
                <Users size={32} className="text-gray-500" />
              </div>
              <p className="text-gray-400 text-sm text-center">{text.noReferralsFound}</p>
              <p className="text-gray-500 text-xs text-center mt-2">{text.noReferralsHint}</p>
            </div>
          )}
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden p-4 space-y-4">
          {isReferralListLoading ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <p className="text-gray-400 text-sm text-center">{text.loadingReferrals}</p>
            </div>
          ) : referrals.length > 0 ? (
            referrals.map((referral, index) => (
              <motion.div
                key={referral.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-[#16161f] border border-[#2a2a3a] rounded-lg p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0052FF] to-[#0041CC] flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                      {getInitials(referral.name)}
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm">{referral.name}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{referral.registerDate}</p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold ${
                      referral.status === 'Active'
                        ? 'bg-[#00FF94]/10 text-[#00FF94] border border-[#00FF94]/30'
                        : 'bg-[#FFB800]/10 text-[#FFB800] border border-[#FFB800]/30'
                    }`}
                  >
                    {referral.status === 'Active' ? (
                      <CheckCircle size={12} />
                    ) : (
                      <Clock size={12} />
                    )}
                    {getStatusLabel(referral.status)}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-xs">{text.totalChallenges}</span>
                    <span className="text-white text-sm font-semibold">
                      {referral.totalChallengeCount}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-16 h-16 rounded-full bg-[#1a1a24] flex items-center justify-center mb-4">
                <Users size={32} className="text-gray-500" />
              </div>
              <p className="text-gray-400 text-sm text-center">{text.noReferralsFound}</p>
              <p className="text-gray-500 text-xs text-center mt-2">{text.noReferralsHint}</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalReferrals > 0 && (
          <div className="p-6 border-t border-[#1a1a24] flex items-center justify-between flex-wrap gap-4">
            <p className="text-gray-400 text-sm">
              {renderShowingReferrals()}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => updateReferralPage(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1 || isReferralListLoading}
                className="px-4 py-2 bg-[#1a1a24] text-gray-400 rounded-lg text-sm hover:bg-[#2a2a3a] hover:text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                {text.previous}
              </button>
              <button className="px-4 py-2 bg-[#0052FF] text-white rounded-lg text-sm font-medium hover:bg-[#0052FF]/90 transition-colors">
                {currentPage}
              </button>
              <button
                onClick={() => updateReferralPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages || isReferralListLoading}
                className="px-4 py-2 bg-[#1a1a24] text-gray-400 rounded-lg text-sm hover:bg-[#2a2a3a] hover:text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                {text.next}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

