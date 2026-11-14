import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSearchParams } from 'react-router';
import {
  Wallet,
  TrendingUp,
  ArrowUpRight,
  CheckCircle,
  X,
  AlertCircle,
  Copy,
  Check,
  ArrowRight,
  DollarSign,
  Users,
} from 'lucide-react';
import { useMyRewardsQuery } from '@/app/queries/rewards';
import {
  RewardHistoryTable,
  type RewardHistory,
  type RewardHistoryFilterParams,
} from '../../components/shared/RewardHistoryTable';
import { TransferBalanceSection } from '../../components/shared/TransferBalanceSection';
import { TransferModal } from '../../components/shared/TransferModal';
import type { MyReward } from '@/api/rewards';
import { formatDateByBrowserTimeZone } from '@/app/utils/date';
import { applyScopedSearchParams } from '@/app/utils/url/queryParams';
import { useLocale } from '@/app/i18n/LocaleContext';

const REWARD_QUERY_KEYS = {
  type: 'type',
  status: 'status',
} as const;

const parseRewardTypeParam = (value: string | null): RewardHistoryFilterParams['type'] => {
  if (
    value === 'TRADING_BONUS' ||
    value === 'REFERRAL_BONUS' ||
    value === 'AFFILIATE_COMMISSION'
  ) {
    return value;
  }

  return undefined;
};

const parseRewardStatusParam = (value: string | null): RewardHistoryFilterParams['status'] => {
  if (value === 'PENDING' || value === 'APPROVED' || value === 'REJECTED') {
    return value;
  }

  return undefined;
};

const getRewardFiltersFromSearchParams = (
  searchParams: URLSearchParams,
): RewardHistoryFilterParams => ({
  type: parseRewardTypeParam(searchParams.get(REWARD_QUERY_KEYS.type)),
  status: parseRewardStatusParam(searchParams.get(REWARD_QUERY_KEYS.status)),
});

const getRewardStatus = (status: string): RewardHistory['status'] => {
  switch (status.toUpperCase()) {
    case 'APPROVED':
      return 'completed';
    case 'REJECTED':
      return 'failed';
    default:
      return 'pending';
  }
};

const getRewardType = (type: string): RewardHistory['type'] => {
  switch (type.toUpperCase()) {
    case 'TRADING_BONUS':
      return 'bonus';
    case 'REFERRAL_BONUS':
      return 'referral';
    case 'AFFILIATE_COMMISSION':
      return 'affiliate';
    default:
      return 'bonus';
  }
};

const getRewardSource = (type: string) => {
  switch (type.toUpperCase()) {
    case 'TRADING_BONUS':
      return 'Trading Bonus';
    case 'REFERRAL_BONUS':
      return 'Referral Commission';
    case 'AFFILIATE_COMMISSION':
      return 'Affiliate Commission';
    default:
      return type || '-';
  }
};

const isSupportedRewardType = (type: string) =>
  ['TRADING_BONUS', 'REFERRAL_BONUS', 'AFFILIATE_COMMISSION'].includes(type.toUpperCase());

const mapMyRewardToHistory = (reward: MyReward): RewardHistory => ({
  id: reward.id,
  date: formatDateByBrowserTimeZone(reward.created_at) || '',
  source: getRewardSource(reward.type),
  description: reward.description || '',
  amount: reward.amount ?? 0,
  status: getRewardStatus(reward.status),
  type: getRewardType(reward.type),
  rejection_reason: reward.rejection_reason ?? null,
});

export function RewardDashboardPage() {
  const { T } = useLocale();
  const text = T.reward;
  const [searchParams, setSearchParams] = useSearchParams();
  const rewardFilters = useMemo(
    () => getRewardFiltersFromSearchParams(searchParams),
    [searchParams],
  );
  const { data: myRewards = [] } = useMyRewardsQuery(rewardFilters);

  const [totalRewardBalance, setTotalRewardBalance] = useState(1250.0);
  const [totalAssetBalance, setTotalAssetBalance] = useState(15750.5);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showTransferSuccess, setShowTransferSuccess] = useState(false);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<'TRC-20' | 'ERC-20'>('TRC-20');
  const [walletAddress, setWalletAddress] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferError, setTransferError] = useState('');
  const [addressCopied, setAddressCopied] = useState(false);

  const rewardHistory = useMemo(
    () =>
      myRewards
        .filter((reward) => isSupportedRewardType(reward.type))
        .map(mapMyRewardToHistory),
    [myRewards],
  );

  const withdrawAmountNum = parseFloat(withdrawAmount) || 0;

  const validateTransferAmount = (amount: string) => {
    const numAmount = parseFloat(amount);
    if (!amount) return (setTransferError(text.amountRequired), false);
    if (isNaN(numAmount) || numAmount <= 0)
      return (setTransferError(text.amountGreaterThanZero), false);
    if (numAmount > totalRewardBalance) return (setTransferError(text.insufficientBalance), false);
    if (numAmount < 1) return (setTransferError(text.minimumTransferAmount), false);
    setTransferError('');
    return true;
  };

  const handleTransferSubmit = () => {
    if (!validateTransferAmount(transferAmount)) return;
    const amount = parseFloat(transferAmount);
    setTotalRewardBalance((prev) => prev - amount);
    setTotalAssetBalance((prev) => prev + amount);
    setShowTransferModal(false);
    setTransferAmount('');
    setTransferError('');
    setShowTransferSuccess(true);
    setTimeout(() => setShowTransferSuccess(false), 3000);
  };

  const handleCopyAddress = () => {
    const textArea = document.createElement('textarea');
    textArea.value = walletAddress;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setAddressCopied(true);
      setTimeout(() => setAddressCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
    document.body.removeChild(textArea);
  };

  const handleTransferMaxAmount = () => {
    setTransferAmount(totalRewardBalance.toFixed(2));
    validateTransferAmount(totalRewardBalance.toFixed(2));
  };

  const handleRewardFiltersChange = (filters: RewardHistoryFilterParams) => {
    const next = applyScopedSearchParams(searchParams, Object.values(REWARD_QUERY_KEYS), {
      [REWARD_QUERY_KEYS.type]: filters.type,
      [REWARD_QUERY_KEYS.status]: filters.status,
    });

    setSearchParams(next, { replace: true });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* <TransferBalanceSection
        balanceLabel={text.totalRewardBalance}
        balance={totalRewardBalance}
        totalAssetBalance={totalAssetBalance}
        showTransferSuccess={showTransferSuccess}
        onTransferClick={() => setShowTransferModal(true)}
      /> */}

      <RewardHistoryTable
        rewardHistory={rewardHistory}
        filters={rewardFilters}
        onFiltersChange={handleRewardFiltersChange}
      />

      {/* 260504 버전에 없어서 일단 주석처리 */}
      {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <div className="bg-[#0f0f17] border border-[#1a1a24] rounded-xl p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-[#00FF94]/10 flex items-center justify-center">
              <Users size={24} className="text-[#00FF94]" />
            </div>
            <div>
              <h3 className="text-white text-lg font-semibold mb-1">{text.referralProgram}</h3>
              <p className="text-gray-400 text-sm">
                {text.referralProgramDescription}
              </p>
            </div>
          </div>
          <button className="w-full px-4 py-3 bg-[#1a1a24] text-white rounded-lg hover:bg-[#2a2a3a] transition-colors text-sm font-medium">
            {text.viewReferralDetails}
          </button>
        </div>
      </div> */}

      <AnimatePresence>
        {showWithdrawalModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
              onClick={() => setShowWithdrawalModal(false)}
            />
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <div className="bg-[#0f0f17] border border-[#1a1a24] rounded-2xl shadow-2xl max-w-2xl w-full p-8 relative">
                <button
                  className="absolute top-6 right-6 w-10 h-10 rounded-lg bg-[#1a1a24] text-gray-400 hover:text-white"
                  onClick={() => setShowWithdrawalModal(false)}
                >
                  <X size={20} />
                </button>
                <h2 className="text-white text-2xl font-semibold mb-2">{text.withdrawRewards}</h2>
                <p className="text-gray-400 text-sm mb-6">{text.withdrawRewardsSubtitle}</p>
                <div className="space-y-4">
                  <input
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder={text.withdrawalAmountPlaceholder}
                    className="w-full px-4 py-4 bg-[#1a1a24] text-white rounded-xl border border-[#2a2a3a]"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    {(['TRC-20', 'ERC-20'] as const).map((network) => (
                      <button
                        key={network}
                        onClick={() => setSelectedNetwork(network)}
                        className={`p-4 rounded-xl border ${selectedNetwork === network ? 'border-[#0052FF] bg-[#0052FF]/10 text-white' : 'border-[#2a2a3a] bg-[#1a1a24] text-gray-400'}`}
                      >
                        {network}
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <input
                      value={walletAddress}
                      onChange={(e) => setWalletAddress(e.target.value)}
                      placeholder={text.walletAddressPlaceholder.replace('{network}', selectedNetwork)}
                      className="w-full px-4 py-4 bg-[#1a1a24] text-white rounded-xl border border-[#2a2a3a] pr-12"
                    />
                    {walletAddress && (
                      <button
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                        onClick={handleCopyAddress}
                      >
                        {addressCopied ? (
                          <Check size={18} className="text-[#00FF94]" />
                        ) : (
                          <Copy size={18} />
                        )}
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => setShowWithdrawalModal(false)}
                    disabled={
                      !walletAddress ||
                      withdrawAmountNum < 50 ||
                      withdrawAmountNum > totalRewardBalance
                    }
                    className="w-full px-6 py-4 bg-[#0052FF] text-white rounded-xl font-semibold disabled:opacity-50"
                  >
                    {text.requestWithdrawal}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </AnimatePresence>

      <TransferModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        sourceLabel={text.reward}
        sourceBalance={totalRewardBalance}
        destinationBalance={totalAssetBalance}
        transferAmount={transferAmount}
        transferError={transferError}
        onTransferAmountChange={(value) => {
          setTransferAmount(value);
          if (value) validateTransferAmount(value);
          else setTransferError('');
        }}
        onUseMax={handleTransferMaxAmount}
        onTransferSubmit={handleTransferSubmit}
        labels={{
          title: text.transferToTotalAsset,
          subtitle: text.transferSubtitle,
          transferDirection: text.transferDirection,
          from: text.from,
          to: text.to,
          sourceBalanceLabel: text.totalRewardBalance,
          destinationBalanceLabel: text.totalAsset,
          available: text.available,
          currentBalance: text.currentBalance,
          transferAmount: text.transferAmount,
          enterAmount: text.enterAmount,
          minimumAmount: text.minimumAmount,
          useMax: text.useMax,
          transferInformation: text.transferInformation,
          transferInfoSourceToAsset: text.transferInfoSourceToAsset,
          transferInfoInstantFree: text.transferInfoInstantFree,
          transferInfoMinimum: text.transferInfoMinimum,
          transferInfoBalanceUpdate: text.transferInfoBalanceUpdate,
          cancel: text.cancel,
          confirmTransfer: text.confirmTransfer,
        }}
      />
    </div>
  );
}

