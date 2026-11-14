import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import {
  AlertCircle,
  Calendar,
  Users,
  TrendingUp,
  CheckCircle,
  Clock,
  XCircle,
  Gift,
  Info,
  Handshake,
} from 'lucide-react';
import { Column, DataTable } from './DataTable';
import { FilterActions } from './FilterControls';
import { useLocale } from '@/app/i18n/LocaleContext';
import type { RewardTranslations } from '@/app/i18n/translations';

export type RewardHistory = {
  id: number;
  date: string;
  source: string;
  description: string;
  amount: number;
  status: 'completed' | 'pending' | 'failed';
  type: 'referral' | 'bonus' | 'affiliate';
  rejection_reason?: string | null;
};

export interface RewardHistoryFilterParams {
  type?: 'TRADING_BONUS' | 'REFERRAL_BONUS' | 'AFFILIATE_COMMISSION';
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
}

type RewardHistoryTypeFilter = 'all' | RewardHistory['type'];
type RewardHistoryStatusFilter = 'all' | RewardHistory['status'];

interface RewardHistoryTableProps {
  rewardHistory: RewardHistory[];
  filters?: RewardHistoryFilterParams;
  onFiltersChange?: (filters: RewardHistoryFilterParams) => void;
}

const getDisplayRewardDescription = (reward: RewardHistory, translations: RewardTranslations) => {
  if (reward.type === 'referral') {
    const userName = reward.description.split(' - ')[0];
    return userName ? `${translations.referee} - ${userName}` : reward.description;
  }

  if (reward.type === 'bonus') {
    return translations.fundedPayoutPayBack;
  }

  if (reward.type === 'affiliate') {
    return translations.affiliatePromotionCommission;
  }

  return reward.description;
};

const getRewardFailureReason = (reward: RewardHistory) => reward.rejection_reason || '';

const toRewardHistoryFilterParams = (
  typeFilter: RewardHistoryTypeFilter,
  statusFilter: RewardHistoryStatusFilter,
): RewardHistoryFilterParams => ({
  type:
    typeFilter === 'bonus'
      ? 'TRADING_BONUS'
      : typeFilter === 'referral'
        ? 'REFERRAL_BONUS'
        : typeFilter === 'affiliate'
          ? 'AFFILIATE_COMMISSION'
          : undefined,
  status:
    statusFilter === 'completed'
      ? 'APPROVED'
      : statusFilter === 'pending'
        ? 'PENDING'
        : statusFilter === 'failed'
          ? 'REJECTED'
          : undefined,
});

const getTypeFilterFromParams = (filters?: RewardHistoryFilterParams): RewardHistoryTypeFilter =>
  filters?.type === 'TRADING_BONUS'
    ? 'bonus'
    : filters?.type === 'REFERRAL_BONUS'
      ? 'referral'
      : filters?.type === 'AFFILIATE_COMMISSION'
        ? 'affiliate'
        : 'all';

const getStatusFilterFromParams = (
  filters?: RewardHistoryFilterParams,
): RewardHistoryStatusFilter =>
  filters?.status === 'APPROVED'
    ? 'completed'
    : filters?.status === 'PENDING'
      ? 'pending'
      : filters?.status === 'REJECTED'
        ? 'failed'
        : 'all';

export function RewardHistoryTable({
  rewardHistory,
  filters,
  onFiltersChange,
}: RewardHistoryTableProps) {
  const { T } = useLocale();
  const text = T.reward;
  const typeFilter = getTypeFilterFromParams(filters);
  const statusFilter = getStatusFilterFromParams(filters);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hoveredFailureTooltip, setHoveredFailureTooltip] = useState<{
    reason: string;
    x: number;
    y: number;
    interaction: 'hover' | 'tap';
  } | null>(null);
  const itemsPerPage = 8;

  const getStatusIcon = (status: RewardHistory['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={16} className="text-[#00FF94]" />;
      case 'pending':
        return <Clock size={16} className="text-[#FFB800]" />;
      case 'failed':
        return <XCircle size={16} className="text-red-400" />;
    }
  };

  const getStatusBadge = (status: RewardHistory['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-[#00FF94]/10 text-[#00FF94]';
      case 'pending':
        return 'bg-[#FFB800]/10 text-[#FFB800]';
      case 'failed':
        return 'bg-red-500/10 text-red-400';
    }
  };

  const getTypeIcon = (type: RewardHistory['type']) => {
    switch (type) {
      case 'referral':
        return <Users size={18} className="text-[#0052FF]" />;
      case 'bonus':
        return <TrendingUp size={18} className="text-[#00FF94]" />;
      case 'affiliate':
        return <Handshake size={18} className="text-[#A855F7]" />;
      default:
        return <Gift size={18} className="text-gray-400" />;
    }
  };

  const getTypeBackground = (type: RewardHistory['type']) => {
    switch (type) {
      case 'referral':
        return 'bg-[#0052FF]/10';
      case 'bonus':
        return 'bg-[#00FF94]/10';
      case 'affiliate':
        return 'bg-[#A855F7]/10';
      default:
        return 'bg-white/10';
    }
  };

  const getStatusLabel = (status: RewardHistory['status']) => {
    switch (status) {
      case 'completed':
        return text.statusCompleted;
      case 'pending':
        return text.statusPending;
      case 'failed':
        return text.statusFailed;
    }
  };

  const getSourceLabel = (type: RewardHistory['type'], source: string) => {
    switch (type) {
      case 'referral':
        return text.referralCommission;
      case 'bonus':
        return text.tradingBonus;
      case 'affiliate':
        return text.affiliateCommission;
      default:
        return source;
    }
  };

  const filteredRewardHistory = rewardHistory
    .map((reward) => ({
      ...reward,
      description: getDisplayRewardDescription(reward, text),
    }))
    .filter((reward) => {
      const matchesType = typeFilter === 'all' || reward.type === typeFilter;
      const matchesStatus = statusFilter === 'all' || reward.status === statusFilter;
      return matchesType && matchesStatus;
    });

  const totalPages = Math.ceil(filteredRewardHistory.length / itemsPerPage);
  const displayData = filteredRewardHistory.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const handleLoadMore = () => {
    if (currentPage < totalPages && !isLoading) {
      setIsLoading(true);
      setTimeout(() => {
        setCurrentPage((prev) => prev + 1);
        setIsLoading(false);
      }, 800);
    }
  };

  const renderFailureReasonButton = (reward: RewardHistory, enableHover = true) => {
    const failureReason = getRewardFailureReason(reward);

    if (reward.status !== 'failed' || !failureReason) {
      return null;
    }

    return (
      <button
        type="button"
        aria-label={text.showFailureReason}
        className="w-4 h-4 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center cursor-pointer hover:bg-red-500/20 transition-colors"
        onMouseEnter={(event) => {
          if (!enableHover) {
            return;
          }

          const rect = event.currentTarget.getBoundingClientRect();
          setHoveredFailureTooltip({
            reason: failureReason,
            x: rect.left - 266,
            y: rect.top + rect.height / 2,
            interaction: 'hover',
          });
        }}
        onMouseLeave={() => {
          if (hoveredFailureTooltip?.interaction !== 'tap') {
            setHoveredFailureTooltip(null);
          }
        }}
        onClick={(event) => {
          event.stopPropagation();
          const rect = event.currentTarget.getBoundingClientRect();
          setHoveredFailureTooltip((prev) => {
            if (prev?.interaction === 'tap' && prev.reason === failureReason) {
              return null;
            }

            return {
              reason: failureReason,
              x: rect.left - 266,
              y: rect.top + rect.height / 2,
              interaction: 'tap',
            };
          });
        }}
      >
        <Info size={10} className="text-red-400" />
      </button>
    );
  };

  const columns: Column<RewardHistory>[] = [
    {
      header: text.colDate,
      accessor: (reward) => (
        <div className="flex items-center gap-2 text-gray-300 text-sm">
          <Calendar size={14} className="text-gray-500" />
          {reward.date}
        </div>
      ),
    },
    {
      header: text.colType,
      accessor: (reward) => (
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${getTypeBackground(reward.type)}`}
          >
            {getTypeIcon(reward.type)}
          </div>
          <span className="text-white text-sm font-medium">
            {getSourceLabel(reward.type, reward.source)}
          </span>
        </div>
      ),
    },
    {
      header: text.colDescription,
      accessor: (reward) => <p className="text-gray-300 text-sm">{reward.description}</p>,
    },
    {
      header: text.colAmount,
      accessor: (reward) => (
        <div>
          <p className="text-white text-sm font-semibold">
            +${reward.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-gray-500 text-xs">USDT</p>
        </div>
      ),
    },
    {
      header: text.colStatus,
      accessor: (reward) => (
        <div className="inline-flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${getStatusBadge(reward.status)}`}
          >
            {getStatusIcon(reward.status)}
            {getStatusLabel(reward.status)}
          </span>
          {renderFailureReasonButton(reward)}
        </div>
      ),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.5 }}
      className="bg-[#0f0f17] border border-[#1a1a24] rounded-xl overflow-hidden"
    >
      <div className="p-6 border-b border-[#1a1a24]">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-white text-xl font-semibold mb-1">{text.rewardHistory}</h2>
            <p className="text-gray-400 text-sm">{text.rewardHistorySubtitle}</p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="flex gap-3">
              <select
                value={typeFilter}
                onChange={(e) => {
                  const nextTypeFilter = e.target.value as RewardHistoryTypeFilter;
                  setCurrentPage(1);
                  onFiltersChange?.(toRewardHistoryFilterParams(nextTypeFilter, statusFilter));
                }}
                className="px-4 py-2 bg-[#1a1a24] text-white rounded-lg border border-[#2a2a3a] text-sm focus:outline-none focus:border-[#0052FF] transition-colors"
              >
                <option value="all">{text.allTypes}</option>
                <option value="referral">{text.referralCommission}</option>
                <option value="bonus">{text.tradingBonus}</option>
                <option value="affiliate">{text.affiliateCommission}</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => {
                  const nextStatusFilter = e.target.value as RewardHistoryStatusFilter;
                  setCurrentPage(1);
                  onFiltersChange?.(toRewardHistoryFilterParams(typeFilter, nextStatusFilter));
                }}
                className="px-4 py-2 bg-[#1a1a24] text-white rounded-lg border border-[#2a2a3a] text-sm focus:outline-none focus:border-[#0052FF] transition-colors"
              >
                <option value="all">{text.allStatus}</option>
                <option value="completed">{text.statusCompleted}</option>
                <option value="pending">{text.statusPending}</option>
                <option value="failed">{text.statusFailed}</option>
              </select>
            </div>
            <FilterActions className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setCurrentPage(1);
                  onFiltersChange?.({});
                }}
                className="px-4 py-2 bg-[#1a1a24] text-gray-400 rounded-lg text-sm hover:bg-[#24243a] hover:text-white transition-colors"
              >
                {text.resetFilters}
              </button>
            </FilterActions>
          </div>
        </div>
      </div>

      <DataTable
        data={displayData}
        columns={columns}
        keyExtractor={(reward) => reward.id}
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredRewardHistory.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        onLoadMore={handleLoadMore}
        hasMore={currentPage < totalPages}
        isLoading={isLoading}
        emptyMessage={text.emptyMessage}
        summaryLabel={text.summaryLabel}
        endOfResultsLabel={text.endOfResults}
        previousLabel={text.previous}
        nextLabel={text.next}
        showingRangeLabel={text.showingPagination}
        rowCursor="default"
        renderMobileCard={(reward, index) => (
          <motion.div
            key={reward.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (index % itemsPerPage) * 0.05 }}
            className="bg-[#16161f] border border-[#2a2a3a] rounded-lg p-4"
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${getTypeBackground(reward.type)}`}
                >
                  {getTypeIcon(reward.type)}
                </div>
                <div>
                  <p className="text-white text-sm font-medium">
                    {getSourceLabel(reward.type, reward.source)}
                  </p>
                  <p className="text-gray-400 text-xs">{reward.date}</p>
                </div>
              </div>
              <div className="inline-flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${getStatusBadge(reward.status)}`}
                >
                  {getStatusIcon(reward.status)}
                  {getStatusLabel(reward.status)}
                </span>
                {renderFailureReasonButton(reward, false)}
              </div>
            </div>

            <p className="text-gray-300 text-sm mb-3">{reward.description}</p>

            <div className="flex items-center justify-between gap-4">
              <span className="text-gray-400 text-xs">{text.rewardAmount}</span>
              <span className="text-white text-sm font-semibold">
                +${reward.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                <span className="text-gray-500 text-xs ml-1">USDT</span>
              </span>
            </div>
          </motion.div>
        )}
      />

      {filteredRewardHistory.length === 0 && (
        <div className="p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#1a1a24] flex items-center justify-center">
            <Gift size={32} className="text-gray-500" />
          </div>
          <h3 className="text-white text-lg font-medium mb-2">{text.emptyTitle}</h3>
          <p className="text-gray-400 text-sm">{text.emptyDescription}</p>
        </div>
      )}

      {hoveredFailureTooltip &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            {hoveredFailureTooltip.interaction === 'tap' && (
              <button
                type="button"
                aria-label={text.closeFailureReasonTooltip}
                className="fixed inset-0 z-[99] bg-transparent lg:hidden"
                onClick={() => setHoveredFailureTooltip(null)}
              />
            )}
            <div
              className="fixed z-[100] pointer-events-none"
              style={{ left: hoveredFailureTooltip.x, top: hoveredFailureTooltip.y }}
            >
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="bg-[#1a1a24] border border-red-500/30 rounded-lg p-3 shadow-xl max-w-[250px] relative -translate-y-1/2"
              >
                <div className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[6px] border-l-red-500/30"></div>
                <div className="absolute right-[-5px] top-1/2 -translate-y-1/2 w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[5px] border-l-[#1a1a24]"></div>
                <div className="flex items-start gap-2">
                  <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white text-xs font-semibold mb-1">{text.failureReason}</p>
                    <p className="text-gray-300 text-xs leading-relaxed">
                      {hoveredFailureTooltip.reason}
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </>,
          document.body,
        )}
    </motion.div>
  );
}
