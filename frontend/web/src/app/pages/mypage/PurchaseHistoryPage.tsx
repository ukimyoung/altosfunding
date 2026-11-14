import { motion } from 'motion/react';
import { Calendar, Search, CheckCircle, Clock, XCircle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { type Order } from '@/api/orders';
import { useOrdersQuery } from '@/app/queries/orders';
import {
  FilterCard,
  FilterDateInput,
  FilterActions,
  FilterField,
  FilterSelect,
  FilterTextInput,
} from '@/app/components/shared/FilterControls';
import { formatBrowserGmtOffset, formatDateTimeByBrowserTimeZone } from '@/app/utils/date';
import { applyScopedSearchParams } from '@/app/utils/url/queryParams';
import { Column, DataTable } from '../../components/shared/DataTable';
import { useLocale } from '@/app/i18n/LocaleContext';

type PurchaseStatus = 'COMPLETED' | 'PENDING' | 'FAILED' | 'REFUNDED';
type PurchaseStatusFilter = 'All' | 'COMPLETED' | 'PENDING' | 'FAILED' | 'REFUNDED';

const formatChallengeTypeCode = (typeCode: string, labels: Record<string, string>) => {
  const normalized = typeCode.trim().toUpperCase();

  if (normalized === 'LIVE' || normalized === 'DEMO') {
    return normalized;
  }

  if (/^\$?\d+$/.test(normalized)) {
    const code = normalized.replace(/^\$/, '');
    return labels[code] ?? `$${code}`;
  }

  return typeCode || '-';
};

const toPurchaseHistoryItem = (order: Order, accountTypeLabels: Record<string, string>) => ({
  id: order.order_id,
  orderNo: order.order_id,
  date: formatDateTimeByBrowserTimeZone(order.created_at) || '-',
  rawDate: order.created_at,
  quantity: order.quantity,
  amountPaid: order.total_price,
  status: order.status.trim().toUpperCase() as PurchaseStatus,
  challengeType: formatChallengeTypeCode(order.type_code, accountTypeLabels),
  challengeId: order.challenge_id,
});

type PurchaseHistoryItem = ReturnType<typeof toPurchaseHistoryItem>;

const PURCHASE_QUERY_KEYS = {
  search: 'search',
  start: 'start',
  end: 'end',
  status: 'status',
  page: 'page',
} as const;

const parsePage = (value: string | null) => {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
};

const parseStatusFilter = (value: string | null): PurchaseStatusFilter => {
  const normalized = value?.trim().toUpperCase();

  if (
    normalized === 'COMPLETED' ||
    normalized === 'PENDING' ||
    normalized === 'FAILED' ||
    normalized === 'REFUNDED'
  ) {
    return normalized;
  }

  return 'All';
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

const toApiSearchQuery = (value: string, accountTypeLabels: Record<string, string>) => {
  const normalizedValue = value.trim().toLocaleLowerCase();
  const matchedAccountType = Object.entries(accountTypeLabels).find(
    ([, label]) => label.toLocaleLowerCase() === normalizedValue,
  );

  return matchedAccountType?.[0] ?? value;
};

export function PurchaseHistoryPage() {
  const { T } = useLocale();
  const text = T.purchaseHistory;
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(
    () => searchParams.get(PURCHASE_QUERY_KEYS.search) ?? '',
  );
  const [appliedSearchQuery, setAppliedSearchQuery] = useState(
    () => searchParams.get(PURCHASE_QUERY_KEYS.search) ?? '',
  );
  const [statusFilter, setStatusFilter] = useState<PurchaseStatusFilter>(() =>
    parseStatusFilter(searchParams.get(PURCHASE_QUERY_KEYS.status)),
  );
  const [currentPage, setCurrentPage] = useState(() =>
    parsePage(searchParams.get(PURCHASE_QUERY_KEYS.page)),
  );
  const [startDate, setStartDate] = useState(() =>
    fromQueryDate(searchParams.get(PURCHASE_QUERY_KEYS.start)),
  );
  const [endDate, setEndDate] = useState(() =>
    fromQueryDate(searchParams.get(PURCHASE_QUERY_KEYS.end)),
  );
  const lastSearchParamRef = useRef<string | null>(searchParams.get(PURCHASE_QUERY_KEYS.search));
  const latestFilterRef = useRef({
    startDate: searchParams.get(PURCHASE_QUERY_KEYS.start) ?? '',
    endDate: searchParams.get(PURCHASE_QUERY_KEYS.end) ?? '',
    statusFilter: parseStatusFilter(searchParams.get(PURCHASE_QUERY_KEYS.status)),
  });
  const didMountSearchEffectRef = useRef(false);
  const itemsPerPage = 20;

  useEffect(() => {
    const searchValue = searchParams.get(PURCHASE_QUERY_KEYS.search);

    if (lastSearchParamRef.current !== searchValue) {
      lastSearchParamRef.current = searchValue;
      const nextSearch = searchValue ?? '';
      setSearchQuery(nextSearch);
      setAppliedSearchQuery(nextSearch);
    }

    setStatusFilter(parseStatusFilter(searchParams.get(PURCHASE_QUERY_KEYS.status)));
    setStartDate(fromQueryDate(searchParams.get(PURCHASE_QUERY_KEYS.start)));
    setEndDate(fromQueryDate(searchParams.get(PURCHASE_QUERY_KEYS.end)));
    setCurrentPage(parsePage(searchParams.get(PURCHASE_QUERY_KEYS.page)));
  }, [searchParams]);

  useEffect(() => {
    latestFilterRef.current = {
      startDate,
      endDate,
      statusFilter,
    };
  }, [endDate, startDate, statusFilter]);

  useEffect(() => {
    if (!didMountSearchEffectRef.current) {
      didMountSearchEffectRef.current = true;
      return;
    }

    const timer = window.setTimeout(() => {
      const latestFilters = latestFilterRef.current;

      setAppliedSearchQuery(searchQuery);
      setCurrentPage(1);
      updateQueryParams({
        search: searchQuery || undefined,
        start: latestFilters.startDate || undefined,
        end: latestFilters.endDate || undefined,
        status: latestFilters.statusFilter !== 'All' ? latestFilters.statusFilter : undefined,
        page: '1',
      });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const ordersParams = useMemo(
    () => {
      const accountTypeLabels = {
        '100': text.accountTypeStarter,
        '300': text.accountTypeProfessional,
        '500': text.accountTypeElite,
      };

      return {
        page: currentPage,
        size: itemsPerPage,
        search: appliedSearchQuery
          ? toApiSearchQuery(appliedSearchQuery, accountTypeLabels)
          : undefined,
        status: statusFilter !== 'All' ? statusFilter : undefined,
        start_date: toApiDate(startDate),
        end_date: toApiDate(endDate),
      };
    },
    [appliedSearchQuery, currentPage, endDate, itemsPerPage, startDate, statusFilter, text],
  );
  const { data: ordersResponse, isFetching } = useOrdersQuery(ordersParams);

  // type_code를 기반으로 계정 유형 레이블을 매핑 >> 나중에 백엔드 요청 혹은 수정 필요할수도?
  const purchaseHistory = useMemo(() => {
    const accountTypeLabels = {
      '100': text.accountTypeStarter,
      '300': text.accountTypeProfessional,
      '500': text.accountTypeElite,
    };

    return (ordersResponse?.items ?? []).map((order) =>
      toPurchaseHistoryItem(order, accountTypeLabels),
    );
  }, [ordersResponse, text]);

  const getStatusIcon = (status: PurchaseStatus) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle size={16} className="text-[#00FF94]" />;
      case 'PENDING':
        return <Clock size={16} className="text-[#FFB800]" />;
      case 'FAILED':
        return <XCircle size={16} className="text-red-400" />;
      case 'REFUNDED':
        return <CheckCircle size={16} className="text-[#4f8cff]" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: PurchaseStatus) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-[#00FF94]/10 text-[#00FF94] border border-[#00FF94]/20';
      case 'PENDING':
        return 'bg-[#FFB800]/10 text-[#FFB800] border border-[#FFB800]/20';
      case 'FAILED':
        return 'bg-red-500/10 text-red-400 border border-red-500/20';
      case 'REFUNDED':
        return 'bg-[#4f8cff]/10 text-[#4f8cff] border border-[#4f8cff]/20';
      default:
        return 'bg-gray-500/10 text-gray-400 border border-gray-500/20';
    }
  };

  const getStatusLabel = (status: PurchaseStatus) => {
    switch (status) {
      case 'COMPLETED':
        return text.statusCompleted;
      case 'PENDING':
        return text.statusPending;
      case 'FAILED':
        return text.statusFailed;
      case 'REFUNDED':
        return text.statusRefunded;
      default:
        return '-';
    }
  };

  const totalItems = ordersResponse?.total ?? purchaseHistory.length;
  const serverTotalPages = ordersResponse?.pages;
  const totalPages = Math.max(1, serverTotalPages ?? currentPage);
  const displayData = purchaseHistory;

  const updateQueryParams = (updates: Record<string, string | undefined>) => {
    const next = applyScopedSearchParams(searchParams, Object.values(PURCHASE_QUERY_KEYS), updates);
    setSearchParams(next);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };

  const handleDateChange = (key: 'start' | 'end', value: string) => {
    if (key === 'start') {
      if (endDate && value && value > endDate) {
        return;
      }

      setStartDate(value);
    } else {
      if (startDate && value && value < startDate) {
        return;
      }

      setEndDate(value);
    }

    setCurrentPage(1);
    updateQueryParams({
      search: appliedSearchQuery || undefined,
      start: toApiDate(key === 'start' ? value : startDate),
      end: toApiDate(key === 'end' ? value : endDate),
      status: statusFilter !== 'All' ? statusFilter : undefined,
      page: '1',
    });
  };

  const handleStatusChange = (value: string) => {
    const nextStatus = parseStatusFilter(value);
    setStatusFilter(nextStatus);
    setCurrentPage(1);
    updateQueryParams({
      search: appliedSearchQuery || undefined,
      start: toApiDate(startDate),
      end: toApiDate(endDate),
      status: nextStatus !== 'All' ? nextStatus : undefined,
      page: '1',
    });
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setAppliedSearchQuery('');
    setStartDate('');
    setEndDate('');
    setStatusFilter('All');
    setCurrentPage(1);
    updateQueryParams({
      search: undefined,
      start: undefined,
      end: undefined,
      status: undefined,
      page: '1',
    });
  };

  const handlePageChange = (page: number) => {
    const nextPage = Math.max(1, page);
    setCurrentPage(nextPage);
    updateQueryParams({
      search: appliedSearchQuery || undefined,
      start: toApiDate(startDate),
      end: toApiDate(endDate),
      status: statusFilter !== 'All' ? statusFilter : undefined,
      page: String(nextPage),
    });
  };

  const handleLoadMore = () => {
    if (currentPage < totalPages && !isFetching) {
      handlePageChange(currentPage + 1);
    }
  };

  const columns: Column<PurchaseHistoryItem>[] = [
    {
      header: text.colOrderNo,
      accessor: (purchase) => (
        <p className="text-white text-sm font-medium font-mono">{purchase.orderNo}</p>
      ),
    },
    {
      header: text.colDateOfPurchase,
      align: 'center',
      accessor: (purchase) => (
        <div className="text-center whitespace-nowrap">
          <p className="text-white text-sm font-medium font-mono">{purchase.date}</p>
          {purchase.rawDate && (
            <p className="text-gray-500 text-xs mt-1">{formatBrowserGmtOffset(purchase.rawDate)}</p>
          )}
        </div>
      ),
    },
    {
      header: text.colChallengeAccountType,
      align: 'center',
      accessor: (purchase) => (
        <span className="text-[#00FF94] text-sm font-semibold">{purchase.challengeType}</span>
      ),
    },
    {
      header: text.colQuantity,
      align: 'center',
      accessor: (purchase) => (
        <div className="text-center">
          <p className="text-white text-sm font-semibold">{purchase.quantity}</p>
          <p className="text-gray-500 text-xs">{text.unitsLabel}</p>
        </div>
      ),
    },
    {
      header: text.colAmountPaid,
      align: 'right',
      accessor: (purchase) => (
        <div className="text-right">
          <p className="text-white text-sm font-semibold">
            ${purchase.amountPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-gray-500 text-xs">USDT</p>
        </div>
      ),
    },
    {
      header: text.colStatus,
      align: 'center',
      accessor: (purchase) => (
        <div className="flex justify-center">
          <span
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold ${getStatusBadge(purchase.status)}`}
          >
            {getStatusIcon(purchase.status)}
            {getStatusLabel(purchase.status)}
          </span>
        </div>
      ),
    },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="mb-6"
      >
        <FilterCard title={text.filters}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <FilterField label={text.searchLabel}>
              <FilterTextInput
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={text.searchPlaceholder}
                icon={
                  <Search
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                }
                inputClassName="pl-11"
              />
            </FilterField>

            <FilterField label={text.fromDateLabel}>
              <FilterDateInput
                value={startDate}
                onChange={(e) => handleDateChange('start', e.target.value)}
                max={endDate || undefined}
                icon={
                  <Calendar
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                }
              />
            </FilterField>

            <FilterField label={text.toDateLabel}>
              <FilterDateInput
                value={endDate}
                onChange={(e) => handleDateChange('end', e.target.value)}
                min={startDate || undefined}
                icon={
                  <Calendar
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                }
              />
            </FilterField>

            <FilterField label={text.colStatus}>
              <FilterSelect
                value={statusFilter}
                onChange={(e) => handleStatusChange(e.target.value)}
                options={[
                  { label: text.allStatus, value: 'All' },
                  { label: text.statusCompleted, value: 'COMPLETED' },
                  { label: text.statusPending, value: 'PENDING' },
                  { label: text.statusFailed, value: 'FAILED' },
                  { label: text.statusRefunded, value: 'REFUNDED' },
                ]}
              />
            </FilterField>
          </div>

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

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.25 }}
        className="bg-[#0f0f17] border border-[#1a1a24] rounded-xl overflow-hidden"
      >
        <DataTable
          data={displayData}
          columns={columns}
          keyExtractor={(purchase) => purchase.id}
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          onPageChange={handlePageChange}
          onLoadMore={handleLoadMore}
          hasMore={currentPage < totalPages}
          isLoading={isFetching}
          emptyMessage={text.emptyMessage}
          summaryLabel={text.purchasesLabel}
          endOfResultsLabel={text.endOfResults}
          previousLabel={text.previous}
          nextLabel={text.next}
          showingRangeLabel={text.showingPurchases}
          rowCursor="default"
          renderMobileCard={(purchase, index) => (
            <motion.div
              key={purchase.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: (index % itemsPerPage) * 0.05 }}
              className="bg-[#16161f] border border-[#2a2a3a] rounded-lg p-4"
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <p className="text-white text-sm font-medium font-mono">{purchase.orderNo}</p>
                  <p className="text-gray-400 text-xs mt-1 font-mono">{purchase.date}</p>
                  {purchase.rawDate && (
                    <p className="text-gray-500 text-xs mt-1">
                      {formatBrowserGmtOffset(purchase.rawDate)}
                    </p>
                  )}
                </div>
                <span
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold ${getStatusBadge(purchase.status)}`}
                >
                  {getStatusIcon(purchase.status)}
                  {getStatusLabel(purchase.status)}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-400 text-xs">{text.colChallengeAccountType}</span>
                  <span className="text-[#00FF94] text-sm font-semibold">
                    {purchase.challengeType}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-400 text-xs">{text.quantityLabel}</span>
                  <span className="text-white text-sm font-semibold">
                    {purchase.quantity} {text.unitsLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-400 text-xs">{text.amountPaidLabel}</span>
                  <span className="text-white text-sm font-semibold">
                    ${purchase.amountPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    <span className="text-gray-500 text-xs ml-1">USDT</span>
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        />
      </motion.div>
    </div>
  );
}
