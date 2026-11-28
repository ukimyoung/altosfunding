import { motion } from 'motion/react';
import {
  Wallet,
  Calendar,
  ArrowUpRight,
  CheckCircle,
  Clock,
  X,
  Copy,
  Check,
  Eye,
  Filter,
  Search,
  FileText,
  Trophy,
  Users,
  Info,
  AlertCircle,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import {
  type AccountDetailResponse,
  type FundedAccountStatus,
  type AccountListItem,
  FUNDED_ACCOUNT_STATUSES,
} from '@/api/accounts';
import {
  accountsQueryKeys,
  useAccountDetailQuery,
  useAccountsQuery,
  useFundedSummaryQuery,
} from '@/app/queries/accounts';
import { checkPayoutPositions } from '@/api/payouts';
import { formatDateByBrowserTimeZone, formatDateTimeByBrowserTimeZone } from '@/app/utils/date';
import { ChallengeDetailModal } from '../../components/shared/ChallengeDetailModal';
import { ActivePositionWarningModal } from '../../components/shared/ActivePositionWarningModal';
import { DataTable, Column } from '../../components/shared/DataTable';
import {
  FilterActions,
  FilterCard,
  FilterDateInput,
  FilterDropdown,
  FilterField,
  FilterTextInput,
} from '../../components/shared/FilterControls';
import { WithdrawalRequestForm } from '../../components/shared/WithdrawalRequestForm';
import { Toast } from '../../components/shared/Toast';
import { applyScopedSearchParams, createScopedSearchParams } from '../../utils/url/queryParams';
import { useLocale } from '@/app/i18n/LocaleContext';

type FundedAccount = {
  id: string;
  account_id: string;
  mt4Login: number;
  accountType: string;
  funding: number;
  balance: number;
  profit: number;
  createdAt: string;
  status: FundedAccountStatus;
  statusLabel: string;
  banReason?: string;
  startDate: string;
  // 펀디드 시작 일시 (계좌 start_at, 브라우저 시간대, YYYY-MM-DD HH:mm). 목록 'Start Date' 열에 표시.
  startDateTime: string;
  endDate: string;
};

// QA 확인용 mock 데이터. 실제 API 응답만 사용하도록 현재는 비활성화.
// const mockFundedAccountItems: AccountListItem[] = [
//   {
//     mt4_login: 22847563,
//     account_id: 0,
//     user_id: 'mock-funded-user-1',
//     product_id: 'funded-5k',
//     status: 'ACTIVE',
//     tier: 'FUNDED',
//     type_code: '5K',
//     is_read_only: false,
//     capital: 5000,
//     balance: 6475,
//     equity: 6475,
//     total_profit: 1475,
//     promoted_at: '2026-03-01T09:00:00Z',
//     failed_reason: null,
//     created_at: '2026-03-01T09:00:00Z',
//     challenge_id: '',
//     challenge_name: 'Funded 5K',
//     start_date: '2026-03-01 09:00',
//     end_date: '2026-03-30 18:00',
//     user_email: 'mock.funded.1@example.com',
//   },
// ];

type Trade = {
  deal: string;
  symbol: string;
  date: string;
  action: 'Buy' | 'Sell' | 'Balance';
  entry: 'In' | 'Out';
  volume: number;
  price: number;
  profit: number;
};

type ChallengeDetail = {
  accountNumber: string;
  accountId: string;
  capital: number;
  accountBalance: number;
  totalProfit: number;
  accountStatus: string;
  password: string;
  trades: Trade[];
};

// 펀딩 유형 = 원래 챌린지 상품명에서 'Challenge '를 뺀 이름. Core에 product_type으로 보낸다.
// type FundingTypeFilter = 'All' | '100K' | '300K' | '500K';
type FundingTypeFilter = 'All' | 'Starter' | 'Professional' | 'Elite' | 'Prime';
type FundedStatusFilter = 'All' | FundedAccountStatus;

// 예전에는 type_code('100'·'300'·'500')로 걸렀으나 Core 상품의 type_code는 비어 있을 수 있어 0건이 나왔다.
// const FUNDED_TYPE_FILTER_TO_CODE: Record<FundingTypeFilter, string | undefined> = {
//   All: undefined,
//   '100K': '100',
//   '300K': '300',
//   '500K': '500',
// };
const FUNDING_TYPE_FILTERS = ['Starter', 'Professional', 'Elite', 'Prime'] as const;
// 예전 주소(?type=100K 등)로 들어와도 같은 유형으로 맞춘다.
const LEGACY_FUNDING_TYPE_QUERY: Record<string, FundingTypeFilter> = {
  '100K': 'Starter',
  '300K': 'Professional',
  '500K': 'Elite',
};

const toApiDate = (value: string) => (value ? value.replace(/-/g, '') : undefined);

const fromQueryDate = (value: string | null) => {
  if (!value) {
    return '';
  }

  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }

  return value;
};

const FUNDED_QUERY_KEYS = {
  search: 'search',
  type: 'type',
  start: 'start',
  end: 'end',
  status: 'status',
  page: 'page',
} as const;

const parsePage = (value: string | null) => {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
};

const parseFundingTypeFilter = (value: string | null): FundingTypeFilter => {
  if (!value) {
    return 'All';
  }

  const matched = FUNDING_TYPE_FILTERS.find((type) => type.toLowerCase() === value.toLowerCase());

  return matched ?? LEGACY_FUNDING_TYPE_QUERY[value.toUpperCase()] ?? 'All';
};

const parseFundedStatusFilter = (value: string | null): FundedStatusFilter => {
  if (value === 'All') return 'All';

  const normalizedValue = (value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  const allowedStatuses = [...FUNDED_ACCOUNT_STATUSES] as string[];

  return allowedStatuses.includes(normalizedValue)
    ? (normalizedValue as FundedAccountStatus)
    : 'All';
};

const toMt4LoginParam = (value: string) => {
  const digits = value.replace(/\D/g, '');
  const mt4Login = Number(digits);

  return Number.isSafeInteger(mt4Login) && mt4Login > 0 ? mt4Login : undefined;
};

const formatStatusDisplay = (status: string) => status.trim() || '-';
const formatStatusLabel = (status: string) =>
  status
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase()) || '-';

const normalizeStatusValue = (status: string) =>
  status
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');

const toFundedStatus = (status: string): FundedAccountStatus => {
  const normalizedStatus = normalizeStatusValue(status) as FundedAccountStatus;

  return FUNDED_ACCOUNT_STATUSES.includes(normalizedStatus) ? normalizedStatus : 'INACTIVE';
};

const normalizeDateValue = (value: string) => {
  if (!value) return '';
  const trimmed = value.trim();

  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
  }

  return trimmed.includes('T') ? trimmed.slice(0, 10) : trimmed;
};

const mapAccountDetailToFundedModal = (detail: AccountDetailResponse): ChallengeDetail => {
  const accountNumber = String(detail.mt4_login ?? '-');
  const displayDate = normalizeDateValue(detail.created_at || detail.start_date);
  const status = toFundedStatus(detail.status);
  const password = detail.mt4_password || '-';

  return {
    accountNumber,
    accountId: detail.account_id,
    capital: detail.capital ?? 0,
    accountBalance: detail.balance ?? 0,
    totalProfit: detail.total_profit ?? 0,
    accountStatus: formatStatusDisplay(detail.status || status),
    password,
    trades: [
      {
        deal: accountNumber,
        symbol: detail.type_code || 'Funded',
        date: displayDate || '-',
        action: 'Balance',
        entry: 'In',
        volume: 0,
        price: 0,
        profit: detail.total_profit ?? 0,
      },
    ],
  };
};

export function FundedAccountPage() {
  const { T } = useLocale();
  const text = T.funded;
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Balance states
  const [totalPayoutBalance, setTotalPayoutBalance] = useState(1250.0);

  // Funded account states
  const [selectedFundedAccount, setSelectedFundedAccount] = useState<ChallengeDetail | null>(null);
  const [selectedFundedAccountId, setSelectedFundedAccountId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [withdrawingAccounts, setWithdrawingAccounts] = useState<Set<string>>(new Set());
  const [showWithdrawalForm, setShowWithdrawalForm] = useState(false);
  const [showActivePositionWarning, setShowActivePositionWarning] = useState(false);
  const [showPayoutSuccessToast, setShowPayoutSuccessToast] = useState(false);
  const [hoveredBanReasonTooltip, setHoveredBanReasonTooltip] = useState<{
    reason: string;
    x: number;
    y: number;
    interaction: 'hover' | 'tap';
  } | null>(null);

  useEffect(() => {
    if (!showPayoutSuccessToast) {
      return;
    }

    const timer = setTimeout(() => setShowPayoutSuccessToast(false), 5000);
    return () => clearTimeout(timer);
  }, [showPayoutSuccessToast]);

  // Filter states for Funded Account History
  const [searchAccountId, setSearchAccountId] = useState(
    () => searchParams.get(FUNDED_QUERY_KEYS.search) ?? '',
  );
  const [fundingTypeFilter, setFundingTypeFilter] = useState<FundingTypeFilter>(() =>
    parseFundingTypeFilter(searchParams.get(FUNDED_QUERY_KEYS.type)),
  );
  const [startDate, setStartDate] = useState(() =>
    fromQueryDate(searchParams.get(FUNDED_QUERY_KEYS.start)),
  );
  const [endDate, setEndDate] = useState(() =>
    fromQueryDate(searchParams.get(FUNDED_QUERY_KEYS.end)),
  );
  const [fundedAccountStatusFilter, setFundedAccountStatusFilter] = useState<FundedStatusFilter>(
    () => parseFundedStatusFilter(searchParams.get(FUNDED_QUERY_KEYS.status)),
  );
  const [appliedSearchAccountId, setAppliedSearchAccountId] = useState(
    () => searchParams.get(FUNDED_QUERY_KEYS.search) ?? '',
  );
  const [appliedFundingTypeFilter, setAppliedFundingTypeFilter] = useState<FundingTypeFilter>(() =>
    parseFundingTypeFilter(searchParams.get(FUNDED_QUERY_KEYS.type)),
  );
  const [appliedStartDate, setAppliedStartDate] = useState(() =>
    fromQueryDate(searchParams.get(FUNDED_QUERY_KEYS.start)),
  );
  const [appliedEndDate, setAppliedEndDate] = useState(() =>
    fromQueryDate(searchParams.get(FUNDED_QUERY_KEYS.end)),
  );
  const [appliedFundedAccountStatusFilter, setAppliedFundedAccountStatusFilter] =
    useState<FundedStatusFilter>(() =>
      parseFundedStatusFilter(searchParams.get(FUNDED_QUERY_KEYS.status)),
    );
  const [showFundingTypeDropdown, setShowFundingTypeDropdown] = useState(false);
  const [showFundedAccountStatusDropdown, setShowFundedAccountStatusDropdown] = useState(false);
  const isSearchInputDirtyRef = useRef(false);

  // DataTable states for funded
  const [currentPage, setCurrentPage] = useState(() =>
    parsePage(searchParams.get(FUNDED_QUERY_KEYS.page)),
  );
  const itemsPerPage = 20;
  const updateFundedQueryParams = (updates: Record<string, string | undefined>) => {
    const next = applyScopedSearchParams(searchParams, Object.values(FUNDED_QUERY_KEYS), updates);

    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    const normalized = createScopedSearchParams(searchParams, Object.values(FUNDED_QUERY_KEYS));
    const payoutAccountId = searchParams.get('account');

    if (location.pathname === '/my-page/funded/request-payout' && payoutAccountId) {
      normalized.set('account', payoutAccountId);
    }

    if (normalized.toString() !== searchParams.toString()) {
      setSearchParams(normalized, { replace: true });
    }
  }, [location.pathname, searchParams, setSearchParams]);

  const { data: selectedFundedAccountDetailResponse } = useAccountDetailQuery(
    selectedFundedAccountId ?? '',
    selectedFundedAccountId !== null,
  );
  const { data: fundedSummary } = useFundedSummaryQuery();
  const fundedAccountsParams = useMemo(
    () => ({
      tier: 'FUNDED' as const,
      status:
        appliedFundedAccountStatusFilter === 'All' ? undefined : appliedFundedAccountStatusFilter,
      product_type: appliedFundingTypeFilter === 'All' ? undefined : appliedFundingTypeFilter,
      mt4_login: toMt4LoginParam(appliedSearchAccountId),
      start_date: toApiDate(appliedStartDate),
      end_date: toApiDate(appliedEndDate),
      page: currentPage,
      size: itemsPerPage,
    }),
    [
      appliedEndDate,
      appliedFundedAccountStatusFilter,
      appliedFundingTypeFilter,
      appliedSearchAccountId,
      appliedStartDate,
      currentPage,
      itemsPerPage,
    ],
  );
  const { data: fundedAccountsResponse, isFetching: isFetchingFundedAccounts } =
    useAccountsQuery(fundedAccountsParams);

  const getFundedStatusLabel = (status: FundedStatusFilter) => {
    switch (status) {
      case 'All':
        return text.statusAll;
      case 'PENDING':
        return text.statusPending;
      case 'ACTIVE':
        return text.statusActive;
      case 'IN_PROGRESS':
        return text.statusInProgress;
      case 'PENDING_PAYOUT':
        return text.statusPendingPayout;
      case 'FAILED':
        return text.statusFailed;
      case 'CLOSED':
        return text.statusClosed;
      case 'INACTIVE':
        return text.statusInactive;
      case 'BANNED':
        return text.statusBanned;
      default:
        return formatStatusLabel(status);
    }
  };

  const fundedStatusFilterOptions = [
    { label: text.statusAll, value: 'All' as const },
    ...FUNDED_ACCOUNT_STATUSES.map((status) => ({
      label: getFundedStatusLabel(status),
      value: status,
    })),
  ];
  const fundingTypeFilterLabels: Record<Exclude<FundingTypeFilter, 'All'>, string> = {
    Starter: text.fundingTypeStarter,
    Professional: text.fundingTypeProfessional,
    Elite: text.fundingTypeElite,
    Prime: text.fundingTypePrime,
  };
  const fundingTypeFilterOptions = [
    { label: text.statusAll, value: 'All' as const },
    // { label: '100K', value: '100K' as const },
    // { label: '300K', value: '300K' as const },
    // { label: '500K', value: '500K' as const },
    ...FUNDING_TYPE_FILTERS.map((type) => ({ label: fundingTypeFilterLabels[type], value: type })),
  ];

  const fundedAccounts = useMemo<FundedAccount[]>(() => {
    const accountItems = fundedAccountsResponse?.items ?? [];

    return accountItems.map((item, index) => {
      return {
        id: item.account_id || String(item.mt4_login ?? index + 1),
        account_id: item.account_id,
        mt4Login: item.mt4_login ?? 0,
        // 계좌 유형 = 원래 챌린지 상품 유형 (Core account_type). 없으면 상품명에서 접두어를 뺀 이름.
        accountType:
          item.account_type?.trim() ||
          item.product_name?.trim().replace(/^(challenge|funded)\s+/i, '') ||
          '-',
        funding: item.capital ?? 0,
        balance: item.balance ?? 0,
        profit: item.total_profit ?? 0,
        createdAt: formatDateByBrowserTimeZone(item.created_at) || '-',
        status: toFundedStatus(item.status),
        statusLabel: getFundedStatusLabel(toFundedStatus(item.status)),
        banReason: item.reason ?? undefined,
        startDate: normalizeDateValue(item.start_date),
        startDateTime: (item.start_date && formatDateTimeByBrowserTimeZone(item.start_date).slice(0, 16)) || '-',
        endDate: normalizeDateValue(item.end_date),
      };
    });
  }, [fundedAccountsResponse, getFundedStatusLabel]);

  useEffect(() => {
    const nextSearchAccountId = searchParams.get(FUNDED_QUERY_KEYS.search) ?? '';
    const nextFundingType = parseFundingTypeFilter(searchParams.get(FUNDED_QUERY_KEYS.type));
    const nextStartDate = fromQueryDate(searchParams.get(FUNDED_QUERY_KEYS.start));
    const nextEndDate = fromQueryDate(searchParams.get(FUNDED_QUERY_KEYS.end));
    const nextStatus = parseFundedStatusFilter(searchParams.get(FUNDED_QUERY_KEYS.status));
    const nextPage = parsePage(searchParams.get(FUNDED_QUERY_KEYS.page));

    if (!isSearchInputDirtyRef.current) {
      setSearchAccountId(nextSearchAccountId);
      setAppliedSearchAccountId(nextSearchAccountId);
    }

    setFundingTypeFilter(nextFundingType);
    setStartDate(nextStartDate);
    setEndDate(nextEndDate);
    setFundedAccountStatusFilter(nextStatus);

    setAppliedFundingTypeFilter(nextFundingType);
    setAppliedStartDate(nextStartDate);
    setAppliedEndDate(nextEndDate);
    setAppliedFundedAccountStatusFilter(nextStatus);
    setCurrentPage(nextPage);
  }, [searchParams]);

  useEffect(() => {
    if (selectedFundedAccountId === null || !selectedFundedAccountDetailResponse) return;

    setSelectedFundedAccount(mapAccountDetailToFundedModal(selectedFundedAccountDetailResponse));
    setShowDetailModal(true);
  }, [queryClient, selectedFundedAccountId, selectedFundedAccountDetailResponse]);

  // Fee calculation based on network
  const handleViewFundedAccountDetails = (account: FundedAccount) => {
    if (!account.account_id) return;

    setSelectedFundedAccount(null);
    setSelectedFundedAccountId(account.account_id);
  };

  const handleCloseDetailModal = () => {
    setShowDetailModal(false);
    setSelectedFundedAccount(null);
    setSelectedFundedAccountId(null);
  };

  const closeWithdrawalForm = () => {
    setShowWithdrawalForm(false);

    if (location.pathname !== '/my-page/funded') {
      navigate('/my-page/funded');
    }
  };

  const handlePayoutSuccess = () => {
    setShowPayoutSuccessToast(true);
    closeWithdrawalForm();
  };

  const handleAccountWithdraw = async (account: FundedAccount) => {
    if (isPayoutDisabled(account) || !account.account_id) {
      return;
    }

    setWithdrawingAccounts((current) => new Set(current).add(account.id));

    try {
      const result = await checkPayoutPositions(account.account_id);

      if (!result.ok) {
        setShowActivePositionWarning(true);
        return;
      }

      setShowWithdrawalForm(true);
      window.scrollTo({ top: 0, behavior: 'auto' });
      navigate(`/my-page/funded/request-payout?account=${encodeURIComponent(account.account_id)}`);
    } catch {
      setShowActivePositionWarning(true);
    } finally {
      setWithdrawingAccounts((current) => {
        const next = new Set(current);
        next.delete(account.id);
        return next;
      });
    }
  };

  const isPayoutUnavailable = (account: FundedAccount) =>
    account.status === 'PENDING_PAYOUT' || account.status === 'INACTIVE' || account.profit <= 0;

  const isPayoutDisabled = (account: FundedAccount) =>
    isPayoutUnavailable(account) || withdrawingAccounts.has(account.id);

  const getFundedAccountStatusStyle = (status: FundedAccount['status']) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-[#00FF94]/10 text-[#00FF94]';
      case 'PENDING_PAYOUT':
        return 'bg-[#FFB800]/10 text-[#FFB800]';
      case 'FAILED':
      case 'CLOSED':
      case 'BANNED':
        return 'bg-red-500/10 text-red-400';
      case 'INACTIVE':
      default:
        return 'bg-gray-500/10 text-gray-400';
    }
  };

  const renderBanReasonIcon = (account: FundedAccount) => {
    if (account.status !== 'BANNED' || !account.banReason) {
      return null;
    }

    return (
      <button
        type="button"
        className="w-4 h-4 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center cursor-pointer hover:bg-red-500/20 transition-colors"
        onMouseEnter={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setHoveredBanReasonTooltip({
            reason: account.banReason ?? '',
            x: rect.left - 266,
            y: rect.top + rect.height / 2,
            interaction: 'hover',
          });
        }}
        onMouseLeave={() => {
          if (hoveredBanReasonTooltip?.interaction !== 'tap') {
            setHoveredBanReasonTooltip(null);
          }
        }}
        onClick={(event) => {
          event.stopPropagation();
          const rect = event.currentTarget.getBoundingClientRect();
          setHoveredBanReasonTooltip((prev) => {
            if (prev?.interaction === 'tap' && prev.reason === account.banReason) {
              return null;
            }

            return {
              reason: account.banReason ?? '',
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

  useEffect(() => {
    if (!isSearchInputDirtyRef.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      const trimmedSearchAccountId = searchAccountId.trim();

      isSearchInputDirtyRef.current = false;
      setAppliedSearchAccountId(trimmedSearchAccountId);
      setCurrentPage(1);

      const next = applyScopedSearchParams(searchParams, Object.values(FUNDED_QUERY_KEYS), {
        [FUNDED_QUERY_KEYS.search]: trimmedSearchAccountId || undefined,
        [FUNDED_QUERY_KEYS.page]: '1',
      });

      setSearchParams(next, { replace: true });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchAccountId, searchParams, setSearchParams]);

  const handleSearchAccountIdChange = (value: string) => {
    isSearchInputDirtyRef.current = true;
    setSearchAccountId(value.replace(/\D/g, ''));
  };

  const handleResetFilters = () => {
    isSearchInputDirtyRef.current = false;
    setSearchAccountId('');
    setFundingTypeFilter('All');
    setStartDate('');
    setEndDate('');
    setFundedAccountStatusFilter('All');
    setAppliedSearchAccountId('');
    setAppliedFundingTypeFilter('All');
    setAppliedStartDate('');
    setAppliedEndDate('');
    setAppliedFundedAccountStatusFilter('All');
    setCurrentPage(1);
    updateFundedQueryParams({
      [FUNDED_QUERY_KEYS.search]: undefined,
      [FUNDED_QUERY_KEYS.type]: undefined,
      [FUNDED_QUERY_KEYS.start]: undefined,
      [FUNDED_QUERY_KEYS.end]: undefined,
      [FUNDED_QUERY_KEYS.status]: undefined,
      [FUNDED_QUERY_KEYS.page]: '1',
    });
  };

  const handleStartDateChange = (value: string) => {
    if (endDate && value && value > endDate) {
      return;
    }

    setStartDate(value);
    setAppliedStartDate(value);
    setCurrentPage(1);
    updateFundedQueryParams({
      [FUNDED_QUERY_KEYS.start]: toApiDate(value),
      [FUNDED_QUERY_KEYS.page]: '1',
    });
  };

  const handleEndDateChange = (value: string) => {
    if (startDate && value && value < startDate) {
      return;
    }

    setEndDate(value);
    setAppliedEndDate(value);
    setCurrentPage(1);
    updateFundedQueryParams({
      [FUNDED_QUERY_KEYS.end]: toApiDate(value),
      [FUNDED_QUERY_KEYS.page]: '1',
    });
  };

  const handleFundingTypeChange = (value: FundingTypeFilter) => {
    setFundingTypeFilter(value);
    setAppliedFundingTypeFilter(value);
    setCurrentPage(1);
    updateFundedQueryParams({
      [FUNDED_QUERY_KEYS.type]: value === 'All' ? undefined : value,
      [FUNDED_QUERY_KEYS.page]: '1',
    });
  };

  const handleFundedStatusChange = (value: FundedStatusFilter) => {
    setFundedAccountStatusFilter(value);
    setAppliedFundedAccountStatusFilter(value);
    setCurrentPage(1);
    updateFundedQueryParams({
      [FUNDED_QUERY_KEYS.status]: value === 'All' ? undefined : value,
      [FUNDED_QUERY_KEYS.page]: '1',
    });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    updateFundedQueryParams({
      [FUNDED_QUERY_KEYS.page]: String(page),
    });
  };

  const displayData = fundedAccounts;
  const serverTotalPages = fundedAccountsResponse?.pages;
  const totalPages = Math.max(1, serverTotalPages ?? currentPage);

  const handleLoadMore = () => {
    if (currentPage < totalPages && !isFetchingFundedAccounts) {
      setCurrentPage((prev) => {
        const nextPage = prev + 1;
        updateFundedQueryParams({
          [FUNDED_QUERY_KEYS.page]: String(nextPage),
        });
        return nextPage;
      });
    }
  };

  const fundedAccountColumns: Column<FundedAccount>[] = [
    {
      header: text.colAccountId,
      accessor: (item) => (
        <p className="text-white font-mono text-sm font-medium">{item.mt4Login.toString()}</p>
      ),
    },
    {
      header: text.colAccountType,
      accessor: (item) => (
        <span className="text-[#00FF94] text-sm font-semibold">{item.accountType}</span>
      ),
    },
    {
      header: text.colFundedCapital,
      align: 'right',
      accessor: (item) => (
        <p className="text-[#0052FF] text-sm font-semibold">
          ${item.funding.toLocaleString('en-US')}
        </p>
      ),
    },
    {
      header: text.colStartDate,
      align: 'center',
      // 날짜와 시:분을 두 줄로 나눠 표 너비를 늘리지 않는다 (1280px 이상 한 줄 헤더 유지).
      accessor: (item) => {
        const [date, time] = item.startDateTime.split(' ');

        return (
          <div className="font-mono leading-tight">
            <p className="text-gray-300 text-sm">{date}</p>
            {time ? <p className="text-gray-500 text-xs mt-0.5">{time}</p> : null}
          </div>
        );
      },
    },
    {
      header: text.colBalance,
      align: 'right',
      accessor: (item) => (
        <p className="text-white text-sm font-semibold">
          ${item.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </p>
      ),
    },
    {
      header: text.colProfit,
      align: 'right',
      accessor: (item) => (
        <p
          className={`text-sm font-semibold ${item.profit >= 0 ? 'text-[#00FF94]' : 'text-red-400'}`}
        >
          {item.profit >= 0 ? '+' : ''}$
          {item.profit.toLocaleString('en-US', {
            minimumFractionDigits: 2,
          })}
        </p>
      ),
    },
    {
      header: text.colStatus,
      align: 'center',
      accessor: (item) => (
        <div className="flex justify-center items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${getFundedAccountStatusStyle(item.status)}`}
          >
            {item.status === 'ACTIVE' ? <CheckCircle size={14} /> : <Clock size={14} />}
            {item.statusLabel}
          </span>
          {renderBanReasonIcon(item)}
        </div>
      ),
    },
    {
      header: text.colAction,
      align: 'center',
      accessor: (item) => (
        <div className="flex justify-center">
          <button
            disabled={item.mt4Login <= 0}
            className="flex items-center gap-1 min-[1440px]:gap-1.5 px-2 min-[1440px]:px-3 py-2 bg-[#0052FF] hover:bg-[#0052FF]/90 text-white rounded-lg text-sm font-medium transition-all hover:shadow-lg hover:shadow-[#0052FF]/30 disabled:cursor-not-allowed disabled:bg-[#24243a] disabled:text-gray-500 disabled:hover:bg-[#24243a] disabled:hover:shadow-none"
            onClick={() => handleViewFundedAccountDetails(item)}
          >
            <Eye size={16} />
            {text.details}
          </button>
        </div>
      ),
    },
    {
      header: text.colPayout,
      align: 'center',
      accessor: (item) => (
        <div className="flex justify-center">
          <button
            className={`flex items-center gap-1 min-[1440px]:gap-1.5 px-2 min-[1440px]:px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              isPayoutDisabled(item)
                ? 'bg-gray-600/30 text-gray-500 cursor-not-allowed'
                : 'bg-[#00FF94] hover:bg-[#00FF94]/90 text-[#0f0f17] hover:shadow-lg hover:shadow-[#00FF94]/30'
            }`}
            onClick={() => handleAccountWithdraw(item)}
            disabled={isPayoutDisabled(item)}
          >
            {withdrawingAccounts.has(item.id) ? (
              <Clock size={16} className="animate-spin" />
            ) : (
              <ArrowUpRight size={16} />
            )}
            {text.requestPayout}
          </button>
        </div>
      ),
    },
  ];

  const completedPayoutAmount = fundedSummary?.total_payout ?? 0;
  const pendingRequestAmount = fundedSummary?.pending_payout_amount ?? 0;
  const payoutRequestCount = fundedSummary?.pending_payout_count ?? 0;

  useEffect(() => {
    const isRequestPayoutPath = location.pathname === '/my-page/funded/request-payout';

    if (!isRequestPayoutPath) {
      if (showWithdrawalForm) {
        setShowWithdrawalForm(false);
      }
      return;
    }

    const params = new URLSearchParams(location.search);
    const accountId = params.get('account');

    if (!accountId) {
      setShowWithdrawalForm(false);
      navigate('/my-page/funded', { replace: true });
      return;
    }

    setShowWithdrawalForm(true);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname, location.search, navigate, showWithdrawalForm]);

  // If withdrawal form is active, render it as full-page replacement
  const payoutSuccessToast = (
    <Toast
      type="success"
      title={text.paymentUnderReview}
      message={text.paymentUnderReviewBody}
      isVisible={showPayoutSuccessToast}
      onClose={() => setShowPayoutSuccessToast(false)}
      duration={0}
      position="top"
      showCloseButton={false}
      showProgressBar={false}
    />
  );

  if (showWithdrawalForm) {
    return (
      <>
        {payoutSuccessToast}
        <WithdrawalRequestForm
          onClose={closeWithdrawalForm}
          onPayoutSuccess={handlePayoutSuccess}
        />
      </>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {payoutSuccessToast}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Card 1: Completed Payout Amount */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
          className="bg-gradient-to-br from-[#0f0f17] to-[#1a1a24] border border-[#2a2a3a] rounded-xl p-6 hover:border-[#00FF94]/50 transition-all hover:shadow-lg hover:shadow-[#00FF94]/10"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-lg bg-[#00FF94]/10 flex items-center justify-center">
              <CheckCircle size={24} className="text-[#00FF94]" />
            </div>
            <span className="text-[#00FF94] text-xs font-medium px-2 py-1 bg-[#00FF94]/10 rounded">
              {text.completedLabel}
            </span>
          </div>
          <h3 className="text-gray-400 text-sm mb-2">{text.completedPayoutAmount}</h3>
          <p className="text-white text-4xl font-bold mb-1">
            {completedPayoutAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            <span className="text-xs ml-3 text-gray-500">USDT</span>
          </p>
        </motion.div>

        {/* Card 2: Pending Request Amount */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-[#0f0f17] to-[#1a1a24] border border-[#2a2a3a] rounded-xl p-6 hover:border-[#0052FF]/50 transition-all hover:shadow-lg hover:shadow-[#0052FF]/10"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-lg bg-[#0052FF]/10 flex items-center justify-center">
              <Clock size={24} className="text-[#0052FF]" />
            </div>
            <span className="text-[#0052FF] text-xs font-medium px-2 py-1 bg-[#0052FF]/10 rounded">
              {text.pendingLabel}
            </span>
          </div>
          <h3 className="text-gray-400 text-sm mb-2">{text.pendingRequestAmount}</h3>
          <p className="text-white text-4xl font-bold mb-1">
            {pendingRequestAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            <span className="text-xs ml-3 text-gray-500">USDT</span>
          </p>
        </motion.div>

        {/* Card 3: Payout Request Count */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-[#0f0f17] to-[#1a1a24] border border-[#2a2a3a] rounded-xl p-6 hover:border-purple-500/50 transition-all hover:shadow-lg hover:shadow-purple-500/10"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <FileText size={24} className="text-purple-400" />
            </div>
            <span className="text-purple-400 text-xs font-medium px-2 py-1 bg-purple-500/10 rounded">
              {text.totalLabel}
            </span>
          </div>
          <h3 className="text-gray-400 text-sm mb-2">{text.payoutRequest}</h3>
          <p className="text-white text-4xl font-bold mb-1">{payoutRequestCount}</p>
        </motion.div>
      </div>

      <>
        {/* Search & Filter Section for Funded Account History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.5 }}
          className="mb-6"
        >
          <FilterCard
            title={text.searchAndFilter}
            icon={<Filter size={20} className="text-[#0052FF]" />}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
              {/* Account ID Search */}
              <FilterField label={text.accountIdLabel}>
                <FilterTextInput
                  icon={
                    <Search
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
                    />
                  }
                  value={searchAccountId}
                  onChange={(e) => handleSearchAccountIdChange(e.target.value)}
                  placeholder={text.searchPlaceholder}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  inputClassName="pl-10 pr-4"
                />
              </FilterField>

              {/* Funding Type Dropdown */}
              <FilterField label={text.fundingTypeLabel}>
                <FilterDropdown
                  label={text.fundingTypeLabel}
                  value={
                    fundingTypeFilterOptions.find((option) => option.value === fundingTypeFilter)
                      ?.label ?? fundingTypeFilter
                  }
                  isOpen={showFundingTypeDropdown}
                  onToggle={() => {
                    setShowFundingTypeDropdown((isOpen) => !isOpen);
                    setShowFundedAccountStatusDropdown(false);
                  }}
                  onClose={() => setShowFundingTypeDropdown(false)}
                  onSelect={(value) => {
                    const selectedOption = fundingTypeFilterOptions.find(
                      (option) => option.label === value,
                    );
                    handleFundingTypeChange(selectedOption?.value ?? 'All');
                    setShowFundingTypeDropdown(false);
                  }}
                  options={fundingTypeFilterOptions.map((option) => option.label)}
                />
              </FilterField>

              {/* Start Date Picker */}
              <FilterField label={text.startDateLabel}>
                <FilterDateInput
                  icon={
                    <Calendar
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
                    />
                  }
                  value={startDate}
                  max={endDate || undefined}
                  onPickerOpen={() => {
                    setShowFundingTypeDropdown(false);
                    setShowFundedAccountStatusDropdown(false);
                  }}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                />
              </FilterField>

              {/* End Date Picker */}
              <FilterField label={text.endDateLabel}>
                <FilterDateInput
                  icon={
                    <Calendar
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
                    />
                  }
                  value={endDate}
                  min={startDate || undefined}
                  onPickerOpen={() => {
                    setShowFundingTypeDropdown(false);
                    setShowFundedAccountStatusDropdown(false);
                  }}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                />
              </FilterField>

              {/* Status Dropdown */}
              <FilterField label={text.statusLabel}>
                <FilterDropdown
                  label={text.statusLabel}
                  value={
                    fundedAccountStatusFilter === 'All'
                      ? text.statusAll
                      : getFundedStatusLabel(fundedAccountStatusFilter)
                  }
                  isOpen={showFundedAccountStatusDropdown}
                  onToggle={() => {
                    setShowFundedAccountStatusDropdown((isOpen) => !isOpen);
                    setShowFundingTypeDropdown(false);
                  }}
                  onClose={() => setShowFundedAccountStatusDropdown(false)}
                  onSelect={(value) => {
                    const selectedOption = fundedStatusFilterOptions.find(
                      (option) => option.label === value,
                    );
                    handleFundedStatusChange(selectedOption?.value ?? 'All');
                    setShowFundedAccountStatusDropdown(false);
                  }}
                  options={fundedStatusFilterOptions.map((option) => option.label)}
                />
              </FilterField>
            </div>

            {/* Action Buttons */}
            <FilterActions className="flex justify-end">
              <button
                onClick={handleResetFilters}
                className="px-4 py-2 bg-[#1a1a24] text-gray-400 rounded-lg text-sm hover:bg-[#24243a] hover:text-white transition-colors"
              >
                {text.resetFilters}
              </button>
            </FilterActions>
          </FilterCard>
        </motion.div>

        {/* Funded Account History Table */}
        <motion.div
          id="funded-history-table"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.6 }}
          className="bg-[#0f0f17] border border-[#1a1a24] rounded-xl overflow-hidden"
        >
          <div className="p-6 border-b border-[#1a1a24]">
            <div>
              <h2 className="text-white text-xl font-semibold mb-1">
                {text.fundedAccountHistoryTitle}
              </h2>
              <p className="text-gray-400 text-sm">{text.fundedAccountHistorySubtitle}</p>
            </div>
          </div>

          <DataTable
            data={displayData}
            columns={fundedAccountColumns}
            // 열이 8개라 1440px에서 헤더·버튼 글자가 두 줄로 내려가지 않도록 좌우 여백을 줄이고 줄바꿈을 막는다.
            desktopHeaderCellClassName="px-2 min-[1440px]:px-3 py-4 text-xs font-medium uppercase tracking-normal min-[1440px]:tracking-wide text-gray-400 whitespace-nowrap"
            desktopCellClassName="px-2 min-[1440px]:px-3 py-5 whitespace-nowrap"
            keyExtractor={(item) => item.id}
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={fundedAccountsResponse?.total ?? fundedAccounts.length}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
            onLoadMore={handleLoadMore}
            hasMore={currentPage < totalPages}
            isLoading={isFetchingFundedAccounts}
            emptyMessage={text.noFundedAccountsMatching}
            summaryLabel={text.summaryLabel}
            endOfResultsLabel={text.endOfFundedAccounts}
            previousLabel={text.previous}
            nextLabel={text.next}
            showingRangeLabel={text.showingAccounts}
            renderMobileCard={(account, index) => (
              <motion.div
                key={account.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-[#16161f] border border-[#2a2a3a] rounded-lg p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-white font-mono text-sm mb-1">
                      {account.mt4Login.toString()}
                      <span className="ml-2 font-sans text-xs font-semibold text-[#00FF94]">
                        {account.accountType}
                      </span>
                    </p>
                    <p className="text-[#0052FF] text-xs font-semibold">
                      ${account.funding.toLocaleString('en-US')} {text.fundedCapitalMobile}
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${getFundedAccountStatusStyle(account.status)}`}
                    >
                      {account.status === 'ACTIVE' ? (
                        <CheckCircle size={14} />
                      ) : (
                        <Clock size={14} />
                      )}
                      {account.statusLabel}
                    </span>
                    {renderBanReasonIcon(account)}
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-xs">{text.colBalance}</span>
                    <span className="text-white text-sm font-medium">
                      ${account.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-xs">{text.colProfit}</span>
                    <span
                      className={`text-sm font-semibold ${account.profit >= 0 ? 'text-[#00FF94]' : 'text-red-400'}`}
                    >
                      {account.profit >= 0 ? '+' : ''}$
                      {account.profit.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    disabled={account.mt4Login <= 0}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#0052FF] hover:bg-[#0052FF]/90 text-white rounded-lg text-sm transition-colors disabled:cursor-not-allowed disabled:bg-[#24243a] disabled:text-gray-500 disabled:hover:bg-[#24243a]"
                    onClick={() => handleViewFundedAccountDetails(account)}
                  >
                    <Eye size={16} />
                    <span>{text.details}</span>
                  </button>
                  <button
                    className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isPayoutDisabled(account)
                        ? 'bg-gray-600/30 text-gray-500 cursor-not-allowed'
                        : 'bg-[#00FF94] hover:bg-[#00FF94]/90 text-[#0f0f17]'
                    }`}
                    onClick={() => handleAccountWithdraw(account)}
                    disabled={isPayoutDisabled(account)}
                  >
                    {withdrawingAccounts.has(account.id) ? (
                      <Clock size={16} className="animate-spin" />
                    ) : (
                      <ArrowUpRight size={16} />
                    )}
                    <span className="hidden sm:inline">{text.requestPayout}</span>
                    <span className="sm:hidden">{text.payout}</span>
                  </button>
                </div>
              </motion.div>
            )}
          />

          {fundedAccounts.length === 0 && (
            <div className="p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#1a1a24] flex items-center justify-center">
                <Wallet size={32} className="text-gray-500" />
              </div>
              <h3 className="text-white text-lg font-medium mb-2">{text.emptyFundedAccounts}</h3>
              <p className="text-gray-400 text-sm">{text.emptyFundedAccountsHint}</p>
            </div>
          )}
        </motion.div>
      </>

      {/* Challenge Detail Modal */}
      {showDetailModal && selectedFundedAccount && (
        <ChallengeDetailModal
          isOpen={showDetailModal}
          challengeDetail={selectedFundedAccount}
          onClose={handleCloseDetailModal}
          onTradeHistorySettled={() => {
            if (!selectedFundedAccountId) return;
            window.setTimeout(() => {
              void queryClient.invalidateQueries({ queryKey: [...accountsQueryKeys.all, 'list'] });
              void queryClient.invalidateQueries({
                queryKey: accountsQueryKeys.detail(selectedFundedAccountId),
              });
            }, 1500);
          }}
        />
      )}

      <ActivePositionWarningModal
        isOpen={showActivePositionWarning}
        onClose={() => setShowActivePositionWarning(false)}
      />

      {hoveredBanReasonTooltip &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            {hoveredBanReasonTooltip.interaction === 'tap' && (
              <button
                type="button"
                aria-label={text.closeBanReasonTooltip}
                className="fixed inset-0 z-[99] bg-transparent lg:hidden"
                onClick={() => setHoveredBanReasonTooltip(null)}
              />
            )}
            <div
              className="fixed z-[100] pointer-events-none"
              style={{ left: hoveredBanReasonTooltip.x, top: hoveredBanReasonTooltip.y }}
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
                    <p className="text-white text-xs font-semibold mb-1">{text.banReason}</p>
                    <p className="text-gray-300 text-xs leading-relaxed">
                      {hoveredBanReasonTooltip.reason}
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
