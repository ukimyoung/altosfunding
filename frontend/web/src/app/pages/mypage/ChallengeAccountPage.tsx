import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import {
  Search,
  Calendar,
  Target,
  Eye,
  Filter,
  Trophy,
  Layers,
  Info,
  AlertCircle,
} from 'lucide-react';
import {
  type AccountDetailResponse,
  type ChallengeAccountStatus,
  type AccountListItem,
  CHALLENGE_ACCOUNT_STATUSES,
} from '@/api/accounts';
import {
  accountsQueryKeys,
  useAccountDetailQuery,
  useAccountsQuery,
  useChallengeSummaryQuery,
} from '@/app/queries/accounts';
import { formatBrowserGmtOffset, formatDateTimeByBrowserTimeZone } from '@/app/utils/date';
import { ChallengeDetailModal } from '../../components/shared/ChallengeDetailModal';
import { DataTable, Column } from '../../components/shared/DataTable';
import {
  FilterActions,
  FilterCard,
  FilterDateInput,
  FilterDropdown,
  FilterField,
  FilterTextInput,
} from '../../components/shared/FilterControls';
import { useSearchParams } from 'react-router';
import { applyScopedSearchParams, createScopedSearchParams } from '../../utils/url/queryParams';
import { useLocale } from '@/app/i18n/LocaleContext';

type AccountTypeFilter = 'All' | '$100' | '$300' | '$500';
type ChallengeStatusFilter = 'All' | ChallengeAccountStatus;

type Challenge = {
  account_id: string;
  mt4Login: number | null;
  accountType: string;
  startDate: string;
  endDate: string;
  rawStartDate?: string;
  rawEndDate?: string;
  capital: number;
  balance: number;
  profit: number;
  status: ChallengeAccountStatus;
  statusLabel: string;
  banReason?: string;
  isDepositConfirmed: boolean;
  winRate?: number;
};

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

const CHALLENGE_TYPE_FILTER_TO_CODE: Record<AccountTypeFilter, string | undefined> = {
  All: undefined,
  $100: '100',
  $300: '300',
  $500: '500',
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

const CHALLENGE_QUERY_KEYS = {
  search: 'search',
  start: 'start',
  end: 'end',
  status: 'status',
  type: 'type',
  page: 'page',
} as const;

const parsePage = (value: string | null) => {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
};

const toMt4LoginParam = (value: string) => {
  const digits = value.replace(/\D/g, '');
  const mt4Login = Number(digits);

  return Number.isSafeInteger(mt4Login) && mt4Login > 0 ? mt4Login : undefined;
};

const parseChallengeAccountTypeFilter = (value: string | null): AccountTypeFilter => {
  if (value === '$100' || value === '$300' || value === '$500') {
    return value;
  }

  return 'All';
};

const formatChallengeAccountType = (
  typeCode: string | number | null | undefined,
  labels: Record<string, string>,
) => {
  if (typeCode === null || typeCode === undefined || typeCode === '') {
    return '-';
  }

  const code = String(typeCode);

  return labels[code.replace(/^\$/, '')] ?? `$${code.replace(/^\$/, '')}`;
};

// 계좌 유형은 상품명에서 공통 접두어 'Challenge '를 뺀 이름 (예: Challenge Starter → Starter).
// 상품명이 없으면 기존 type_code 표시를 쓴다.
const formatChallengeProductName = (productName: string | null | undefined) =>
  productName?.trim().replace(/^challenge\s+/i, '') || '';

const formatStatusDisplay = (status: string) => status.trim() || '-';
const formatStatusLabel = (status: string) =>
  status
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase()) || '-';

const formatChallengeAccountId = (mt4Login: number | null) => {
  if (mt4Login === null || mt4Login === 0) return '-';

  return mt4Login.toString();
};

const normalizeStatusValue = (status: string) =>
  status
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');

const toChallengeStatus = (status: string): ChallengeAccountStatus => {
  const normalizedStatus = normalizeStatusValue(status) as ChallengeAccountStatus;

  return CHALLENGE_ACCOUNT_STATUSES.includes(normalizedStatus) ? normalizedStatus : 'INACTIVE';
};

const mapAccountDetailToModal = (detail: AccountDetailResponse): ChallengeDetail => {
  const accountNumber = formatChallengeAccountId(detail.mt4_login);
  const displayDate =
    formatDateTimeByBrowserTimeZone(detail.created_at || detail.start_date || '') || '-';
  const status = toChallengeStatus(detail.status);
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
        symbol: detail.type_code || '-',
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

export function ChallengeAccountPage() {
  const { T } = useLocale();
  const text = T.challenge;
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchAccountId, setSearchAccountId] = useState(
    () => searchParams.get(CHALLENGE_QUERY_KEYS.search) ?? '',
  );
  const [startDate, setStartDate] = useState(() =>
    fromQueryDate(searchParams.get(CHALLENGE_QUERY_KEYS.start)),
  );
  const [endDate, setEndDate] = useState(() =>
    fromQueryDate(searchParams.get(CHALLENGE_QUERY_KEYS.end)),
  );
  const [statusFilter, setStatusFilter] = useState<ChallengeStatusFilter>(
    () => (searchParams.get(CHALLENGE_QUERY_KEYS.status) as ChallengeStatusFilter) ?? 'All',
  );
  const [accountTypeFilter, setAccountTypeFilter] = useState<AccountTypeFilter>(() =>
    parseChallengeAccountTypeFilter(searchParams.get(CHALLENGE_QUERY_KEYS.type)),
  );
  const [appliedSearchAccountId, setAppliedSearchAccountId] = useState(
    () => searchParams.get(CHALLENGE_QUERY_KEYS.search) ?? '',
  );
  const [appliedStartDate, setAppliedStartDate] = useState(() =>
    fromQueryDate(searchParams.get(CHALLENGE_QUERY_KEYS.start)),
  );
  const [appliedEndDate, setAppliedEndDate] = useState(() =>
    fromQueryDate(searchParams.get(CHALLENGE_QUERY_KEYS.end)),
  );
  const [appliedStatusFilter, setAppliedStatusFilter] = useState<ChallengeStatusFilter>(
    () => (searchParams.get(CHALLENGE_QUERY_KEYS.status) as ChallengeStatusFilter) ?? 'All',
  );
  const [appliedAccountTypeFilter, setAppliedAccountTypeFilter] = useState<AccountTypeFilter>(() =>
    parseChallengeAccountTypeFilter(searchParams.get(CHALLENGE_QUERY_KEYS.type)),
  );
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showAccountTypeDropdown, setShowAccountTypeDropdown] = useState(false);
  const isSearchInputDirtyRef = useRef(false);
  const [hoveredBanReasonTooltip, setHoveredBanReasonTooltip] = useState<{
    reason: string;
    x: number;
    y: number;
    interaction: 'hover' | 'tap';
  } | null>(null);

  // DataTable 관련 상태
  const [currentPage, setCurrentPage] = useState(() =>
    parsePage(searchParams.get(CHALLENGE_QUERY_KEYS.page)),
  );
  const itemsPerPage = 20;
  const updateChallengeQueryParams = (updates: Record<string, string | undefined>) => {
    const next = applyScopedSearchParams(
      searchParams,
      Object.values(CHALLENGE_QUERY_KEYS),
      updates,
    );

    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    const normalized = createScopedSearchParams(searchParams, Object.values(CHALLENGE_QUERY_KEYS));

    if (normalized.toString() !== searchParams.toString()) {
      setSearchParams(normalized, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const [showModal, setShowModal] = useState(false);
  const { data: challengeSummary } = useChallengeSummaryQuery();
  const challengeAccountsParams = useMemo(
    () => ({
      tier: 'CHALLENGE' as const,
      status: appliedStatusFilter === 'All' ? undefined : appliedStatusFilter,
      type_code: CHALLENGE_TYPE_FILTER_TO_CODE[appliedAccountTypeFilter],
      mt4_login: toMt4LoginParam(appliedSearchAccountId),
      start_date: toApiDate(appliedStartDate),
      end_date: toApiDate(appliedEndDate),
      page: currentPage,
      size: itemsPerPage,
    }),
    [
      appliedAccountTypeFilter,
      appliedEndDate,
      appliedSearchAccountId,
      appliedStartDate,
      appliedStatusFilter,
      currentPage,
      itemsPerPage,
    ],
  );
  const { data: challengeAccountsResponse, isFetching: isFetchingChallengeAccounts } =
    useAccountsQuery(challengeAccountsParams);

  const getChallengeStatusLabel = (status: ChallengeAccountStatus) => {
    switch (status) {
      case 'ACTIVE':
        return text.statusActive;
      case 'IN_PROGRESS':
        return text.statusInProgress;
      case 'PASSED':
        return text.statusPassed;
      case 'FAILED':
        return text.statusFailed;
      case 'PENDING':
        return text.statusPending;
      case 'BANNED':
        return text.statusBanned;
      case 'CLOSED':
        return text.statusClosed;
      case 'INACTIVE':
      default:
        return text.statusInactive;
    }
  };

  // type_code를 기반으로 계정 유형 레이블을 매핑 >> 나중에 백엔드 요청 혹은 수정 필요할수도?
  const accountTypeLabels: Record<string, string> = {
    '100': text.accountTypeStarter,
    '300': text.accountTypeProfessional,
    '500': text.accountTypeElite,
  };
  const accountTypeFilterOptions = [
    text.statusAll,
    text.accountTypeStarter,
    text.accountTypeProfessional,
    text.accountTypeElite,
  ] as const;
  const accountTypeFilterValues: Record<string, AccountTypeFilter> = {
    [text.accountTypeStarter]: '$100',
    [text.accountTypeProfessional]: '$300',
    [text.accountTypeElite]: '$500',
  };
  const statusFilterOptions = [
    { label: text.statusAll, value: 'All' as const },
    ...CHALLENGE_ACCOUNT_STATUSES.map((status) => ({
      label: getChallengeStatusLabel(status),
      value: status,
    })),
  ];

  const challengeAccounts = useMemo<Challenge[]>(() => {
    const accountItems = challengeAccountsResponse?.items ?? [];

    return accountItems.map((item) => {
      return {
        account_id: item.account_id,
        mt4Login: item.mt4_login,
        accountType:
          formatChallengeProductName(item.product_name) ||
          formatChallengeAccountType(item.type_code, accountTypeLabels),
        startDate: formatDateTimeByBrowserTimeZone(item.start_date || '') || '-',
        endDate: formatDateTimeByBrowserTimeZone(item.end_date || '') || '-',
        rawStartDate: item.start_date || undefined,
        rawEndDate: item.end_date || undefined,
        capital: item.capital ?? 0,
        balance: item.balance ?? 0,
        profit: item.total_profit ?? 0,
        status: toChallengeStatus(item.status),
        statusLabel: getChallengeStatusLabel(toChallengeStatus(item.status)),
        banReason: item.reason ?? undefined,
        isDepositConfirmed: !item.is_read_only,
      };
    });
  }, [challengeAccountsResponse, text]);

  useEffect(() => {
    const nextSearch = searchParams.get(CHALLENGE_QUERY_KEYS.search) ?? '';
    const nextStart = fromQueryDate(searchParams.get(CHALLENGE_QUERY_KEYS.start));
    const nextEnd = fromQueryDate(searchParams.get(CHALLENGE_QUERY_KEYS.end));
    const nextStatus =
      (searchParams.get(CHALLENGE_QUERY_KEYS.status) as ChallengeStatusFilter) ?? 'All';
    const nextType = parseChallengeAccountTypeFilter(searchParams.get(CHALLENGE_QUERY_KEYS.type));
    const nextPage = parsePage(searchParams.get(CHALLENGE_QUERY_KEYS.page));

    if (!isSearchInputDirtyRef.current) {
      setSearchAccountId(nextSearch);
      setAppliedSearchAccountId(nextSearch);
    }

    setStartDate(nextStart);
    setEndDate(nextEnd);
    setStatusFilter(nextStatus);
    setAccountTypeFilter(nextType);

    setAppliedStartDate(nextStart);
    setAppliedEndDate(nextEnd);
    setAppliedStatusFilter(nextStatus);
    setAppliedAccountTypeFilter(nextType);
    setCurrentPage(nextPage);
  }, [searchParams]);

  useEffect(() => {
    if (!isSearchInputDirtyRef.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      const trimmedSearchAccountId = searchAccountId.trim();

      isSearchInputDirtyRef.current = false;
      setAppliedSearchAccountId(trimmedSearchAccountId);
      setCurrentPage(1);

      const next = applyScopedSearchParams(searchParams, Object.values(CHALLENGE_QUERY_KEYS), {
        [CHALLENGE_QUERY_KEYS.search]: trimmedSearchAccountId || undefined,
        [CHALLENGE_QUERY_KEYS.page]: '1',
      });

      setSearchParams(next, { replace: true });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchAccountId, searchParams, setSearchParams]);

  const handleSearchAccountIdChange = (value: string) => {
    isSearchInputDirtyRef.current = true;
    setSearchAccountId(value.replace(/\D/g, ''));
  };

  const handleStartDateChange = (value: string) => {
    if (endDate && value && value > endDate) {
      return;
    }

    setStartDate(value);
    setAppliedStartDate(value);
    setCurrentPage(1);
    updateChallengeQueryParams({
      [CHALLENGE_QUERY_KEYS.start]: toApiDate(value),
      [CHALLENGE_QUERY_KEYS.page]: '1',
    });
  };

  const handleEndDateChange = (value: string) => {
    if (startDate && value && value < startDate) {
      return;
    }

    setEndDate(value);
    setAppliedEndDate(value);
    setCurrentPage(1);
    updateChallengeQueryParams({
      [CHALLENGE_QUERY_KEYS.end]: toApiDate(value),
      [CHALLENGE_QUERY_KEYS.page]: '1',
    });
  };

  const handleStatusChange = (value: ChallengeStatusFilter) => {
    setStatusFilter(value);
    setAppliedStatusFilter(value);
    setCurrentPage(1);
    updateChallengeQueryParams({
      [CHALLENGE_QUERY_KEYS.status]: value === 'All' ? undefined : value,
      [CHALLENGE_QUERY_KEYS.page]: '1',
    });
  };

  const handleAccountTypeChange = (value: AccountTypeFilter) => {
    setAccountTypeFilter(value);
    setAppliedAccountTypeFilter(value);
    setCurrentPage(1);
    updateChallengeQueryParams({
      [CHALLENGE_QUERY_KEYS.type]: value === 'All' ? undefined : value,
      [CHALLENGE_QUERY_KEYS.page]: '1',
    });
  };

  const handleResetFilters = () => {
    isSearchInputDirtyRef.current = false;
    setSearchAccountId('');
    setStartDate('');
    setEndDate('');
    setStatusFilter('All');
    setAccountTypeFilter('All');
    setAppliedSearchAccountId('');
    setAppliedStartDate('');
    setAppliedEndDate('');
    setAppliedStatusFilter('All');
    setAppliedAccountTypeFilter('All');
    setCurrentPage(1);
    updateChallengeQueryParams({
      [CHALLENGE_QUERY_KEYS.search]: undefined,
      [CHALLENGE_QUERY_KEYS.start]: undefined,
      [CHALLENGE_QUERY_KEYS.end]: undefined,
      [CHALLENGE_QUERY_KEYS.status]: undefined,
      [CHALLENGE_QUERY_KEYS.type]: undefined,
      [CHALLENGE_QUERY_KEYS.page]: '1',
    });
  };

  // 상세 데이터를 담을 상태 추가
  const [selectedDetail, setSelectedDetail] = useState<ChallengeDetail | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const { data: selectedAccountDetailResponse } = useAccountDetailQuery(
    selectedAccountId ?? '',
    selectedAccountId !== null,
  );

  useEffect(() => {
    if (selectedAccountId === null || !selectedAccountDetailResponse) return;

    setSelectedDetail(mapAccountDetailToModal(selectedAccountDetailResponse));
    setShowModal(true);
  }, [queryClient, selectedAccountId, selectedAccountDetailResponse]);

  const canViewDetails = (challenge: Challenge) => !!challenge.account_id;

  const handleViewDetails = (challenge: Challenge) => {
    if (!canViewDetails(challenge)) return;

    setSelectedDetail(null);
    setSelectedAccountId(challenge.account_id);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedAccountId(null);
    setSelectedDetail(null); // 모달 닫을 때 초기화
  };

  const displayData = challengeAccounts;
  const serverTotalPages = challengeAccountsResponse?.pages;
  const totalPages = Math.max(1, serverTotalPages ?? currentPage);

  const handleLoadMore = () => {
    if (currentPage < totalPages && !isFetchingChallengeAccounts) {
      setCurrentPage((prev) => {
        const nextPage = prev + 1;
        updateChallengeQueryParams({
          [CHALLENGE_QUERY_KEYS.page]: String(nextPage),
        });
        return nextPage;
      });
    }
  };

  const getStatusColor = (status: ChallengeAccountStatus) => {
    switch (status) {
      case 'ACTIVE':
      case 'IN_PROGRESS':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'PASSED':
        return 'bg-[#00FF94]/10 text-[#00FF94] border-[#00FF94]/30';
      case 'FAILED':
      case 'BANNED':
        return 'bg-red-500/10 text-red-400 border-red-500/30';
      case 'PENDING':
        return 'bg-[#FFB800]/10 text-[#FFB800] border-[#FFB800]/30';
      case 'INACTIVE':
        return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
    }
  };

  const renderBanReasonIcon = (challenge: Challenge) => {
    if (challenge.status !== 'BANNED' || !challenge.banReason) {
      return null;
    }

    return (
      <button
        type="button"
        className="w-4 h-4 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center cursor-pointer hover:bg-red-500/20 transition-colors"
        onMouseEnter={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setHoveredBanReasonTooltip({
            reason: challenge.banReason ?? '',
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
            if (prev?.interaction === 'tap' && prev.reason === challenge.banReason) {
              return null;
            }

            return {
              reason: challenge.banReason ?? '',
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

  const getProfitColor = (profit: number) => {
    if (profit > 0) return 'text-[#00FF94]';
    if (profit < 0) return 'text-red-400';
    return 'text-gray-400';
  };

  const formatProfit = (profit: number) => {
    const amount = `$${Math.abs(profit).toLocaleString()}`;
    if (profit > 0) return `+${amount}`;
    if (profit < 0) return `-${amount}`;
    return amount;
  };

  // DataTable Columns Definition
  const columns: Column<Challenge>[] = [
    {
      header: text.colAccountId,
      accessor: (item) => (
        <p className={`font-mono text-sm ${item.mt4Login ? 'text-white' : 'text-gray-500'}`}>
          {formatChallengeAccountId(item.mt4Login)}
        </p>
      ),
    },
    {
      header: text.colAccountType,
      accessor: (item) => (
        <span className="text-[#00FF94] text-sm font-semibold">{item.accountType}</span>
      ),
    },
    {
      header: text.colCapital,
      align: 'center',
      accessor: (item) => (
        <p className="text-[#FFB800] text-sm font-bold">${item.capital.toLocaleString()}</p>
      ),
    },
    {
      header: text.colChallengePeriod,
      accessor: (item) => (
        <div className="whitespace-nowrap">
          <p className="text-white text-sm">
            {item.startDate && item.endDate ? `${item.startDate} ~ ${item.endDate}` : '-'}
          </p>
          {item.rawStartDate && item.rawEndDate && (
            <p className="text-gray-500 text-xs mt-1">
              {formatBrowserGmtOffset(item.rawStartDate)}
            </p>
          )}
        </div>
      ),
    },
    {
      header: text.colBalance,
      align: 'right',
      accessor: (item) => (
        <p className="text-white font-medium">${item.balance.toLocaleString()}</p>
      ),
    },
    {
      header: text.colProfit,
      align: 'right',
      accessor: (item) => (
        <p className={`font-semibold ${getProfitColor(item.profit)}`}>
          {formatProfit(item.profit)}
        </p>
      ),
    },
    {
      header: text.colStatus,
      align: 'center',
      accessor: (item) => (
        <div className="flex justify-center items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(item.status)}`}
          >
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
            disabled={!canViewDetails(item)}
            className="flex items-center gap-2 px-4 py-2 bg-[#0052FF] hover:bg-[#0066FF] text-white rounded-lg text-sm transition-colors disabled:cursor-not-allowed disabled:bg-[#24243a] disabled:text-gray-500 disabled:hover:bg-[#24243a]"
            onClick={() => handleViewDetails(item)}
          >
            <Eye size={16} /> <span>{text.details}</span>
          </button>
        </div>
      ),
    },
  ];

  // 계좌 유형별 개수: 상품명에서 'Challenge '를 뺀 이름(Starter·Professional·Elite·Prime)으로 센다.
  // 같은 이름의 상품이 여러 개면 합산한다. 기존 서버 상품(PROD_EVAL_100 등)은 금액으로도 맞춘다.
  const getAccountTypeCount = (typeName: string, legacyAmount?: number) =>
    (challengeSummary?.by_product ?? [])
      .filter((product) => {
        if (formatChallengeProductName(product.product_name).toLowerCase() === typeName) {
          return true;
        }
        if (legacyAmount === undefined) {
          return false;
        }
        const amountText = String(legacyAmount);
        return (
          product.product_id.toUpperCase() === `PROD_EVAL_${amountText}` ||
          product.product_name.replace(/[$,\s]/g, '').includes(amountText)
        );
      })
      .reduce((sum, product) => sum + (product.count ?? 0), 0);

  const accountType100Count = getAccountTypeCount('starter', 100);
  const accountType300Count = getAccountTypeCount('professional', 300);
  const accountType500Count = getAccountTypeCount('elite', 500);
  const accountTypePrimeCount = getAccountTypeCount('prime');

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Top Section - Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-[#0f0f17] to-[#1a1a24] border border-[#2a2a3a] rounded-xl p-6 hover:border-[#0052FF]/50 transition-all shadow-lg hover:shadow-[#0052FF]/10"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-[#0052FF]/10 flex items-center justify-center">
                <Trophy size={24} className="text-[#0052FF]" />
              </div>
              <span className="text-[#0052FF] text-xs font-medium px-2 py-1 bg-[#0052FF]/10 rounded">
                {text.totalLabel}
              </span>
            </div>
            <h3 className="text-gray-400 text-sm mb-2">{text.totalChallenges}</h3>
            <p className="text-white text-4xl font-bold mb-1">
              {challengeSummary?.total_challenges ?? 0}
            </p>
            <p className="text-gray-500 text-xs">{text.allTimeParticipation}</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-[#0f0f17] to-[#1a1a24] border border-[#2a2a3a] rounded-xl p-6 hover:border-purple-500/50 transition-all shadow-lg hover:shadow-purple-500/10"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Layers size={24} className="text-purple-400" />
              </div>
              <span className="text-purple-400 text-xs font-medium px-2 py-1 bg-purple-500/10 rounded">
                {text.typesLabel}
              </span>
            </div>
            <h3 className="text-gray-400 text-sm mb-3">{text.accountTypes}</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-300 text-sm">{text.accountTypeStarter}</span>
                <span className="text-white text-sm font-bold">{accountType100Count}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-300 text-sm">{text.accountTypeProfessional}</span>
                <span className="text-white text-sm font-bold">{accountType300Count}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-300 text-sm">{text.accountTypeElite}</span>
                <span className="text-white text-sm font-bold">{accountType500Count}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-300 text-sm">{text.accountTypePrime}</span>
                <span className="text-white text-sm font-bold">{accountTypePrimeCount}</span>
              </div>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-[#0f0f17] to-[#1a1a24] border border-[#2a2a3a] rounded-xl p-6 hover:border-[#00FF94]/50 transition-all shadow-lg hover:shadow-[#00FF94]/10"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-[#00FF94]/10 flex items-center justify-center">
                <Target size={24} className="text-[#00FF94]" />
              </div>
              <span className="text-[#00FF94] text-xs font-medium px-2 py-1 bg-[#00FF94]/10 rounded">
                {text.activeLabel}
              </span>
            </div>
            <h3 className="text-gray-400 text-sm mb-2">{text.totalActiveChallenges}</h3>
            <p className="text-white text-4xl font-bold mb-1">
              {challengeSummary?.active_challenges ?? 0}
            </p>
            <p className="text-gray-500 text-xs">{text.currentlyInProgress}</p>
          </motion.div>
        </div>

        {/* Search & Filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-8"
        >
          <FilterCard
            title={text.searchAndFilter}
            icon={<Filter size={20} className="text-[#0052FF]" />}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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

              {/* Account Type Dropdown */}
              <FilterField label={text.accountTypeLabel}>
                <FilterDropdown
                  label={text.accountTypeLabel}
                  value={
                    accountTypeFilter === 'All'
                      ? text.statusAll
                      : accountTypeLabels[accountTypeFilter.replace(/^\$/, '')]
                  }
                  isOpen={showAccountTypeDropdown}
                  onToggle={() => {
                    setShowAccountTypeDropdown((isOpen) => !isOpen);
                    setShowStatusDropdown(false);
                  }}
                  onClose={() => setShowAccountTypeDropdown(false)}
                  onSelect={(value) => {
                    handleAccountTypeChange(
                      value === text.statusAll ? 'All' : accountTypeFilterValues[value],
                    );
                    setShowAccountTypeDropdown(false);
                  }}
                  options={accountTypeFilterOptions}
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
                    setShowAccountTypeDropdown(false);
                    setShowStatusDropdown(false);
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
                    setShowAccountTypeDropdown(false);
                    setShowStatusDropdown(false);
                  }}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                />
              </FilterField>

              {/* Status Dropdown */}
              <FilterField label={text.statusLabel}>
                <FilterDropdown
                  label={text.statusLabel}
                  value={
                    statusFilter === 'All' ? text.statusAll : getChallengeStatusLabel(statusFilter)
                  }
                  isOpen={showStatusDropdown}
                  onToggle={() => {
                    setShowStatusDropdown((isOpen) => !isOpen);
                    setShowAccountTypeDropdown(false);
                  }}
                  onClose={() => setShowStatusDropdown(false)}
                  onSelect={(value) => {
                    handleStatusChange(
                      statusFilterOptions.find((option) => option.label === value)?.value ?? 'All',
                    );
                    setShowStatusDropdown(false);
                  }}
                  options={statusFilterOptions.map((option) => option.label)}
                />
              </FilterField>
            </div>

            {/* Reset Filters Button */}
            <FilterActions className="mt-4 flex justify-end">
              <button
                onClick={handleResetFilters}
                className="px-4 py-2 bg-[#1a1a24] text-gray-400 rounded-lg text-sm hover:bg-[#24243a] hover:text-white transition-colors"
              >
                {text.resetFilters}
              </button>
            </FilterActions>
          </FilterCard>
        </motion.div>

        {/* Challenge List - DataTable Applied */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-[#0f0f17] border border-[#2a2a3a] rounded-xl overflow-hidden"
        >
          <div className="p-6 border-b border-[#2a2a3a]">
            <h3 className="text-white font-semibold text-lg">{text.challengeAccounts}</h3>
            <p className="text-gray-400 text-sm mt-1">
              {text.showingOf
                .replace('{count}', String(challengeAccounts.length))
                .replace(
                  '{total}',
                  String(challengeAccountsResponse?.total ?? challengeAccounts.length),
                )}
            </p>
          </div>

          <DataTable
            data={displayData}
            columns={columns}
            keyExtractor={(item) => item.mt4Login ?? item.account_id}
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={challengeAccountsResponse?.total ?? challengeAccounts.length}
            itemsPerPage={itemsPerPage}
            onPageChange={(page) => {
              setCurrentPage(page);
              updateChallengeQueryParams({
                [CHALLENGE_QUERY_KEYS.page]: String(page),
              });
            }}
            onLoadMore={handleLoadMore}
            hasMore={currentPage < totalPages}
            isLoading={isFetchingChallengeAccounts}
            emptyMessage={text.noChallengeAccountsMatching}
            summaryLabel={text.challengeAccountsUnit}
            endOfResultsLabel={text.endOfChallengeAccounts}
            previousLabel={text.previous}
            nextLabel={text.next}
            showingRangeLabel={text.showingRange}
            renderMobileCard={(challenge, index) => (
              <motion.div
                key={challenge.mt4Login ?? challenge.account_id ?? index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (index % itemsPerPage) * 0.05 }}
                className="bg-[#16161f] border border-[#2a2a3a] rounded-lg p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p
                      className={`font-mono text-sm mb-1 ${challenge.mt4Login ? 'text-white' : 'text-gray-500'}`}
                    >
                      {formatChallengeAccountId(challenge.mt4Login)}
                    </p>
                    <p className="text-gray-400 text-xs">{challenge.accountType}</p>
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(challenge.status)}`}
                    >
                      {challenge.statusLabel}
                    </span>
                    {renderBanReasonIcon(challenge)}
                  </div>
                </div>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-xs">{text.periodLabel}</span>
                    <span className="text-white text-xs">
                      {challenge.startDate && challenge.endDate
                        ? `${challenge.startDate} ~ ${challenge.endDate}`
                        : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-xs">{text.colBalance}</span>
                    <span className="text-white text-sm font-medium">
                      ${challenge.balance.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-xs">{text.colProfit}</span>
                    <span className={`text-sm font-semibold ${getProfitColor(challenge.profit)}`}>
                      {formatProfit(challenge.profit)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleViewDetails(challenge)}
                  disabled={!canViewDetails(challenge)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#0052FF] hover:bg-[#0066FF] text-white rounded-lg text-sm transition-colors disabled:cursor-not-allowed disabled:bg-[#24243a] disabled:text-gray-500 disabled:hover:bg-[#24243a]"
                >
                  <Eye size={16} />
                  <span>{text.viewDetails}</span>
                </button>
              </motion.div>
            )}
          />

          {/* Empty State */}
          {challengeAccounts.length === 0 && (
            <div className="p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#1a1a24] flex items-center justify-center">
                <Target size={32} className="text-gray-500" />
              </div>
              <h3 className="text-white text-lg font-medium mb-2">{text.noChallengesFound}</h3>
              <p className="text-gray-400 text-sm">{text.noChallengesHint}</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Challenge Detail Modal */}
      {showModal && selectedDetail && (
        <ChallengeDetailModal
          isOpen={showModal}
          challengeDetail={selectedDetail} // 고정된 상태값 전달
          onClose={handleCloseModal}
          onTradeHistorySettled={() => {
            if (!selectedAccountId) return;
            window.setTimeout(() => {
              void queryClient.invalidateQueries({ queryKey: [...accountsQueryKeys.all, 'list'] });
              void queryClient.invalidateQueries({
                queryKey: accountsQueryKeys.detail(selectedAccountId),
              });
            }, 1500);
          }}
        />
      )}

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
