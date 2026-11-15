import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router';
import { createPortal } from 'react-dom';
import {
  Wallet,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  Copy,
  Check,
  ExternalLink,
  Calendar,
  Filter,
  X,
  AlertCircle,
  Shield,
  ArrowLeftRight,
  ArrowDownUp,
  Info,
} from 'lucide-react';
import {
  FilterActions,
  FilterCard,
  FilterDateInput,
  FilterField,
  FilterSelect,
} from '@/app/components/shared/FilterControls';
import { type Column, DataTable } from '@/app/components/shared/DataTable';
import { SuccessNotification } from '@/app/components/shared/SuccessNotification';
import { ActionRequiredModal } from '@/app/components/shared/ActionRequiredModal';
import usdtAptQr from '@/app/assets/deposit-qr/usdt-apt.png';
import usdtBscQr from '@/app/assets/deposit-qr/usdt-bsc.png';
import usdtEthQr from '@/app/assets/deposit-qr/usdt-eth.png';
import usdtPolQr from '@/app/assets/deposit-qr/usdt-pol.png';
import usdtSolQr from '@/app/assets/deposit-qr/usdt-sol.png';
import usdtTrc20Qr from '@/app/assets/deposit-qr/usdt-trc20.png';
import { useMyAssetQuery } from '@/app/queries/assets';
import { useMeQuery } from '@/app/queries/profile';
import {
  useWalletNetworksQuery,
  useWalletTransactionsQuery,
  walletsQueryKeys,
} from '@/app/queries/wallets';
import { createDeposit, createTransfer, createWithdraw } from '@/api/wallets';
import { getKycStatus } from '@/api/kyc';
import { sendVerificationEmail } from '@/api/signup';
import { applyScopedSearchParams, createScopedSearchParams } from '@/app/utils/url/queryParams';
import { useLocale } from '@/app/i18n/LocaleContext';
import type { MyAssetTranslations } from '@/app/i18n/translations';

type TransactionStatus = 'Completed' | 'Pending' | 'Failed';
type TransactionStatusFilter = 'All' | TransactionStatus;
type TransactionCategoryFilter = 'All Transactions' | 'Deposits Only' | 'Withdrawals Only';

interface UnifiedTransaction {
  id: number;
  date: string;
  txType: string;
  displayTxType: string;
  depositAmount?: number;
  withdrawAmount?: number;
  fee?: number;
  amount?: number;
  network: string;
  address: string;
  txid: string;
  status: TransactionStatus;
  rejectReason?: string;
  transactionCategory?: 'deposit' | 'withdraw';
}

type UnifiedTransactionRow = UnifiedTransaction;

const ASSET_QUERY_KEYS = {
  start: 'start',
  end: 'end',
  category: 'category',
  status: 'status',
  page: 'page',
} as const;

const parsePage = (value: string | null) => {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
};

const fromQueryDate = (value: string | null) => {
  if (!value) {
    return '';
  }

  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }

  return value;
};

const toApiDate = (value: string) => (value ? value.replace(/-/g, '') : undefined);

const parseStatusFilter = (value: string | null): TransactionStatusFilter => {
  const normalized = value?.trim().toUpperCase();

  if (normalized === 'COMPLETED') {
    return 'Completed';
  }

  if (normalized === 'PENDING') {
    return 'Pending';
  }

  if (normalized === 'FAILED') {
    return 'Failed';
  }

  return 'All';
};

const parseCategoryFilter = (value: string | null): TransactionCategoryFilter => {
  if (value === 'Deposits Only' || value === 'Withdrawals Only') {
    return value;
  }

  return 'All Transactions';
};

const formatWalletTransactionDate = (value: string) => {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(parsed);

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute} GMT+9`;
};

const getWalletTransactionDateKey = (value: string) =>
  formatWalletTransactionDate(value).slice(0, 10);

const TRANSACTION_CATEGORY_FILTER_OPTIONS: TransactionCategoryFilter[] = [
  'All Transactions',
  'Deposits Only',
  'Withdrawals Only',
];

type NetworkOption = {
  value: string;
  label: string;
  fee: number;
};

const normalizeNetworkCode = (value: string) => value.trim().replace(/-/g, '').replace(/\s+/g, '');

const isEvmAddress = (address: string) => address.startsWith('0x') && address.length === 42;

type DepositNetworkConfig = {
  address: string;
  qrCode: string;
};

const USDT_DEPOSIT_NETWORK_CONFIGS = {
  TRC20: {
    address: 'TP5BKnip48zb4ohUFkQC3HdbMMFAS2D8Ge',
    qrCode: usdtTrc20Qr,
  },
  ETH: {
    address: '0x4e19627e76bd0d2cd8fccc629074980da83a3061',
    qrCode: usdtEthQr,
  },
  BSC: {
    address: '0x4e19627e76bd0d2cd8fccc629074980da83a3061',
    qrCode: usdtBscQr,
  },
  POL: {
    address: '0x4e19627e76bd0d2cd8fccc629074980da83a3061',
    qrCode: usdtPolQr,
  },
  SOL: {
    address: 'CHecvqhTLuctGubG9nKW3SfzSU3DAiF7UffCBFfhdDP7',
    qrCode: usdtSolQr,
  },
  APT: {
    address: '0x3f3a7672773d88817c926b0301861aa5e70fe4a60c181e8c065ff7758efdd3fd',
    qrCode: usdtAptQr,
  },
} satisfies Record<string, DepositNetworkConfig>;

const getDepositNetworkConfig = (network: string) => {
  const normalizedNetwork = normalizeNetworkCode(network).toUpperCase();
  const configKey = normalizedNetwork as keyof typeof USDT_DEPOSIT_NETWORK_CONFIGS;

  return USDT_DEPOSIT_NETWORK_CONFIGS[configKey];
};

const formatAssetTranslation = (
  template: string,
  values: Record<string, string | number>,
) =>
  Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  );

const getCategoryFilterLabel = (
  value: TransactionCategoryFilter,
  translations: MyAssetTranslations,
) => {
  switch (value) {
    case 'Deposits Only':
      return translations.depositsOnly;
    case 'Withdrawals Only':
      return translations.withdrawalsOnly;
    default:
      return translations.allTransactions;
  }
};

const getStatusFilterLabel = (
  value: TransactionStatusFilter,
  translations: MyAssetTranslations,
) => {
  switch (value) {
    case 'Completed':
      return translations.statusCompleted;
    case 'Pending':
      return translations.statusPending;
    case 'Failed':
      return translations.statusFailed;
    default:
      return translations.allStatus;
  }
};

// 지갑 더미 데이터 TQmZ7rK2pVx9nL4sJ8dH3cF6wY1aB5uN0Q

export function MyAssetPage() {
  const navigate = useNavigate();
  const { T } = useLocale();
  const text = T.myAsset;
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [hoveredFailureTooltip, setHoveredFailureTooltip] = useState<{
    reason: string;
    x: number;
    y: number;
    interaction: 'hover' | 'tap';
  } | null>(null);
  const { data: me } = useMeQuery();
  const { data: myAssetSummary, refetch: refetchMyAssetSummary } = useMyAssetQuery();
  const hasSeededAssetRef = useRef(false);

  // Modal states
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [isCheckingKycStatus, setIsCheckingKycStatus] = useState(false);
  const [kycActionModal, setKycActionModal] = useState<{
    title: string;
    subtitle: string;
    message: string;
    importantMessage?: string;
    confirmLabel: string;
    shouldNavigateToKyc: boolean;
  } | null>(null);
  const [showLiveAccountRequiredModal, setShowLiveAccountRequiredModal] = useState(false);
  const [isCheckingLiveAccount, setIsCheckingLiveAccount] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showDepositSuccess, setShowDepositSuccess] = useState(false);
  const {
    data: walletNetworks,
    isLoading: walletNetworksLoading,
    isError: walletNetworksError,
  } = useWalletNetworksQuery(showDepositModal || showWithdrawModal);

  // Deposit modal states
  const [depositAmount, setDepositAmount] = useState('');
  const [depositAmountError, setDepositAmountError] = useState('');
  const [depositNetwork, setDepositNetwork] = useState('');
  const [depositTxId, setDepositTxId] = useState('');
  const [depositTxIdError, setDepositTxIdError] = useState('');
  const [depositRequestError, setDepositRequestError] = useState('');

  // Withdraw modal states
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawNetwork, setWithdrawNetwork] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [addressError, setAddressError] = useState('');
  const [amountError, setAmountError] = useState('');
  const [withdrawRequestError, setWithdrawRequestError] = useState('');

  // Security verification modal states
  const [showSecurityVerification, setShowSecurityVerification] = useState(false);
  const [emailCode, setEmailCode] = useState('');
  const [authenticatorCode, setAuthenticatorCode] = useState('');
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [emailCodeTimer, setEmailCodeTimer] = useState(0);
  const [emailCodeError, setEmailCodeError] = useState('');
  const [authenticatorCodeError, setAuthenticatorCodeError] = useState('');
  const [showWithdrawSuccess, setShowWithdrawSuccess] = useState(false);

  // Transfer modal states
  const [transferFrom, setTransferFrom] = useState<'Total Asset' | 'Live Trading Account'>(
    'Total Asset',
  );
  const [transferTo, setTransferTo] = useState<'Total Asset' | 'Live Trading Account'>(
    'Live Trading Account',
  );
  const [transferAmount, setTransferAmount] = useState('');
  const [transferError, setTransferError] = useState('');
  const [transferRequestError, setTransferRequestError] = useState('');
  const [showTransferSuccess, setShowTransferSuccess] = useState(false);

  const ENABLE_WITHDRAW_SECURITY_MODAL = true;
  const requiresEmailVerification = Boolean(me?.is_email_enabled);
  const requiresAuthenticatorVerification = Boolean(me?.is_2fa_enabled);
  const shouldUseWithdrawSecurityModal =
    requiresEmailVerification || requiresAuthenticatorVerification;

  // Filter states
  const [fromDate, setFromDate] = useState(() =>
    fromQueryDate(searchParams.get(ASSET_QUERY_KEYS.start)),
  );
  const [toDate, setToDate] = useState(() => fromQueryDate(searchParams.get(ASSET_QUERY_KEYS.end)));
  const [filterCategory, setFilterCategory] = useState<TransactionCategoryFilter>(() =>
    parseCategoryFilter(searchParams.get(ASSET_QUERY_KEYS.category)),
  );
  const [filterStatus, setFilterStatus] = useState<TransactionStatusFilter>(() =>
    parseStatusFilter(searchParams.get(ASSET_QUERY_KEYS.status)),
  );
  const [appliedFromDate, setAppliedFromDate] = useState(() =>
    fromQueryDate(searchParams.get(ASSET_QUERY_KEYS.start)),
  );
  const [appliedToDate, setAppliedToDate] = useState(() =>
    fromQueryDate(searchParams.get(ASSET_QUERY_KEYS.end)),
  );
  const [appliedFilterCategory, setAppliedFilterCategory] = useState<TransactionCategoryFilter>(
    () => parseCategoryFilter(searchParams.get(ASSET_QUERY_KEYS.category)),
  );
  const [appliedFilterStatus, setAppliedFilterStatus] = useState<TransactionStatusFilter>(() =>
    parseStatusFilter(searchParams.get(ASSET_QUERY_KEYS.status)),
  );

  // Pagination state
  const [currentPage, setCurrentPage] = useState(() =>
    parsePage(searchParams.get(ASSET_QUERY_KEYS.page)),
  );
  const itemsPerPage = 20;

  const networkOptions: NetworkOption[] = useMemo(() => {
    if (walletNetworksError) {
      return [];
    }

    const activeNetworkOptions =
      walletNetworks
        ?.filter((network) => network.is_active)
        .flatMap((network) => {
          const name = network.name.trim();
          const desc = network.desc.trim();
          const fee = Number(network.fee);

          return name && Number.isFinite(fee)
            ? [
                {
                  value: name,
                  label: desc,
                  fee,
                },
              ]
            : [];
        }) ?? [];

    return activeNetworkOptions;
  }, [walletNetworks, walletNetworksError]);

  const networkAvailabilityMessage = walletNetworksLoading
    ? text.loadingAvailableNetworks
    : walletNetworksError
      ? text.failedLoadAvailableNetworks
      : networkOptions.length === 0
        ? text.noActiveNetworks
        : '';

  useEffect(() => {
    const selectedDepositNetwork = networkOptions.some(
      (network) => network.value === depositNetwork,
    );
    const selectedWithdrawNetwork = networkOptions.some(
      (network) => network.value === withdrawNetwork,
    );
    const defaultNetwork = networkOptions[0]?.value;

    if (!defaultNetwork) {
      setDepositNetwork('');
      setWithdrawNetwork('');
      return;
    }

    if (!selectedDepositNetwork) {
      setDepositNetwork(defaultNetwork);
    }

    if (!selectedWithdrawNetwork) {
      setWithdrawNetwork(defaultNetwork);
    }
  }, [depositNetwork, networkOptions, withdrawNetwork]);

  const selectedDepositNetworkConfig = useMemo(
    () => getDepositNetworkConfig(depositNetwork),
    [depositNetwork],
  );
  const depositAddress = selectedDepositNetworkConfig?.address ?? '';
  const depositQrCode = selectedDepositNetworkConfig?.qrCode;

  const walletTransactionsCategory =
    appliedFilterCategory === 'Deposits Only'
      ? 'DEPOSIT'
      : appliedFilterCategory === 'Withdrawals Only'
        ? 'WITHDRAW'
        : undefined;
  const walletTransactionsStatus = appliedFilterStatus !== 'All' ? appliedFilterStatus : undefined;
  const walletTransactionsStart = toApiDate(appliedFromDate);
  const walletTransactionsEnd = toApiDate(appliedToDate);
  const {
    data: walletTransactionsResponse,
    isLoading: walletTransactionsLoading,
    isFetching: walletTransactionsFetching,
  } = useWalletTransactionsQuery({
    category: walletTransactionsCategory,
    status: walletTransactionsStatus,
    start_date: walletTransactionsStart,
    end_date: walletTransactionsEnd,
    page: currentPage,
    size: itemsPerPage,
  });

  // Asset values are seeded from the API and then updated locally by transfer actions.
  const [totalAsset, setTotalAsset] = useState(0);
  const [tradingAccountAsset, setTradingAccountAsset] = useState(0);

  const syncAssetBalances = useCallback((summary: NonNullable<typeof myAssetSummary>) => {
    setTotalAsset(summary.total_asset ?? 0);
    setTradingAccountAsset(summary.live_accounts?.[0]?.balance ?? summary.total_live_balance ?? 0);
  }, []);

  useEffect(() => {
    if (hasSeededAssetRef.current || !myAssetSummary) {
      return;
    }

    syncAssetBalances(myAssetSummary);
    hasSeededAssetRef.current = true;
  }, [myAssetSummary, syncAssetBalances]);

  const walletTransactionRows: UnifiedTransactionRow[] = useMemo(() => {
    const mappedRows: UnifiedTransactionRow[] =
      walletTransactionsResponse?.items.map(
        (item): UnifiedTransactionRow => ({
          id: item.id,
          // Column direction is determined by actual amount fields first.
          // Fallback to direction/tx_type only when deposit/withdraw are both null or both set.
          transactionCategory:
            item.deposit != null && item.withdraw == null
              ? 'deposit'
              : item.withdraw != null && item.deposit == null
                ? 'withdraw'
                : item.direction === 'OUT'
                  ? 'withdraw'
                  : 'deposit',
          date: formatWalletTransactionDate(item.date),
          txType: item.tx_type,
          displayTxType: item.display_tx_type,
          depositAmount: item.deposit ?? undefined,
          withdrawAmount: item.withdraw ?? undefined,
          fee: item.fee ?? undefined,
          amount: item.deposit ?? item.withdraw ?? undefined,
          network: item.network ?? '-',
          address: item.address ?? '-',
          txid: item.txid ?? '-',
          status: item.display_status, // 기존 status -> display_status로 변경. 값 이상할 경우 확인 필요함.
          rejectReason: item.reject_reason ?? undefined,
        }),
      ) ?? [];

    return mappedRows;
  }, [walletTransactionsResponse]);

  const handleCopy = async (copyText: string, fieldName: string) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = copyText;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        const successful = document.execCommand('copy');
        textArea.remove();

        if (successful) {
          setCopiedField(fieldName);
          setTimeout(() => {
            setCopiedField(null);
          }, 2000);
        }
      } catch (err) {
        textArea.remove();
        console.error('Failed to copy:', err);
      }
    } catch (error) {
      console.error('Failed to copy to clipboard', error);
    }
  };

  const updateQueryParams = (updates: Record<string, string | undefined>) => {
    const next = applyScopedSearchParams(searchParams, Object.values(ASSET_QUERY_KEYS), updates);
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    const normalized = createScopedSearchParams(searchParams, Object.values(ASSET_QUERY_KEYS));

    if (normalized.toString() !== searchParams.toString()) {
      setSearchParams(normalized, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const nextFromDate = fromQueryDate(searchParams.get(ASSET_QUERY_KEYS.start));
    const nextToDate = fromQueryDate(searchParams.get(ASSET_QUERY_KEYS.end));
    const nextCategory = parseCategoryFilter(searchParams.get(ASSET_QUERY_KEYS.category));
    const nextStatus = parseStatusFilter(searchParams.get(ASSET_QUERY_KEYS.status));

    setFromDate(nextFromDate);
    setToDate(nextToDate);
    setFilterCategory(nextCategory);
    setFilterStatus(nextStatus);
    setAppliedFromDate(nextFromDate);
    setAppliedToDate(nextToDate);
    setAppliedFilterCategory(nextCategory);
    setAppliedFilterStatus(nextStatus);
    setCurrentPage(parsePage(searchParams.get(ASSET_QUERY_KEYS.page)));
  }, [searchParams]);

  const getStatusColor = (status: TransactionStatus) => {
    switch (status) {
      case 'Completed':
        return 'bg-[#00FF94]/10 border-[#00FF94]/30 text-[#00FF94]';
      case 'Pending':
        return 'bg-[#FFB800]/10 border-[#FFB800]/30 text-[#FFB800]';
      case 'Failed':
        return 'bg-red-500/10 border-red-500/30 text-red-400';
      default:
        return 'bg-gray-500/10 border-gray-500/30 text-gray-400';
    }
  };

  const getStatusDotColor = (status: TransactionStatus) => {
    switch (status) {
      case 'Completed':
        return 'bg-[#00FF94]';
      case 'Pending':
        return 'bg-[#FFB800]';
      case 'Failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const shortenAddress = (address: string) => {
    if (address.length <= 8) return address;
    return `${address.slice(0, 4)}...${address.slice(-2)}`;
  };

  const shortenTxId = (txid: string) => {
    if (txid.length <= 8) return txid;
    return `${txid.slice(0, 4)}...${txid.slice(-2)}`;
  };

  const getTxExplorerUrl = (network: string, txid: string) => {
    if (!txid || txid === '-') {
      return null;
    }

    const normalizedNetwork = normalizeNetworkCode(network).toUpperCase();

    if (
      normalizedNetwork === 'ETH' ||
      normalizedNetwork === 'ETHEREUM' ||
      normalizedNetwork === 'ERC20'
    ) {
      return `https://etherscan.io/tx/${txid}`;
    }

    if (normalizedNetwork === 'BSC' || normalizedNetwork === 'BEP20') {
      return `https://bscscan.com/tx/${txid}`;
    }

    if (
      normalizedNetwork === 'POL' ||
      normalizedNetwork === 'POLYGON' ||
      normalizedNetwork === 'MATIC'
    ) {
      return `https://polygonscan.com/tx/${txid}`;
    }

    if (normalizedNetwork === 'SOLANA' || normalizedNetwork === 'SOL') {
      return `https://solscan.io/tx/${txid}`;
    }

    if (normalizedNetwork === 'APT' || normalizedNetwork === 'APTOS') {
      return `https://explorer.aptoslabs.com/txn/${txid}`;
    }

    if (normalizedNetwork === 'TRC20' || normalizedNetwork === 'TRON') {
      return `https://tronscan.org/#/transaction/${txid}`;
    }

    return null;
  };

  const handleFromDateChange = (value: string) => {
    if (toDate && value && value > toDate) {
      return;
    }

    setFromDate(value);
    setAppliedFromDate(value);
    setCurrentPage(1);
    updateQueryParams({
      [ASSET_QUERY_KEYS.start]: toApiDate(value),
      [ASSET_QUERY_KEYS.end]: toApiDate(toDate),
      [ASSET_QUERY_KEYS.category]:
        filterCategory !== 'All Transactions' ? filterCategory : undefined,
      [ASSET_QUERY_KEYS.status]: filterStatus !== 'All' ? filterStatus : undefined,
      [ASSET_QUERY_KEYS.page]: '1',
    });
  };

  const handleToDateChange = (value: string) => {
    if (fromDate && value && value < fromDate) {
      return;
    }

    setToDate(value);
    setAppliedToDate(value);
    setCurrentPage(1);
    updateQueryParams({
      [ASSET_QUERY_KEYS.start]: toApiDate(fromDate),
      [ASSET_QUERY_KEYS.end]: toApiDate(value),
      [ASSET_QUERY_KEYS.category]:
        filterCategory !== 'All Transactions' ? filterCategory : undefined,
      [ASSET_QUERY_KEYS.status]: filterStatus !== 'All' ? filterStatus : undefined,
      [ASSET_QUERY_KEYS.page]: '1',
    });
  };

  const handleCategoryChange = (value: TransactionCategoryFilter) => {
    setFilterCategory(value);
    setAppliedFilterCategory(value);
    setCurrentPage(1);
    updateQueryParams({
      [ASSET_QUERY_KEYS.start]: toApiDate(fromDate),
      [ASSET_QUERY_KEYS.end]: toApiDate(toDate),
      [ASSET_QUERY_KEYS.category]: value !== 'All Transactions' ? value : undefined,
      [ASSET_QUERY_KEYS.status]: filterStatus !== 'All' ? filterStatus : undefined,
      [ASSET_QUERY_KEYS.page]: '1',
    });
  };

  const handleStatusChange = (value: TransactionStatusFilter) => {
    setFilterStatus(value);
    setAppliedFilterStatus(value);
    setCurrentPage(1);
    updateQueryParams({
      [ASSET_QUERY_KEYS.start]: toApiDate(fromDate),
      [ASSET_QUERY_KEYS.end]: toApiDate(toDate),
      [ASSET_QUERY_KEYS.category]:
        filterCategory !== 'All Transactions' ? filterCategory : undefined,
      [ASSET_QUERY_KEYS.status]: value !== 'All' ? value : undefined,
      [ASSET_QUERY_KEYS.page]: '1',
    });
  };

  const handleReset = () => {
    setFromDate('');
    setToDate('');
    setFilterCategory('All Transactions');
    setFilterStatus('All');
    setAppliedFromDate('');
    setAppliedToDate('');
    setAppliedFilterCategory('All Transactions');
    setAppliedFilterStatus('All');
    setCurrentPage(1);
    updateQueryParams({
      [ASSET_QUERY_KEYS.start]: undefined,
      [ASSET_QUERY_KEYS.end]: undefined,
      [ASSET_QUERY_KEYS.category]: undefined,
      [ASSET_QUERY_KEYS.status]: undefined,
      [ASSET_QUERY_KEYS.page]: '1',
    });
  };

  const validateDepositAmount = (amount: string) => {
    if (!amount) {
      setDepositAmountError(text.errDepositRequired);
      return false;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setDepositAmountError(text.errDepositPositive);
      return false;
    }

    const minDeposit = 10;
    if (numAmount < minDeposit) {
      setDepositAmountError(formatAssetTranslation(text.errDepositMinimum, { min: minDeposit }));
      return false;
    }

    setDepositAmountError('');
    return true;
  };

  const resetDepositForm = () => {
    setDepositAmount('');
    setDepositAmountError('');
    setDepositTxId('');
    setDepositTxIdError('');
    setDepositRequestError('');
  };

  const resetWithdrawForm = () => {
    setWithdrawAddress('');
    setWithdrawAmount('');
    setAddressError('');
    setAmountError('');
    setWithdrawRequestError('');
    setEmailCode('');
    setAuthenticatorCode('');
    setEmailCodeError('');
    setAuthenticatorCodeError('');
    setEmailCodeSent(false);
    setEmailCodeTimer(0);
  };

  const handleCloseKycActionModal = () => {
    setKycActionModal(null);
  };

  const handleConfirmKycActionModal = () => {
    const shouldNavigateToKyc = kycActionModal?.shouldNavigateToKyc;
    setKycActionModal(null);

    if (shouldNavigateToKyc) {
      navigate('/my-page/kyc');
    }
  };

  const handleOpenWithdrawModal = async () => {
    if (isCheckingKycStatus) {
      return;
    }

    try {
      setIsCheckingKycStatus(true);
      const kycStatusResponse = await getKycStatus();

      if (kycStatusResponse.status !== 'APPROVED') {
        setKycActionModal({
          title: text.kycRequiredTitle,
          subtitle: text.kycRequiredSubtitle,
          message: text.kycRequiredMessage,
          importantMessage: text.kycRequiredImportant,
          confirmLabel: text.goToKyc,
          shouldNavigateToKyc: true,
        });
        return;
      }

      const { data: refreshedAssetSummary } = await refetchMyAssetSummary();

      if (refreshedAssetSummary) {
        syncAssetBalances(refreshedAssetSummary);
      }

      setShowWithdrawModal(true);
    } catch {
      setKycActionModal({
        title: text.unablePrepareWithdrawalTitle,
        subtitle: text.unablePrepareWithdrawalSubtitle,
        message: text.unablePrepareWithdrawalMessage,
        confirmLabel: text.close,
        shouldNavigateToKyc: false,
      });
    } finally {
      setIsCheckingKycStatus(false);
    }
  };

  const depositMutation = useMutation({
    mutationFn: createDeposit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: walletsQueryKeys.all });
      resetDepositForm();
      setShowDepositModal(false);
      setShowDepositSuccess(true);

      setTimeout(() => {
        setShowDepositSuccess(false);
      }, 4000);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : text.depositRequestFailed;
      setDepositRequestError(message);
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: createWithdraw,
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: walletsQueryKeys.all });
      handleWithdrawSuccess();

      const { data: refreshedAssetSummary } = await refetchMyAssetSummary();
      if (refreshedAssetSummary) {
        syncAssetBalances(refreshedAssetSummary);
      }
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : text.withdrawRequestFailed;
      setWithdrawRequestError(message);
    },
  });

  const transferMutation = useMutation({
    mutationFn: createTransfer,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: walletsQueryKeys.all });
      if (variables.direction === 'TO_PERSONAL') {
        setTotalAsset((prev) => prev - variables.amount);
        setTradingAccountAsset((prev) => prev + variables.amount);
      } else {
        setTradingAccountAsset((prev) => prev - variables.amount);
        setTotalAsset((prev) => prev + variables.amount);
      }

      setShowTransferModal(false);
      setShowTransferSuccess(true);
      setTransferAmount('');
      setTransferError('');
      setTransferRequestError('');

      setTimeout(() => {
        setShowTransferSuccess(false);
      }, 3000);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : text.transferRequestFailed;
      setTransferRequestError(message);
    },
  });

  const sendWithdrawEmailCodeMutation = useMutation({
    mutationFn: sendVerificationEmail,
    onError: (error) => {
      const message = error instanceof Error ? error.message : text.sendEmailCodeFailed;
      setWithdrawRequestError(message);
    },
  });

  const submitWithdrawRequest = () => {
    withdrawMutation.mutate({
      amount: Number(withdrawAmount),
      network: withdrawNetwork,
      wallet_address: withdrawAddress.trim(),
      verification_code: requiresEmailVerification ? emailCode.trim() : undefined,
      totp_code: requiresAuthenticatorVerification ? authenticatorCode.trim() : undefined,
    });
  };

  const handleWithdrawSuccess = () => {
    resetWithdrawForm();
    setShowSecurityVerification(false);
    setShowWithdrawModal(false);
    setShowWithdrawSuccess(true);

    setTimeout(() => {
      setShowWithdrawSuccess(false);
    }, 4000);
  };

  const handleDepositSubmit = () => {
    if (depositMutation.isPending) {
      return;
    }

    if (!depositNetwork) {
      setDepositRequestError(text.noDepositNetworkAvailable);
      return;
    }

    if (!depositAddress) {
      setDepositRequestError(text.selectedNetworkNoDepositAddress);
      return;
    }

    // Validate deposit amount
    const isAmountValid = validateDepositAmount(depositAmount);
    if (!isAmountValid) {
      return;
    }

    // Validate TxID
    if (!depositTxId.trim()) {
      setDepositTxIdError(text.errTxidRequired);
      return;
    }

    setDepositRequestError('');
    depositMutation.mutate({
      amount: Number(depositAmount),
      tx_hash: depositTxId.trim(),
      network: depositNetwork,
    });
  };

  const validateAddress = (address: string, network: string) => {
    const normalizedNetwork = normalizeNetworkCode(network).toUpperCase();

    if (!address) {
      setAddressError(text.errAddressRequired);
      return false;
    }

    if (normalizedNetwork === 'ETH' || normalizedNetwork === 'ERC20') {
      if (!isEvmAddress(address)) {
        setAddressError(text.errAddressErc20);
        return false;
      }
    } else if (normalizedNetwork === 'BSC' || normalizedNetwork === 'BEP20') {
      if (!isEvmAddress(address)) {
        setAddressError(text.errAddressErc20);
        return false;
      }
    } else if (normalizedNetwork === 'POL' || normalizedNetwork === 'POLYGON') {
      if (!isEvmAddress(address)) {
        setAddressError(text.errAddressPolygon);
        return false;
      }
    } else if (normalizedNetwork === 'TRC20' || normalizedNetwork === 'TRON') {
      if (!address.startsWith('T') || address.length !== 34) {
        setAddressError(text.errAddressTrc20);
        return false;
      }
    }

    setAddressError('');
    return true;
  };

  const validateAmount = (amount: string) => {
    if (!amount) {
      setAmountError(text.errAmountRequired);
      return false;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setAmountError(text.errAmountPositive);
      return false;
    }

    if (numAmount > totalAsset) {
      setAmountError(text.errInsufficientBalance);
      return false;
    }

    const minWithdraw = 10;
    if (numAmount < minWithdraw) {
      setAmountError(formatAssetTranslation(text.errWithdrawMinimum, { min: minWithdraw }));
      return false;
    }

    setAmountError('');
    return true;
  };

  const getNetworkFee = (network: string) => {
    const normalizedNetwork = normalizeNetworkCode(network);
    return networkOptions.find(
      (option) =>
        option.value === network || normalizeNetworkCode(option.value) === normalizedNetwork,
    )?.fee;
  };

  const handleWithdrawSubmit = () => {
    if (!withdrawNetwork || getNetworkFee(withdrawNetwork) === undefined) {
      setWithdrawRequestError(text.noWithdrawalNetworkAvailable);
      return;
    }

    const isAddressValid = validateAddress(withdrawAddress, withdrawNetwork);
    const isAmountValid = validateAmount(withdrawAmount);

    if (isAddressValid && isAmountValid) {
      if (ENABLE_WITHDRAW_SECURITY_MODAL && shouldUseWithdrawSecurityModal) {
        setShowSecurityVerification(true);
        return;
      }

      submitWithdrawRequest();
    }
  };

  const handleSendEmailCode = () => {
    if (sendWithdrawEmailCodeMutation.isPending || emailCodeSent) {
      return;
    }

    if (!me?.email) {
      setWithdrawRequestError(text.emailMissing);
      return;
    }

    setWithdrawRequestError('');
    sendWithdrawEmailCodeMutation.mutate(
      {
        email: me.email,
        purpose: 'WITHDRAW_REQUEST',
      },
      {
        onSuccess: () => {
          setEmailCodeSent(true);
          setEmailCodeTimer(60);

          const interval = setInterval(() => {
            setEmailCodeTimer((prev) => {
              if (prev <= 1) {
                clearInterval(interval);
                setEmailCodeSent(false);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        },
      },
    );
  };

  const handleConfirmWithdrawal = () => {
    if (withdrawMutation.isPending) {
      return;
    }

    // Reset errors
    setEmailCodeError('');
    setAuthenticatorCodeError('');
    setWithdrawRequestError('');

    // Validate email code
    if (requiresEmailVerification) {
      if (!emailCode) {
        setEmailCodeError(text.errEmailCodeRequired);
        return;
      }
      if (emailCode.length !== 6 || !/^\d{6}$/.test(emailCode)) {
        setEmailCodeError(text.errEmailCodeInvalid);
        return;
      }
    }

    // Validate authenticator code
    if (requiresAuthenticatorVerification) {
      if (!authenticatorCode) {
        setAuthenticatorCodeError(text.errAuthCodeRequired);
        return;
      }
      if (authenticatorCode.length !== 6 || !/^\d{6}$/.test(authenticatorCode)) {
        setAuthenticatorCodeError(text.errAuthCodeInvalid);
        return;
      }
    }

    submitWithdrawRequest();
  };

  const handleMaxAmount = () => {
    const fee = getNetworkFee(withdrawNetwork);

    if (fee === undefined) {
      setWithdrawRequestError(text.noWithdrawalNetworkAvailable);
      return;
    }

    const maxAmount = totalAsset - fee;
    setWithdrawAmount(maxAmount > 0 ? maxAmount.toFixed(2) : '0');
    validateAmount(maxAmount.toFixed(2));
  };

  const withdrawAmountNum = parseFloat(withdrawAmount) || 0;
  const currentFee = getNetworkFee(withdrawNetwork) ?? 0;
  const totalToReceive = Math.max(0, withdrawAmountNum - currentFee);

  // Transfer functions
  const getAvailableTransferBalance = () => {
    return transferFrom === 'Total Asset' ? totalAsset : tradingAccountAsset;
  };

  const hasLiveAccount = (summary: typeof myAssetSummary) =>
    Boolean(summary?.live_accounts?.some((account) => account.account_id));

  const handleOpenTransferModal = async () => {
    if (isCheckingLiveAccount) {
      return;
    }

    setIsCheckingLiveAccount(true);

    try {
      const refreshedAssetSummary = await refetchMyAssetSummary();
      const latestAssetSummary = refreshedAssetSummary.data ?? myAssetSummary;

      if (!hasLiveAccount(latestAssetSummary)) {
        setShowLiveAccountRequiredModal(true);
        return;
      }

      if (latestAssetSummary) {
        syncAssetBalances(latestAssetSummary);
      }

      setShowTransferModal(true);
    } finally {
      setIsCheckingLiveAccount(false);
    }
  };

  const validateTransferAmount = (amount: string) => {
    if (!amount) {
      setTransferError(text.errTransferRequired);
      return false;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setTransferError(text.errTransferPositive);
      return false;
    }

    const availableBalance = getAvailableTransferBalance();
    if (numAmount > availableBalance) {
      setTransferError(text.errTransferInsufficient);
      return false;
    }

    const minTransfer = 1;
    if (numAmount < minTransfer) {
      setTransferError(formatAssetTranslation(text.errTransferMinimum, { min: minTransfer }));
      return false;
    }

    setTransferError('');
    return true;
  };

  const handleTransferMaxAmount = () => {
    const maxAmount = getAvailableTransferBalance();
    setTransferAmount(maxAmount.toFixed(2));
    validateTransferAmount(maxAmount.toFixed(2));
    setTransferRequestError('');
  };

  const handleFromChange = (value: 'Total Asset' | 'Live Trading Account') => {
    setTransferFrom(value);
    // Auto-switch "To" field if same as "From"
    if (value === transferTo) {
      setTransferTo(value === 'Total Asset' ? 'Live Trading Account' : 'Total Asset');
    }
    setTransferAmount('');
    setTransferError('');
    setTransferRequestError('');
  };

  const handleToChange = (value: 'Total Asset' | 'Live Trading Account') => {
    setTransferTo(value);
    // Auto-switch "From" field if same as "To"
    if (value === transferFrom) {
      setTransferFrom(value === 'Total Asset' ? 'Live Trading Account' : 'Total Asset');
    }
    setTransferAmount('');
    setTransferError('');
    setTransferRequestError('');
  };

  const handleTransferSubmit = () => {
    if (transferMutation.isPending) {
      return;
    }

    const isValid = validateTransferAmount(transferAmount);
    const accountId = myAssetSummary?.live_accounts?.[0]?.account_id;

    if (!isValid) {
      return;
    }

    if (!accountId) {
      setTransferRequestError(text.liveAccountInfoMissing);
      return;
    }

    setTransferRequestError('');
    transferMutation.mutate({
      direction: transferFrom === 'Total Asset' ? 'TO_PERSONAL' : 'TO_INTEGRATED',
      amount: parseFloat(transferAmount),
      account_id: accountId,
    });
  };

  const transferAmountNum = parseFloat(transferAmount) || 0;

  const serverTotalPages = walletTransactionsResponse?.pages;
  const totalPages = Math.max(1, serverTotalPages ?? currentPage);

  useEffect(() => {
    if (walletTransactionsFetching || serverTotalPages === undefined) {
      return;
    }

    const normalizedTotalPages = Math.max(1, serverTotalPages);
    if (currentPage > normalizedTotalPages) {
      setCurrentPage(normalizedTotalPages);
      updateQueryParams({
        [ASSET_QUERY_KEYS.start]: toApiDate(appliedFromDate),
        [ASSET_QUERY_KEYS.end]: toApiDate(appliedToDate),
        [ASSET_QUERY_KEYS.category]:
          appliedFilterCategory !== 'All Transactions' ? appliedFilterCategory : undefined,
        [ASSET_QUERY_KEYS.status]: appliedFilterStatus !== 'All' ? appliedFilterStatus : undefined,
        [ASSET_QUERY_KEYS.page]: String(normalizedTotalPages),
      });
    }
  }, [
    appliedFilterCategory,
    appliedFilterStatus,
    appliedFromDate,
    appliedToDate,
    currentPage,
    serverTotalPages,
    walletTransactionsFetching,
  ]);

  // Helper function to get badge color based on transaction category and type
  const getTypeBadgeColor = (category: 'deposit' | 'withdraw' | undefined, type: string) => {
    if (category === 'deposit') {
      // Green tones for deposits
      switch (type) {
        case 'Reward':
          return 'bg-[#00FF94]/10 border-[#00FF94]/30 text-[#00FF94]';
        case 'Payout':
          return 'bg-[#4ECDC4]/10 border-[#4ECDC4]/30 text-[#4ECDC4]';
        case 'External Wallet':
          return 'bg-[#00D4AA]/10 border-[#00D4AA]/30 text-[#00D4AA]';
        case 'Live Trading Account':
          return 'bg-[#00BFA6]/10 border-[#00BFA6]/30 text-[#00BFA6]';
        default:
          return 'bg-[#00FF94]/10 border-[#00FF94]/30 text-[#00FF94]';
      }
    } else {
      // Orange/Red tones for withdrawals
      switch (type) {
        case 'External Wallet':
          return 'bg-[#FFB800]/10 border-[#FFB800]/30 text-[#FFB800]';
        case 'Live Trading Account':
          return 'bg-[#FF8C42]/10 border-[#FF8C42]/30 text-[#FF8C42]';
        default:
          return 'bg-[#FFB800]/10 border-[#FFB800]/30 text-[#FFB800]';
      }
    }
  };

  const getDisplayTxTypeLabel = (type: string) => {
    switch (type) {
      case 'Reward':
        return text.typeReward;
      case 'External Wallet':
        return text.typeExternalWallet;
      case 'Payout':
        return text.typePayout;
      case 'Live Trading Account':
        return text.typeLiveTrading;
      case 'Challenge Purchase':
        return text.typeChallengePurchase;
      default:
        return type;
    }
  };

  const getDisplayStatusLabel = (status: TransactionStatus) => getStatusFilterLabel(status, text);

  const getDepositDisplayAmount = (transaction: UnifiedTransactionRow) =>
    transaction.depositAmount ??
    (transaction.transactionCategory === 'deposit' ? transaction.amount : undefined);

  const getWithdrawDisplayAmount = (transaction: UnifiedTransactionRow) =>
    transaction.withdrawAmount ??
    (transaction.transactionCategory === 'withdraw' ? transaction.amount : undefined);

  const assetHistoryColumns: Column<UnifiedTransactionRow>[] = [
    {
      header: text.colDate,
      accessor: (transaction) => (
        <span className="text-white text-sm whitespace-nowrap">{transaction.date}</span>
      ),
      className: 'whitespace-nowrap',
    },
    {
      header: text.colType,
      accessor: (transaction) =>
        (() => {
          const resolvedCategory =
            transaction.transactionCategory ??
            (transaction.withdrawAmount !== undefined ? 'withdraw' : 'deposit');

          return (
            <span
              className={`inline-flex items-center px-2.5 py-1 border rounded-md text-xs font-medium ${getTypeBadgeColor(resolvedCategory, transaction.displayTxType)}`}
            >
              {getDisplayTxTypeLabel(transaction.displayTxType)}
            </span>
          );
        })(),
      className: 'w-[80px] whitespace-nowrap',
    },
    {
      header: text.colDeposit,
      accessor: (transaction) =>
        (() => {
          const depositAmount = getDepositDisplayAmount(transaction);

          return depositAmount !== undefined ? (
            <div className="text-right">
              <p className="text-[#00FF94] text-sm font-semibold">
                +$
                {depositAmount.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                })}
              </p>
              <p className="text-gray-500 text-xs">USDT</p>
            </div>
          ) : (
            <span className="text-gray-600">-</span>
          );
      })(),
      align: 'right',
      className: 'min-w-[120px] whitespace-nowrap',
    },
    {
      header: (
        <span className="inline-flex flex-col items-end">
          <span>{text.colWithdraw}</span>
          <span className="whitespace-nowrap text-right text-[9px] font-normal normal-case leading-tight tracking-normal text-gray-500">
            {text.colWithdrawSub}
          </span>
        </span>
      ),
      accessor: (transaction) =>
        (() => {
          const withdrawAmount = getWithdrawDisplayAmount(transaction);
          const showExternalWalletBreakdown =
            transaction.displayTxType === 'External Wallet' &&
            transaction.txType === 'WITHDRAW' &&
            transaction.fee !== undefined;

          return withdrawAmount !== undefined ? (
            <div className="text-right">
              <p className="text-red-400 text-sm font-semibold">
                -$
                {withdrawAmount.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              {showExternalWalletBreakdown ? (
                <p className="text-gray-500 text-xs">
                  (-
                  {transaction.fee!.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  / -
                  {(withdrawAmount - transaction.fee!).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                  )
                </p>
              ) : (
                <p className="text-gray-500 text-xs">USDT</p>
              )}
            </div>
          ) : (
            <span className="text-gray-600">-</span>
          );
        })(),
      align: 'right',
      className: 'min-w-[204px] whitespace-nowrap',
    },
    {
      header: text.colAddress,
      accessor: (transaction, index) => {
        const hasAddress = Boolean(transaction.address && transaction.address !== '-');

        return hasAddress ? (
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs font-mono">
              {shortenAddress(transaction.address)}
            </span>
            <button
              onClick={() => handleCopy(transaction.address, `address-${index}`)}
              className="text-gray-500 hover:text-[#0052FF] transition-colors"
            >
              {copiedField === `address-${index}` ? (
                <Check size={14} className="text-[#00FF94]" />
              ) : (
                <Copy size={14} />
              )}
            </button>
          </div>
        ) : (
          <span className="text-gray-600 text-center block">-</span>
        );
      },
      className: 'w-[96px] whitespace-nowrap',
    },
    {
      header: text.colNetwork,
      accessor: (transaction) => {
        const hasNetwork =
          transaction.displayTxType === 'External Wallet' && transaction.network !== '-';

        return hasNetwork ? (
          <span className="inline-flex items-center px-2.5 py-1 bg-[#1a1a24] border border-[#2a2a3a] rounded-md text-white text-xs font-medium">
            {transaction.network}
          </span>
        ) : (
          <span className="text-gray-600 text-center block">-</span>
        );
      },
      className: 'w-[88px] whitespace-nowrap',
    },
    {
      header: text.colTxid,
      accessor: (transaction, index) => {
        const hasTxid = Boolean(transaction.txid && transaction.txid !== '-');
        const txExplorerUrl = hasTxid
          ? getTxExplorerUrl(transaction.network, transaction.txid)
          : null;

        return hasTxid ? (
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs font-mono">{shortenTxId(transaction.txid)}</span>
            <button
              onClick={() => handleCopy(transaction.txid, `txid-${index}`)}
              className="text-gray-500 hover:text-[#0052FF] transition-colors"
            >
              {copiedField === `txid-${index}` ? (
                <Check size={14} className="text-[#00FF94]" />
              ) : (
                <Copy size={14} />
              )}
            </button>
            {txExplorerUrl ? (
              <a
                href={txExplorerUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-gray-500 hover:text-[#0052FF] transition-colors"
              >
                <ExternalLink size={14} />
              </a>
            ) : null}
          </div>
        ) : (
          <span className="text-gray-600 text-center block">-</span>
        );
      },
      className: 'w-[108px] whitespace-nowrap',
    },
    {
      header: text.colStatus,
      accessor: (transaction) => (
        <div className="inline-flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 px-3 py-1.5 border rounded-lg text-xs font-medium ${getStatusColor(transaction.status)}`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(transaction.status)}`}
            ></span>
            {getDisplayStatusLabel(transaction.status)}
          </span>

          {transaction.status === 'Failed' && transaction.rejectReason && (
            <div className="relative inline-block">
              <div
                className="w-4 h-4 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center cursor-pointer hover:bg-red-500/20 transition-colors"
                onMouseEnter={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  setHoveredFailureTooltip({
                    reason: transaction.rejectReason ?? '',
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
                    if (prev?.interaction === 'tap' && prev.reason === transaction.rejectReason) {
                      return null;
                    }

                    return {
                      reason: transaction.rejectReason ?? '',
                      x: rect.left - 266,
                      y: rect.top + rect.height / 2,
                      interaction: 'tap',
                    };
                  });
                }}
              >
                <Info size={10} className="text-red-400" />
              </div>
            </div>
          )}
        </div>
      ),
      className: 'w-[104px] whitespace-nowrap',
    },
  ];

  const renderAssetHistoryMobileCard = (transaction: UnifiedTransactionRow, index: number) => (
    <motion.div
      key={`${transaction.date}-${transaction.displayTxType}-${index}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl border border-white/10 bg-[#0f0f17] p-4 space-y-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-white font-semibold">{getDisplayTxTypeLabel(transaction.displayTxType)}</p>
          <p className="text-gray-500 text-xs mt-1">{transaction.date}</p>
        </div>
        <div className="inline-flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 px-3 py-1.5 border rounded-lg text-xs font-medium ${getStatusColor(transaction.status)}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(transaction.status)}`} />
            {getDisplayStatusLabel(transaction.status)}
          </span>
          {transaction.status === 'Failed' && transaction.rejectReason && (
            <button
              type="button"
              className="w-4 h-4 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center cursor-pointer hover:bg-red-500/20 transition-colors"
              onClick={(event) => {
                event.stopPropagation();
                const rect = event.currentTarget.getBoundingClientRect();
                setHoveredFailureTooltip((prev) => {
                  if (prev?.interaction === 'tap' && prev.reason === transaction.rejectReason) {
                    return null;
                  }

                  return {
                    reason: transaction.rejectReason ?? '',
                    x: rect.left - 266,
                    y: rect.top + rect.height / 2,
                    interaction: 'tap',
                  };
                });
              }}
            >
              <Info size={10} className="text-red-400" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-white/5 p-3">
          <p className="text-gray-500 text-[11px] uppercase tracking-widest mb-1">{text.colDeposit}</p>
          <p className="text-white font-medium">
            {(() => {
              const depositAmount = getDepositDisplayAmount(transaction);

              return depositAmount !== undefined
                ? `+$${depositAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                : '-';
            })()}
          </p>
        </div>
        <div className="rounded-xl bg-white/5 p-3">
          <p className="text-gray-500 text-[11px] uppercase tracking-widest mb-1">{text.colWithdraw}</p>
          <p className="text-white font-medium">
            {(() => {
              const withdrawAmount = getWithdrawDisplayAmount(transaction);

              return withdrawAmount !== undefined
                ? `-$${withdrawAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                : '-';
            })()}
          </p>
        </div>
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-gray-500">{text.colAddress}</span>
          {transaction.address && transaction.address !== '-' ? (
            <div className="flex items-center gap-2">
              <span className="text-gray-300 font-mono text-xs">
                {shortenAddress(transaction.address)}
              </span>
              <button
                onClick={() => handleCopy(transaction.address, `mobile-address-${index}`)}
                className="text-gray-500 hover:text-[#0052FF] transition-colors"
              >
                {copiedField === `mobile-address-${index}` ? (
                  <Check size={14} className="text-[#00FF94]" />
                ) : (
                  <Copy size={14} />
                )}
              </button>
            </div>
          ) : (
            <span className="text-gray-600">-</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-gray-500">{text.colNetwork}</span>
          <span
            className={
              transaction.displayTxType === 'External Wallet' && transaction.network !== '-'
                ? 'text-gray-300'
                : 'text-gray-600'
            }
          >
            {transaction.displayTxType === 'External Wallet' && transaction.network !== '-'
              ? transaction.network
              : '-'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-gray-500">{text.colTxid}</span>
          {transaction.txid && transaction.txid !== '-' ? (
            <div className="flex items-center gap-2">
              <span className="text-gray-300 font-mono text-xs">
                {shortenTxId(transaction.txid)}
              </span>
              <button
                onClick={() => handleCopy(transaction.txid, `mobile-txid-${index}`)}
                className="text-gray-500 hover:text-[#0052FF] transition-colors"
              >
                {copiedField === `mobile-txid-${index}` ? (
                  <Check size={14} className="text-[#00FF94]" />
                ) : (
                  <Copy size={14} />
                )}
              </button>
              {getTxExplorerUrl(transaction.network, transaction.txid) ? (
                <a
                  href={getTxExplorerUrl(transaction.network, transaction.txid) ?? undefined}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-gray-500 hover:text-[#0052FF] transition-colors"
                >
                  <ExternalLink size={14} />
                </a>
              ) : null}
            </div>
          ) : (
            <span className="text-gray-600">-</span>
          )}
        </div>
      </div>
    </motion.div>
  );

  const handlePageChange = (page: number) => {
    const maxPage = Math.max(1, serverTotalPages ?? page);
    const nextPage = Math.max(1, Math.min(page, maxPage));
    setCurrentPage(nextPage);
    updateQueryParams({
      [ASSET_QUERY_KEYS.start]: toApiDate(appliedFromDate),
      [ASSET_QUERY_KEYS.end]: toApiDate(appliedToDate),
      [ASSET_QUERY_KEYS.category]:
        appliedFilterCategory !== 'All Transactions' ? appliedFilterCategory : undefined,
      [ASSET_QUERY_KEYS.status]: appliedFilterStatus !== 'All' ? appliedFilterStatus : undefined,
      [ASSET_QUERY_KEYS.page]: String(nextPage),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Deposit Success Notification */}
      <SuccessNotification
        isVisible={showDepositSuccess}
        title={text.depositSuccessTitle}
        message={text.depositSuccessBody}
        variant="compact"
        minWidth
      />

      {/* Withdraw Success Notification */}
      <SuccessNotification
        isVisible={showWithdrawSuccess}
        title={text.withdrawSuccessTitle}
        message={text.withdrawSuccessBody}
        variant="compact"
        minWidth
      />

      {/* Transfer Success Notification */}
      <SuccessNotification
        isVisible={showTransferSuccess}
        title={text.transferSuccessTitle}
        message={text.transferSuccessBody}
        variant="compact"
      />

      {kycActionModal && (
        <ActionRequiredModal
          isOpen
          title={kycActionModal.title}
          subtitle={kycActionModal.subtitle}
          message={kycActionModal.message}
          importantMessage={kycActionModal.importantMessage}
          confirmLabel={kycActionModal.confirmLabel}
          onConfirm={handleConfirmKycActionModal}
          onClose={handleCloseKycActionModal}
        />
      )}

      <ActionRequiredModal
        isOpen={showLiveAccountRequiredModal}
        title={text.liveAccountRequiredTitle}
        subtitle={text.liveAccountRequiredSubtitle}
        message={text.liveAccountRequiredMessage}
        importantTitle={text.goToMyAccount}
        importantMessage={text.liveAccountRequiredImportant}
        confirmLabel={text.ok}
        cancelLabel={text.cancel}
        onConfirm={() => {
          setShowLiveAccountRequiredModal(false);
          navigate('/my-page/my-account');
        }}
        onClose={() => setShowLiveAccountRequiredModal(false)}
      />

      {/* Total Asset (1115 디자인: 가로형 단일 카드) */}
      <div className="mb-8 w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="relative w-full overflow-hidden rounded-xl border border-[#0052FF]/30 bg-gradient-to-br from-[#0052FF] to-[#0041CC] p-5 sm:p-6"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-32 -mt-32"></div>

          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm">
                  <Wallet size={22} className="text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white/80">{text.totalAsset}</h3>
                  <p className="text-xs text-white/60">{text.availableForWithdrawal}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-3xl font-bold text-white sm:text-4xl">
                  $
                  {totalAsset.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span className="text-lg font-normal text-white/50 sm:text-xl">USDT</span>
              </div>
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row md:w-auto md:shrink-0">
              <button
                onClick={() => setShowDepositModal(true)}
                className="flex min-w-36 flex-1 items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 font-semibold text-[#0052FF] transition-all hover:bg-white/90 md:flex-none"
              >
                <ArrowDownLeft size={18} />
                <span>{text.deposit}</span>
              </button>
              <button
                onClick={() => void handleOpenWithdrawModal()}
                disabled={isCheckingKycStatus}
                className="flex min-w-36 flex-1 items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-5 py-3 font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20 md:flex-none"
              >
                <ArrowUpRight size={18} />
                <span>{isCheckingKycStatus ? text.checking : text.withdraw}</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/*
        Live 계정 생성 미지원으로 Live Trading Account 카드와 계좌 간 이체 버튼(데스크톱·모바일)을 숨김.
        추후 다시 표시할 수 있으므로 삭제하지 않는다. 다시 쓸 때는 아래 블록과 하단 Transfer Modal 주석을 해제하고,
        위 Total Asset 영역을 기존 2열 그리드(relative grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8)로 되돌린다.

        [Live Trading Account Card]
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-gradient-to-br from-[#00FF94] to-[#00CC75] border border-[#00FF94]/30 rounded-xl p-8 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-black/5 rounded-full blur-3xl -mr-32 -mt-32"></div>

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-lg bg-black/10 flex items-center justify-center backdrop-blur-sm">
                <TrendingUp size={24} className="text-[#0a0a0f]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[#0a0a0f] text-sm font-medium">{text.liveTrading}</h3>
                  <span className="inline-flex items-center px-2 py-0.5 bg-[#0052FF] rounded-full text-white text-[10px] font-bold uppercase">
                    {text.liveBadge}
                  </span>
                </div>
                <p className="text-[#0a0a0f]/60 text-xs">{text.mt4Mt5Balance}</p>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-[#0a0a0f] text-4xl font-bold">
                  $
                  {tradingAccountAsset.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span className="text-[#0a0a0f]/40 text-xl font-normal">USDT</span>
              </div>
            </div>

            <div className="bg-black/10 backdrop-blur-sm border border-black/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={16} className="text-[#0a0a0f]/70" />
                <p className="text-[#0a0a0f] text-xs font-semibold">{text.accountManagement}</p>
              </div>
              <p className="text-[#0a0a0f]/60 text-xs leading-relaxed">{text.accountManagementBody}</p>
            </div>
          </div>
        </motion.div>

        [Transfer Button - Centered between cards]
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 hidden lg:block"
        >
          <button
            onClick={handleOpenTransferModal}
            disabled={isCheckingLiveAccount}
            className="w-14 h-14 rounded-full bg-gradient-to-br from-[#0052FF] to-[#0041CC] border-4 border-[#0a0a0f] text-white shadow-2xl hover:shadow-[#0052FF]/50 hover:scale-110 transition-all duration-300 flex items-center justify-center group disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
          >
            <ArrowLeftRight
              size={24}
              className="group-hover:rotate-180 transition-transform duration-500"
            />
          </button>
        </motion.div>

      [Transfer Button Mobile - Below cards]
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="lg:hidden -mt-2 mb-8"
      >
        <button
          onClick={handleOpenTransferModal}
          disabled={isCheckingLiveAccount}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-[#0052FF] to-[#0041CC] text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-[#0052FF]/30 transition-all disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ArrowLeftRight size={20} />
          <span>{text.transferBetweenAccounts}</span>
        </button>
      </motion.div>

      */}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="mb-6"
      >
        <FilterCard
          title={text.searchAndFilter}
          icon={<Filter size={20} className="text-[#0052FF]" />}
          className="bg-[#0f0f17] border border-[#1a1a24] rounded-xl p-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2 grid grid-cols-2 gap-3">
              <FilterField label={text.fromDate}>
                <FilterDateInput
                  icon={
                    <Calendar
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                    />
                  }
                  value={fromDate}
                  max={toDate || undefined}
                  onChange={(e) => handleFromDateChange(e.target.value)}
                />
              </FilterField>

              <FilterField label={text.toDate}>
                <FilterDateInput
                  icon={
                    <Calendar
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                    />
                  }
                  value={toDate}
                  min={fromDate || undefined}
                  onChange={(e) => handleToDateChange(e.target.value)}
                />
              </FilterField>
            </div>

            <FilterField label={text.category}>
              <FilterSelect
                value={filterCategory}
                onChange={(e) => handleCategoryChange(e.target.value as TransactionCategoryFilter)}
                options={TRANSACTION_CATEGORY_FILTER_OPTIONS.map((option) => ({
                  label: getCategoryFilterLabel(option, text),
                  value: option,
                }))}
              />
            </FilterField>

            <FilterField label={text.status}>
              <FilterSelect
                value={filterStatus}
                onChange={(e) => handleStatusChange(e.target.value as TransactionStatusFilter)}
                options={[
                  { label: text.allStatus, value: 'All' },
                  { label: text.statusCompleted, value: 'Completed' },
                  { label: text.statusPending, value: 'Pending' },
                  { label: text.statusFailed, value: 'Failed' },
                ]}
              />
            </FilterField>
          </div>

          <FilterActions className="mt-4 flex justify-end">
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-[#1a1a24] text-gray-400 rounded-lg text-sm hover:bg-[#24243a] hover:text-white transition-colors"
            >
              {text.resetFilters}
            </button>
          </FilterActions>
        </FilterCard>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="bg-[#0f0f17] border border-[#1a1a24] rounded-xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-[#1a1a24] bg-[#1a1a24]">
          <h2 className="text-white text-lg font-semibold">{text.depositWithdrawHistory}</h2>
          <p className="text-gray-400 text-sm mt-1">{text.depositWithdrawHistorySub}</p>
        </div>

        <DataTable
          data={walletTransactionRows}
          columns={assetHistoryColumns}
          renderMobileCard={renderAssetHistoryMobileCard}
          desktopWrapperClassName="p-6"
          desktopScrollWrapperClassName="overflow-x-auto"
          desktopHeaderRowClassName="border-b border-[#1a1a24] bg-[#0f0f17]"
          desktopHeaderCellClassName="px-4 py-4 text-xs font-medium uppercase tracking-wider text-gray-400"
          desktopCellClassName="px-4 py-4"
          desktopEmptyCellClassName="px-4 py-12 text-center text-gray-500 text-sm"
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          itemsPerPage={itemsPerPage}
          totalItems={walletTransactionsResponse?.total ?? walletTransactionRows.length}
          keyExtractor={(item) => item.id}
          emptyMessage={text.noTransactionHistory}
          summaryLabel={text.transactions}
          endOfResultsLabel={text.endOfAssetHistory}
          previousLabel={text.previous}
          nextLabel={text.next}
          showingRangeLabel={text.showingAssetRange}
          isLoading={walletTransactionsLoading || walletTransactionsFetching}
        />
      </motion.div>

      {/* Deposit Modal - Matching RewardPage style */}
      <AnimatePresence>
        {showDepositModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
              onClick={() => {
                setShowDepositModal(false);
                resetDepositForm();
              }}
            />

            {/* Modal */}
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="bg-[#0f0f17] border border-[#1a1a24] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="sticky top-0 bg-[#0f0f17] border-b border-[#1a1a24] px-8 py-6 flex items-center justify-between z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-[#0052FF]/10 flex items-center justify-center">
                      <ArrowDownLeft size={24} className="text-[#0052FF]" />
                    </div>
                    <div>
                      <h2 className="text-white text-2xl font-semibold">{text.depositUsdt}</h2>
                      <p className="text-gray-400 text-sm">{text.depositUsdtSub}</p>
                    </div>
                  </div>
                  <button
                    className="w-10 h-10 rounded-lg bg-[#1a1a24] hover:bg-[#2a2a3a] text-gray-400 hover:text-white transition-colors flex items-center justify-center"
                    onClick={() => {
                      setShowDepositModal(false);
                      resetDepositForm();
                    }}
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Content */}
                <div className="px-8 py-6">
                  {/* Deposit Amount */}
                  <div className="mb-6">
                    <label className="block text-white text-sm font-semibold mb-3">
                      {text.depositAmount} <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={depositAmount}
                        onChange={(e) => {
                          const value = e.target.value;
                          // Only allow numbers and one decimal point
                          if (value === '' || /^\d*\.?\d*$/.test(value)) {
                            setDepositAmount(value);
                            setDepositAmountError('');
                            setDepositRequestError('');
                          }
                        }}
                        onBlur={() => validateDepositAmount(depositAmount)}
                        placeholder={text.depositAmountPlaceholder}
                        className={`w-full px-4 py-4 pr-16 bg-[#1a1a24] text-white rounded-xl border ${
                          depositAmountError ? 'border-red-500' : 'border-[#2a2a3a]'
                        } text-sm focus:outline-none focus:border-[#0052FF] transition-colors placeholder:text-gray-500`}
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-[#0052FF]/10 border border-[#0052FF]/30 rounded-md">
                        <span className="text-[#0052FF] text-xs font-semibold">USDT</span>
                      </div>
                    </div>
                    {depositAmountError ? (
                      <div className="flex items-center gap-1 text-red-400 text-xs mt-2">
                        <AlertCircle size={12} />
                        <span>{depositAmountError}</span>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-xs mt-2">{text.depositMinimum}</p>
                    )}
                  </div>

                  {/* Network Selection */}
                  <div className="mb-6">
                    <label className="block text-white text-sm font-semibold mb-3">
                      {text.selectNetwork}
                    </label>
                    <select
                      value={depositNetwork}
                      disabled={networkOptions.length === 0}
                      onChange={(e) => {
                        setDepositNetwork(e.target.value);
                        setDepositRequestError('');
                      }}
                      className="w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#0052FF] transition-colors appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 0.75rem center',
                        backgroundSize: '12px',
                      }}
                    >
                      {networkOptions.length === 0 && (
                        <option value="">{networkAvailabilityMessage}</option>
                      )}
                      {networkOptions.map((network) => (
                        <option key={network.value} value={network.value}>
                          {network.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* QR Code */}
                  <div className="mb-6">
                    <label className="block text-white text-sm font-semibold mb-3">
                      {text.scanQrCode}
                    </label>
                    <div className="flex justify-center p-8 bg-white rounded-xl">
                      {depositQrCode ? (
                        <img
                          src={depositQrCode}
                          alt={formatAssetTranslation(text.depositQrAlt, { network: depositNetwork })}
                          className="h-[220px] w-[220px]"
                        />
                      ) : (
                        <div className="flex h-[220px] w-[220px] items-center justify-center rounded-lg border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
                          {text.selectSupportedNetworkQr}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Deposit Address */}
                  <div className="mb-6">
                    <label className="block text-white text-sm font-semibold mb-3">
                      {text.depositAddress}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={depositAddress}
                        readOnly
                        className="w-full px-4 py-4 bg-[#1a1a24] text-white rounded-xl border border-[#2a2a3a] text-sm focus:outline-none pr-12 font-mono"
                      />
                      <button
                        onClick={() => handleCopy(depositAddress, 'deposit-address')}
                        disabled={!depositAddress}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0052FF] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {copiedField === 'deposit-address' ? (
                          <Check size={18} className="text-[#00FF94]" />
                        ) : (
                          <Copy size={18} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Transaction ID (TxID) - Mandatory */}
                  <div className="mb-6">
                    <label className="block text-white text-sm font-semibold mb-3">
                      {text.transactionId} <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={depositTxId}
                        onChange={(e) => {
                          setDepositTxId(e.target.value);
                          setDepositTxIdError('');
                          setDepositRequestError('');
                        }}
                        placeholder={text.txidPlaceholder}
                        className={`w-full px-4 py-4 bg-[#1a1a24] text-white rounded-xl border ${
                          depositTxIdError ? 'border-red-500' : 'border-[#2a2a3a]'
                        } text-sm focus:outline-none focus:border-[#0052FF] transition-colors font-mono placeholder:text-gray-500`}
                      />
                    </div>
                    {depositTxIdError ? (
                      <div className="flex items-center gap-1 text-red-400 text-xs mt-2">
                        <AlertCircle size={12} />
                        <span>{depositTxIdError}</span>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-xs mt-2">
                        {text.txidHint}
                      </p>
                    )}
                  </div>

                  {/* Warning Alert */}
                  <div className="bg-[#FFB800]/5 border border-[#FFB800]/20 rounded-xl p-4">
                    <div className="flex gap-3">
                      <AlertCircle size={20} className="text-[#FFB800] flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-white text-sm font-medium mb-1">{text.importantInfo}</p>
                        <ul className="text-gray-400 text-xs space-y-1">
                          <li>
                            •{' '}
                            {formatAssetTranslation(text.depositInfo1, {
                              network: depositNetwork,
                            })}
                          </li>
                          <li>• {text.depositInfo2}</li>
                          <li>• {text.depositInfo3}</li>
                          <li>• {text.depositInfo4}</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {depositRequestError && (
                    <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-300 text-sm">
                      <AlertCircle size={16} />
                      <span>{depositRequestError}</span>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="sticky bottom-0 bg-[#0f0f17] border-t border-[#1a1a24] px-8 py-6 flex items-center gap-4">
                  <button
                    className="flex-1 px-6 py-4 bg-[#1a1a24] text-white rounded-xl font-medium hover:bg-[#2a2a3a] transition-colors"
                    onClick={() => {
                      setShowDepositModal(false);
                      resetDepositForm();
                    }}
                  >
                    {text.cancel}
                  </button>
                  <button
                    className={`flex-1 px-6 py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                      !depositAmount ||
                      parseFloat(depositAmount) < 10 ||
                      depositMutation.isPending ||
                      !depositNetwork ||
                      !depositAddress
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-[#0052FF] text-white hover:bg-[#0052FF]/90 hover:shadow-lg hover:shadow-[#0052FF]/30'
                    }`}
                    onClick={handleDepositSubmit}
                    disabled={
                      !depositAmount ||
                      parseFloat(depositAmount) < 10 ||
                      depositMutation.isPending ||
                      !depositNetwork ||
                      !depositAddress
                    }
                  >
                    <ArrowDownLeft size={20} />
                    {depositMutation.isPending ? text.submitting : text.deposit}
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Withdraw Modal - Matching RewardPage style */}
      <AnimatePresence>
        {showWithdrawModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
              onClick={() => {
                setShowWithdrawModal(false);
                resetWithdrawForm();
              }}
            />

            {/* Modal */}
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="bg-[#0f0f17] border border-[#1a1a24] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="sticky top-0 bg-[#0f0f17] border-b border-[#1a1a24] px-8 py-6 flex items-center justify-between z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-[#0052FF]/10 flex items-center justify-center">
                      <ArrowUpRight size={24} className="text-[#0052FF]" />
                    </div>
                    <div>
                      <h2 className="text-white text-2xl font-semibold">{text.withdrawUsdt}</h2>
                      <p className="text-gray-400 text-sm">{text.withdrawUsdtSub}</p>
                    </div>
                  </div>
                  <button
                    className="w-10 h-10 rounded-lg bg-[#1a1a24] hover:bg-[#2a2a3a] text-gray-400 hover:text-white transition-colors flex items-center justify-center"
                    onClick={() => {
                      setShowWithdrawModal(false);
                      resetWithdrawForm();
                    }}
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Content */}
                <div className="px-8 py-6">
                  {/* Available Balance Display */}
                  <div className="bg-gradient-to-br from-[#0052FF]/10 to-[#0052FF]/5 border border-[#0052FF]/20 rounded-xl p-6 mb-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-400 text-sm mb-1">{text.availableBalance}</p>
                        <p className="text-white text-3xl font-bold">
                          ${totalAsset.toLocaleString('en-US', { minimumFractionDigits: 2 })} USDT
                        </p>
                      </div>
                      <div className="w-14 h-14 rounded-xl bg-[#0052FF]/20 flex items-center justify-center">
                        <Wallet size={28} className="text-[#0052FF]" />
                      </div>
                    </div>
                  </div>

                  {/* Withdrawal Amount */}
                  <div className="mb-6">
                    <label className="block text-white text-sm font-semibold mb-3">
                      {text.withdrawAmount}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder={text.withdrawAmountPlaceholder}
                        className={`w-full px-4 py-4 bg-[#1a1a24] text-white rounded-xl border ${
                          amountError ? 'border-red-500' : 'border-[#2a2a3a]'
                        } text-lg focus:outline-none focus:border-[#0052FF] transition-colors pr-20`}
                        value={withdrawAmount}
                        onChange={(e) => {
                          setWithdrawAmount(e.target.value);
                          if (e.target.value) validateAmount(e.target.value);
                          else setAmountError('');
                        }}
                        min="10"
                        max={totalAsset}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">
                        USDT
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      {amountError ? (
                        <div className="flex items-center gap-1 text-red-400 text-xs">
                          <AlertCircle size={12} />
                          <span>{amountError}</span>
                        </div>
                      ) : (
                        <p className="text-gray-500 text-xs">{text.withdrawMinimum}</p>
                      )}
                      <button
                        className="text-[#0052FF] text-xs font-medium hover:text-[#0052FF]/80 transition-colors"
                        onClick={handleMaxAmount}
                      >
                        {text.useMax}
                      </button>
                    </div>
                  </div>

                  {/* Network Selection */}
                  <div className="mb-6">
                    <label className="block text-white text-sm font-semibold mb-3">
                      {text.selectNetwork}
                    </label>
                    <select
                      value={withdrawNetwork}
                      disabled={networkOptions.length === 0}
                      onChange={(e) => {
                        setWithdrawNetwork(e.target.value);
                        setWithdrawRequestError('');
                        if (withdrawAddress) validateAddress(withdrawAddress, e.target.value);
                      }}
                      className="w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#0052FF] transition-colors appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 0.75rem center',
                        backgroundSize: '12px',
                      }}
                    >
                      {networkOptions.length === 0 && (
                        <option value="">{networkAvailabilityMessage}</option>
                      )}
                      {networkOptions.map((network) => (
                        <option key={network.value} value={network.value}>
                          {network.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Wallet Address */}
                  <div className="mb-6">
                    <label className="block text-white text-sm font-semibold mb-3">
                      {formatAssetTranslation(text.walletAddressLabel, { network: withdrawNetwork })}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder={formatAssetTranslation(text.walletAddressPlaceholder, {
                          network: withdrawNetwork,
                        })}
                        className={`w-full px-4 py-4 bg-[#1a1a24] text-white rounded-xl border ${
                          addressError ? 'border-red-500' : 'border-[#2a2a3a]'
                        } text-sm focus:outline-none focus:border-[#0052FF] transition-colors pr-12 font-mono`}
                        value={withdrawAddress}
                        onChange={(e) => {
                          setWithdrawAddress(e.target.value);
                          if (e.target.value) validateAddress(e.target.value, withdrawNetwork);
                          else setAddressError('');
                        }}
                      />
                      {withdrawAddress && (
                        <button
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0052FF] transition-colors"
                          onClick={() => handleCopy(withdrawAddress, 'withdraw-address')}
                        >
                          {copiedField === 'withdraw-address' ? (
                            <Check size={18} className="text-[#00FF94]" />
                          ) : (
                            <Copy size={18} />
                          )}
                        </button>
                      )}
                    </div>
                    {addressError ? (
                      <div className="flex items-center gap-1 text-red-400 text-xs mt-2">
                        <AlertCircle size={12} />
                        <span>{addressError}</span>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-xs mt-2 flex items-center gap-1">
                        <AlertCircle size={12} />
                        {text.walletAddressWarning}
                      </p>
                    )}
                  </div>

                  {/* Summary Section */}
                  {withdrawAmountNum > 0 && !amountError && Boolean(withdrawNetwork) && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-[#1a1a24] border border-[#2a2a3a] rounded-xl p-6 mb-6"
                    >
                      <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                        <Calendar size={18} />
                        {text.withdrawalSummary}
                      </h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 text-sm">{text.withdrawalAmount}</span>
                          <span className="text-white font-medium">
                            $
                            {withdrawAmountNum.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                            })}{' '}
                            USDT
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 text-sm">
                            {formatAssetTranslation(text.networkFee, { network: withdrawNetwork })}
                          </span>
                          <span className="text-red-400 font-medium">
                            -${currentFee.toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
                            USDT
                          </span>
                        </div>
                        <div className="h-px bg-[#2a2a3a]"></div>
                        <div className="flex items-center justify-between">
                          <span className="text-white font-semibold">{text.totalToReceive}</span>
                          <span className="text-[#00FF94] text-lg font-bold">
                            ${totalToReceive.toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
                            USDT
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Info Alert */}
                  <div className="bg-[#0052FF]/5 border border-[#0052FF]/20 rounded-xl p-4">
                    <div className="flex gap-3">
                      <AlertCircle size={20} className="text-[#0052FF] flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-white text-sm font-medium mb-1">{text.importantInfo}</p>
                        <ul className="text-gray-400 text-xs space-y-1">
                          <li>• {text.withdrawInfo1}</li>
                          <li>• {text.withdrawInfo2}</li>
                          <li>• {text.withdrawInfo3}</li>
                          <li>• {text.withdrawInfo4}</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {withdrawRequestError && (
                    <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-300 text-sm">
                      <AlertCircle size={16} />
                      <span>{withdrawRequestError}</span>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="sticky bottom-0 bg-[#0f0f17] border-t border-[#1a1a24] px-8 py-6 flex items-center justify-between gap-4">
                  <button
                    className="flex-1 px-6 py-4 bg-[#1a1a24] text-white rounded-xl font-medium hover:bg-[#2a2a3a] transition-colors"
                    onClick={() => {
                      setShowWithdrawModal(false);
                      resetWithdrawForm();
                    }}
                  >
                    {text.cancel}
                  </button>
                  <button
                    className="flex-1 px-6 py-4 bg-[#0052FF] text-white rounded-xl font-semibold hover:bg-[#0052FF]/90 transition-all hover:shadow-lg hover:shadow-[#0052FF]/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    onClick={handleWithdrawSubmit}
                    disabled={
                      !withdrawAddress ||
                      !withdrawNetwork ||
                      withdrawAmountNum < 10 ||
                      withdrawAmountNum > totalAsset ||
                      !!addressError ||
                      !!amountError
                    }
                  >
                    <ArrowUpRight size={20} />
                    {text.requestWithdrawal}
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/*
        Transfer Modal: Live 계정 생성 미지원으로 계좌 간 이체 기능을 숨김. 삭제하지 않고 주석으로 보관한다.

      [Transfer Modal - Matching RewardPage style]
      <AnimatePresence>
        {showTransferModal && (
          <>
            [Backdrop]
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
              onClick={() => setShowTransferModal(false)}
            />

            [Modal]
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="bg-[#0f0f17] border border-[#1a1a24] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                [Header]
                <div className="sticky top-0 bg-[#0f0f17] border-b border-[#1a1a24] px-8 py-6 flex items-center justify-between z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-[#0052FF]/10 flex items-center justify-center">
                      <ArrowLeftRight size={24} className="text-[#0052FF]" />
                    </div>
                    <div>
                      <h2 className="text-white text-2xl font-semibold">{text.transferFunds}</h2>
                      <p className="text-gray-400 text-sm">{text.transferFundsSub}</p>
                    </div>
                  </div>
                  <button
                    className="w-10 h-10 rounded-lg bg-[#1a1a24] hover:bg-[#2a2a3a] text-gray-400 hover:text-white transition-colors flex items-center justify-center"
                    onClick={() => setShowTransferModal(false)}
                  >
                    <X size={20} />
                  </button>
                </div>

                [Content]
                <div className="px-8 py-6">
                  [Transfer Direction]
                  <div className="mb-6">
                    <label className="block text-white text-sm font-semibold mb-3">
                      {text.transferDirection}
                    </label>
                    <div className="bg-[#1a1a24] border border-[#2a2a3a] rounded-xl p-6">
                      [From Section]
                      <div className="mb-4">
                        <label className="block text-gray-400 text-xs mb-2">{text.transferFrom}</label>
                        <select
                          value={transferFrom}
                          onChange={(e) =>
                            handleFromChange(
                              e.target.value as 'Total Asset' | 'Live Trading Account',
                            )
                          }
                          className="w-full bg-[#16161f] border border-[#0052FF]/30 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#0052FF] transition-colors appearance-none cursor-pointer"
                          style={{
                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 0.75rem center',
                            backgroundSize: '12px',
                          }}
                        >
                          <option value="Total Asset">{text.optionTotalAsset}</option>
                          <option value="Live Trading Account">{text.optionLiveTrading}</option>
                        </select>
                        <div className="mt-2 p-3 bg-[#0052FF]/5 border border-[#0052FF]/10 rounded-lg">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400 text-xs">{text.availableBalanceLabel}</span>
                            <span className="text-white font-bold text-sm">
                              $
                              {getAvailableTransferBalance().toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                              })}{' '}
                              USDT
                            </span>
                          </div>
                        </div>
                      </div>

                      [Arrow Indicator]
                      <div className="flex justify-center -my-2 relative z-10">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0052FF] to-[#0041CC] border-4 border-[#1a1a24] text-white shadow-xl flex items-center justify-center">
                          <ArrowDownUp size={18} />
                        </div>
                      </div>

                      [To Section]
                      <div className="mt-4">
                        <label className="block text-gray-400 text-xs mb-2">{text.transferTo}</label>
                        <select
                          value={transferTo}
                          onChange={(e) =>
                            handleToChange(e.target.value as 'Total Asset' | 'Live Trading Account')
                          }
                          className="w-full bg-[#16161f] border border-[#00FF94]/30 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00FF94] transition-colors appearance-none cursor-pointer"
                          style={{
                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 0.75rem center',
                            backgroundSize: '12px',
                          }}
                        >
                          <option value="Total Asset">{text.optionTotalAsset}</option>
                          <option value="Live Trading Account">{text.optionLiveTrading}</option>
                        </select>
                        <div className="mt-2 p-3 bg-[#00FF94]/5 border border-[#00FF94]/10 rounded-lg">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400 text-xs">{text.currentBalance}</span>
                            <span className="text-white font-bold text-sm">
                              $
                              {(transferTo === 'Total Asset'
                                ? totalAsset
                                : tradingAccountAsset
                              ).toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
                              USDT
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  [Transfer Amount]
                  <div className="mb-6">
                    <label className="block text-white text-sm font-semibold mb-3">
                      {text.transferAmount}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder={text.transferAmountPlaceholder}
                        className={`w-full px-4 py-4 bg-[#1a1a24] text-white rounded-xl border ${
                          transferError ? 'border-red-500' : 'border-[#2a2a3a]'
                        } text-lg focus:outline-none focus:border-[#0052FF] transition-colors pr-20`}
                        value={transferAmount}
                        onChange={(e) => {
                          setTransferAmount(e.target.value);
                          setTransferRequestError('');
                          if (e.target.value) validateTransferAmount(e.target.value);
                          else setTransferError('');
                        }}
                        min="1"
                        max={getAvailableTransferBalance()}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">
                        USDT
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      {transferError ? (
                        <div className="flex items-center gap-1 text-red-400 text-xs">
                          <AlertCircle size={12} />
                          <span>{transferError}</span>
                        </div>
                      ) : (
                        <p className="text-gray-500 text-xs">{text.transferMinimum}</p>
                      )}
                      <button
                        className="text-[#0052FF] text-xs font-medium hover:text-[#0052FF]/80 transition-colors"
                        onClick={handleTransferMaxAmount}
                      >
                        {text.useMax}
                      </button>
                    </div>
                  </div>

                  [Info Alert]
                  <div className="bg-[#0052FF]/5 border border-[#0052FF]/20 rounded-xl p-4">
                    <div className="flex gap-3">
                      <AlertCircle size={20} className="text-[#0052FF] flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-white text-sm font-medium mb-1">{text.transferInfo}</p>
                        <ul className="text-gray-400 text-xs space-y-1">
                          <li>• {text.transferInfo1}</li>
                          <li>• {text.transferInfo2}</li>
                          <li>• {text.transferInfo3}</li>
                          <li>• {text.transferInfo4}</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {transferRequestError && (
                  <div className="px-8 pt-4">
                    <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-300 text-sm">
                      <AlertCircle size={16} />
                      <span>{transferRequestError}</span>
                    </div>
                  </div>
                )}

                [Footer Actions]
                <div className="sticky bottom-0 bg-[#0f0f17] border-t border-[#1a1a24] px-8 py-6 flex items-center justify-between gap-4">
                  <button
                    className="flex-1 px-6 py-4 bg-[#1a1a24] text-white rounded-xl font-medium hover:bg-[#2a2a3a] transition-colors"
                    onClick={() => setShowTransferModal(false)}
                  >
                    {text.cancel}
                  </button>
                  <button
                    className="flex-1 px-6 py-4 bg-[#0052FF] text-white rounded-xl font-semibold hover:bg-[#0052FF]/90 transition-all hover:shadow-lg hover:shadow-[#0052FF]/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    onClick={handleTransferSubmit}
                    disabled={
                      !transferAmount ||
                      transferAmountNum < 1 ||
                      transferAmountNum > getAvailableTransferBalance() ||
                      !!transferError ||
                      transferMutation.isPending
                    }
                  >
                    <ArrowLeftRight size={20} />
                    {transferMutation.isPending ? text.submitting : text.confirmTransfer}
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
      */}

      {/* Failed status tooltip (portal) */}
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

      {/* Security Verification Modal */}
      <AnimatePresence>
        {ENABLE_WITHDRAW_SECURITY_MODAL &&
          shouldUseWithdrawSecurityModal &&
          showSecurityVerification && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60]"
                onClick={() => {
                  setShowSecurityVerification(false);
                  setEmailCode('');
                  setAuthenticatorCode('');
                  setEmailCodeError('');
                  setAuthenticatorCodeError('');
                  setEmailCodeSent(false);
                  setEmailCodeTimer(0);
                  setWithdrawRequestError('');
                }}
              />

              {/* Modal */}
              <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="bg-[#0f0f17] border border-[#1a1a24] rounded-2xl shadow-2xl max-w-md w-full"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="px-8 py-6 border-b border-[#1a1a24]">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-[#0052FF]/10 flex items-center justify-center">
                        <Shield size={24} className="text-[#0052FF]" />
                      </div>
                      <div>
                        <h2 className="text-white text-xl font-semibold">{text.securityVerification}</h2>
                        <p className="text-gray-400 text-sm">{text.securityVerificationSub}</p>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="px-8 py-6 space-y-6">
                    {/* Email Verification */}
                    {requiresEmailVerification && (
                      <div>
                        <label className="block text-white text-sm font-semibold mb-3">
                          {text.emailVerificationCode}
                        </label>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <input
                              type="text"
                              value={emailCode}
                              onChange={(e) => {
                                const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                                setEmailCode(value);
                                setEmailCodeError('');
                              }}
                              placeholder={text.emailCodePlaceholder}
                              maxLength={6}
                              className={`w-full px-4 py-3 bg-[#1a1a24] border ${
                                emailCodeError ? 'border-red-500' : 'border-[#2a2a3a]'
                              } rounded-lg text-white text-sm focus:outline-none focus:border-[#0052FF] transition-colors`}
                            />
                            {emailCodeError && (
                              <div className="flex items-center gap-1 text-red-400 text-xs mt-2">
                                <AlertCircle size={12} />
                                <span>{emailCodeError}</span>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={handleSendEmailCode}
                            disabled={emailCodeSent || sendWithdrawEmailCodeMutation.isPending}
                            className="px-4 py-3 bg-[#0052FF] text-white rounded-lg font-medium hover:bg-[#0052FF]/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm"
                          >
                            {sendWithdrawEmailCodeMutation.isPending
                              ? text.sending
                              : emailCodeSent
                                ? `${emailCodeTimer}s`
                                : text.sendCode}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 테스트 시 인증은 패스하도록 조치함. 2단계 인증 분기나 토큰 문제 등 해결 및 출금 api에 코드 받도록 수정되면 복구 예정 */}
                    {/* Authenticator Code */}
                    {requiresAuthenticatorVerification && (
                      <div>
                        <label className="block text-white text-sm font-semibold mb-3">
                          {text.authenticatorCode}
                        </label>
                        <input
                          type="text"
                          value={authenticatorCode}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                            setAuthenticatorCode(value);
                            setAuthenticatorCodeError('');
                          }}
                          placeholder={text.authenticatorCodePlaceholder}
                          maxLength={6}
                          className={`w-full px-4 py-3 bg-[#1a1a24] border ${
                            authenticatorCodeError ? 'border-red-500' : 'border-[#2a2a3a]'
                          } rounded-lg text-white text-sm focus:outline-none focus:border-[#0052FF] transition-colors`}
                        />
                        {authenticatorCodeError ? (
                          <div className="flex items-center gap-1 text-red-400 text-xs mt-2">
                            <AlertCircle size={12} />
                            <span>{authenticatorCodeError}</span>
                          </div>
                        ) : (
                          <p className="text-gray-500 text-xs mt-2">
                            {text.authenticatorCodeHint}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {withdrawRequestError && (
                    <div className="px-8 pt-4">
                      <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-300 text-sm">
                        <AlertCircle size={16} />
                        <span>{withdrawRequestError}</span>
                      </div>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="px-8 py-6 border-t border-[#1a1a24] flex gap-3">
                    <button
                      onClick={() => {
                        setShowSecurityVerification(false);
                        setEmailCode('');
                        setAuthenticatorCode('');
                        setEmailCodeError('');
                        setAuthenticatorCodeError('');
                        setEmailCodeSent(false);
                        setEmailCodeTimer(0);
                        setWithdrawRequestError('');
                      }}
                      className="flex-1 px-6 py-3 bg-[#1a1a24] text-white rounded-lg font-medium hover:bg-[#2a2a3a] transition-colors"
                    >
                      {text.cancel}
                    </button>
                    <button
                      onClick={handleConfirmWithdrawal}
                      disabled={withdrawMutation.isPending}
                      className="flex-1 px-6 py-3 bg-[#0052FF] text-white rounded-lg font-semibold hover:bg-[#0052FF]/90 transition-all hover:shadow-lg hover:shadow-[#0052FF]/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {withdrawMutation.isPending ? text.submitting : text.confirmWithdrawal}
                    </button>
                  </div>
                </motion.div>
              </div>
            </>
          )}
      </AnimatePresence>
    </div>
  );
}

