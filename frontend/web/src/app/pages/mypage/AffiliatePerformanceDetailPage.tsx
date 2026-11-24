import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  X,
} from 'lucide-react';
import { useLocale } from '@/app/i18n/LocaleContext';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import type { AffiliateCommission } from '@/api/affiliate';
import { useAffiliateCommissionsQuery } from '@/app/queries/affiliate';

type CommissionStatus = 'completed' | 'partial' | 'refunded';

interface CommissionRecord {
  id: string;
  timestamp: string;
  memberName: string;
  memberUid: string;
  /** 구매자에서 나까지 단계 (1 = 직속 고객) */
  depth: number;
  transactionAmount: number;
  commissionRate: number;
  earnedCommission: number;
  status: CommissionStatus;
}

const STATUS_FROM_API: Record<AffiliateCommission['status'], CommissionStatus> = {
  COMPLETED: 'completed',
  PARTIAL_REFUND: 'partial',
  REFUNDED: 'refunded',
};

const toRecord = (item: AffiliateCommission): CommissionRecord => ({
  id: String(item.id),
  timestamp: item.created_at,
  memberName: item.buyer?.name ?? '-',
  memberUid: item.buyer ? `UID-${item.buyer.uid}` : '-',
  depth: item.depth,
  transactionAmount: item.base_amount,
  commissionRate: item.applied_rate,
  earnedCommission: item.net_amount,
  status: STATUS_FROM_API[item.status],
});

/** ISO 시각 → 'YYYY-MM-DD HH:mm' (KST) */
const toKst = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
};

export function AffiliatePerformanceDetailPage() {
  const { locale, T } = useLocale();
  const A = T.affiliate;
  const [searchQuery, setSearchQuery] = useState('');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
      }),
    [locale],
  );

  const getSourceTypeLabel = (record: CommissionRecord) => {
    if (record.depth <= 1) return A.directClient;
    return A.downlineIb;
  };

  const getIbNumber = (record: CommissionRecord) => record.memberUid;

  const getStatusLabel = (status: CommissionStatus) => {
    if (status === 'completed') return A.statusCompleted;
    if (status === 'partial') return A.statusPartialRefund;
    return A.statusRefunded;
  };

  const formatTimestamp = (timestamp: string) => `${toKst(timestamp)} GMT+9`;

  // 검색어는 입력이 멈춘 뒤 서버에 보낸다.
  const [keyword, setKeyword] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => setKeyword(searchQuery.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const commissionsQuery = useAffiliateCommissionsQuery({
    keyword: keyword || undefined,
    start_date: customStartDate || undefined,
    end_date: customEndDate || undefined,
    page: currentPage,
    size: pageSize,
  });
  const paginatedRecords = useMemo(
    () => (commissionsQuery.data?.items ?? []).map(toRecord),
    [commissionsQuery.data],
  );
  const totalRecords = commissionsQuery.data?.total ?? 0;

  const pageCount = Math.max(1, Math.ceil(totalRecords / pageSize));
  const safeCurrentPage = Math.min(currentPage, pageCount);
  const firstVisibleRecord = totalRecords === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const lastVisibleRecord = Math.min(safeCurrentPage * pageSize, totalRecords);
  const notIb =
    (commissionsQuery.error as { response?: { status?: number } } | null)?.response?.status === 403;

  const getPageNumbers = (): Array<number | 'ellipsis'> => {
    if (pageCount <= 5) {
      return Array.from({ length: pageCount }, (_, index) => index + 1);
    }
    if (safeCurrentPage <= 3) return [1, 2, 3, 4, 'ellipsis', pageCount];
    if (safeCurrentPage >= pageCount - 2) {
      return [1, 'ellipsis', pageCount - 3, pageCount - 2, pageCount - 1, pageCount];
    }
    return [
      1,
      'ellipsis',
      safeCurrentPage - 1,
      safeCurrentPage,
      safeCurrentPage + 1,
      'ellipsis',
      pageCount,
    ];
  };

  const updateFilter = (callback: () => void) => {
    callback();
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setSearchQuery('');
    setCustomStartDate('');
    setCustomEndDate('');
    setCurrentPage(1);
  };

  const statusClass = (status: CommissionStatus) => {
    if (status === 'completed') {
      return 'border-[#00FF94]/20 bg-[#00FF94]/10 text-[#00FF94]';
    }
    if (status === 'partial') {
      return 'border-[#FFB800]/20 bg-[#FFB800]/10 text-[#FFB800]';
    }
    return 'border-red-400/20 bg-red-400/10 text-red-400';
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] min-w-0 overflow-x-hidden px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6"
      >
        <div className="mb-2 text-xs font-semibold tracking-[0.18em] text-[#68A0FF]">
          {A.eyebrow}
        </div>
        <div className="text-2xl font-semibold text-white sm:text-3xl">
          {A.performanceDetailTitle}
        </div>
        <div className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
          {A.performanceDetailSubtitle}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="mb-6 w-full min-w-0 max-w-full rounded-xl border border-[#2a2a3a] bg-[#0f0f17] p-4 sm:p-6"
      >
        <div className="mb-4 flex items-center gap-2">
          <Filter className="size-5 text-[#0052FF]" />
          <div className="font-semibold text-white">{A.searchAndFilter}</div>
        </div>

        <div className="grid min-w-0 grid-cols-1 items-end gap-4 md:grid-cols-[minmax(220px,1fr)_180px_180px_auto]">
          <div className="min-w-0">
            <div className="mb-2 text-xs text-gray-400">{A.searchMember}</div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-gray-500" />
              <Input
                value={searchQuery}
                onChange={(event) =>
                  updateFilter(() => setSearchQuery(event.target.value))
                }
                placeholder={A.searchMemberPlaceholder}
                className="h-11 w-full border-[#2a2a3a] bg-[#16161f] pl-10 pr-4 text-sm text-white placeholder:text-gray-500 focus-visible:border-[#0052FF]/50 focus-visible:ring-0"
              />
            </div>
          </div>

          <div className="min-w-0">
            <div className="mb-2 text-xs text-gray-400">{A.startDate}</div>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 z-10 size-[18px] -translate-y-1/2 text-gray-500" />
              <Input
                type="date"
                value={customStartDate}
                onChange={(event) =>
                  updateFilter(() => setCustomStartDate(event.target.value))
                }
                className="h-11 w-full border-[#2a2a3a] bg-[#16161f] pl-10 pr-10 text-sm text-white focus-visible:border-[#0052FF]/50 focus-visible:ring-0"
              />
              {customStartDate && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => updateFilter(() => setCustomStartDate(''))}
                  className="absolute right-2 top-1/2 z-20 size-7 -translate-y-1/2 bg-[#16161f] text-gray-500 hover:bg-[#24243a] hover:text-white"
                  aria-label={A.clearStartDate}
                >
                  <X />
                </Button>
              )}
            </div>
          </div>

          <div className="min-w-0">
            <div className="mb-2 text-xs text-gray-400">{A.endDate}</div>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 z-10 size-[18px] -translate-y-1/2 text-gray-500" />
              <Input
                type="date"
                value={customEndDate}
                onChange={(event) =>
                  updateFilter(() => setCustomEndDate(event.target.value))
                }
                className="h-11 w-full border-[#2a2a3a] bg-[#16161f] pl-10 pr-10 text-sm text-white focus-visible:border-[#0052FF]/50 focus-visible:ring-0"
              />
              {customEndDate && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => updateFilter(() => setCustomEndDate(''))}
                  className="absolute right-2 top-1/2 z-20 size-7 -translate-y-1/2 bg-[#16161f] text-gray-500 hover:bg-[#24243a] hover:text-white"
                  aria-label={A.clearEndDate}
                >
                  <X />
                </Button>
              )}
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            onClick={resetFilters}
            className="h-11 w-full self-end bg-[#1a1a24] px-4 text-sm text-gray-400 hover:bg-[#24243a] hover:text-white md:w-auto"
          >
            {A.resetFilters}
          </Button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-[#242432] bg-[#0f0f17]"
      >
        <div className="min-w-0 border-b border-white/[0.07] p-3 sm:p-6">
          <div className="min-w-0">
            <div className="text-lg font-semibold text-white">{A.detailWorkspaceTitle}</div>
            <div className="mt-1 text-sm text-gray-400">{A.detailWorkspaceSubtitle}</div>
          </div>

        </div>

        <div className="hidden max-w-full overflow-hidden md:block">
          <Table className="w-full">
            <TableHeader className="bg-[#14141e]">
            <TableRow className="border-white/[0.07] hover:bg-[#14141e]">
              <TableHead className="px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">{A.colDateTime}</TableHead>
              <TableHead className="px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">{A.colMemberSource}</TableHead>
              <TableHead className="px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">{A.ibNumber}</TableHead>
              <TableHead className="px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">{A.colUserType}</TableHead>
              <TableHead className="px-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">{A.colTransactionAmount}</TableHead>
              <TableHead className="px-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">{A.colCommissionRate}</TableHead>
              <TableHead className="px-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">{A.colEarnedCommission}</TableHead>
              <TableHead className="px-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">{A.colStatus}</TableHead>
            </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRecords.map((record, index) => (
                <motion.tr
                key={record.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.025 }}
                className="border-b border-white/[0.06] transition-colors hover:bg-white/[0.025]"
              >
                <TableCell className="px-3 py-4 whitespace-nowrap font-mono text-xs text-gray-400">
                  {formatTimestamp(record.timestamp)}
                </TableCell>
                <TableCell className="px-3 py-4">
                  <span className="text-sm font-medium text-white">{record.memberName}</span>
                </TableCell>
                <TableCell className="px-3 py-4 font-mono text-xs font-medium text-gray-400">
                  {getIbNumber(record)}
                </TableCell>
                <TableCell className="px-3 py-4">
                  <Badge
                    variant="outline"
                    className={
                      record.depth <= 1
                        ? 'border-white/10 bg-white/5 text-gray-300'
                        : 'border-[#0052FF]/20 bg-[#0052FF]/10 text-[#8CB6FF]'
                    }
                  >
                    {getSourceTypeLabel(record)}
                  </Badge>
                </TableCell>
                <TableCell className="px-3 py-4 text-right text-sm font-medium text-white">
                  {currencyFormatter.format(record.transactionAmount)}
                </TableCell>
                <TableCell className="px-3 py-4 text-right text-sm text-gray-300">
                  {record.commissionRate}%
                </TableCell>
                <TableCell className="px-3 py-4 text-right text-sm font-semibold text-[#00FF94]">
                  +{currencyFormatter.format(record.earnedCommission)}
                </TableCell>
                <TableCell className="px-3 py-4 text-center">
                  <Badge variant="outline" className={statusClass(record.status)}>
                    {getStatusLabel(record.status)}
                  </Badge>
                </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="min-w-0 space-y-3 p-3 md:hidden">
          {paginatedRecords.map((record, index) => (
            <motion.div
              key={record.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.025 }}
              className="min-w-0 rounded-xl border border-white/[0.07] bg-[#14141e] p-3"
            >
              <div className="flex min-w-0 items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">{record.memberName}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wide text-gray-500">
                      {A.ibNumber}
                    </span>
                    <span className="font-mono text-xs font-medium text-gray-300">
                      {getIbNumber(record)}
                    </span>
                  </div>
                </div>
                <Badge variant="outline" className={`shrink-0 ${statusClass(record.status)}`}>
                  {getStatusLabel(record.status)}
                </Badge>
              </div>

              <div className="mt-3">
                <Badge
                  variant="outline"
                  className={
                    record.depth <= 1
                      ? 'max-w-full border-white/10 bg-white/5 text-gray-300'
                      : 'max-w-full border-[#0052FF]/20 bg-[#0052FF]/10 text-[#8CB6FF]'
                  }
                >
                  <span className="truncate">{getSourceTypeLabel(record)}</span>
                </Badge>
              </div>

              <div className="mt-3 grid min-w-0 grid-cols-2 gap-3 border-t border-white/[0.06] pt-3">
                <div className="min-w-0">
                  <div className="text-[11px] text-gray-500">{A.colTransactionAmount}</div>
                  <div className="mt-1 truncate text-sm font-medium text-white">
                    {currencyFormatter.format(record.transactionAmount)}
                  </div>
                </div>
                <div className="min-w-0 text-right">
                  <div className="text-[11px] text-gray-500">{A.colCommissionRate}</div>
                  <div className="mt-1 text-sm text-gray-300">{record.commissionRate}%</div>
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] text-gray-500">{A.colDateTime}</div>
                  <div className="mt-1 break-words font-mono text-xs leading-5 text-gray-400">
                    {formatTimestamp(record.timestamp)}
                  </div>
                </div>
                <div className="min-w-0 text-right">
                  <div className="text-[11px] text-gray-500">{A.colEarnedCommission}</div>
                  <div className="mt-1 truncate text-sm font-semibold text-[#00FF94]">
                    +{currencyFormatter.format(record.earnedCommission)}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {paginatedRecords.length === 0 && (
          <div className="flex min-h-56 flex-col items-center justify-center px-6 py-12 text-center">
            <Search className="mb-4 size-8 text-gray-600" />
            <div className="text-sm font-medium text-white">
              {commissionsQuery.isLoading ? A.loading : notIb ? A.notIbPartner : commissionsQuery.isError ? A.loadFailed : A.noRecords}
            </div>
            {!commissionsQuery.isLoading && !commissionsQuery.isError && (
              <div className="mt-1 text-xs text-gray-500">{A.noRecordsHint}</div>
            )}
          </div>
        )}

        <div className="flex min-w-0 flex-col gap-4 border-t border-[#2a2a3a] px-3 py-5 md:flex-row md:items-center md:justify-between sm:px-5">
          <div className="text-sm text-gray-500">
            {A.showingRecords
              .replace('{from}', String(firstVisibleRecord))
              .replace('{to}', String(lastVisibleRecord))
              .replace('{total}', String(totalRecords))}
          </div>
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 md:w-auto md:justify-end">
            <Button
              type="button"
              variant="ghost"
              disabled={safeCurrentPage === 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              className="h-10 gap-2 rounded-lg bg-[#1a1a24] px-4 text-sm text-gray-400 transition-colors hover:bg-[#24243a] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
              <span>{A.previous}</span>
            </Button>

            <div className="flex items-center gap-2">
              {getPageNumbers().map((page, index) =>
                page === 'ellipsis' ? (
                  <span key={`ellipsis-${index}`} className="px-1 text-gray-500">
                    …
                  </span>
                ) : (
                  <Button
                    key={page}
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setCurrentPage(page)}
                    className={`size-10 rounded-lg text-sm font-medium transition-all ${
                      safeCurrentPage === page
                        ? 'bg-[#0052FF] text-white shadow-lg shadow-[#0052FF]/30 hover:bg-[#0052FF]/90'
                        : 'bg-[#1a1a24] text-gray-400 hover:bg-[#24243a] hover:text-white'
                    }`}
                    aria-current={safeCurrentPage === page ? 'page' : undefined}
                  >
                    {page}
                  </Button>
                ),
              )}
            </div>

            <Button
              type="button"
              variant="ghost"
              disabled={safeCurrentPage === pageCount}
              onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
              className="h-10 gap-2 rounded-lg bg-[#1a1a24] px-4 text-sm text-gray-400 transition-colors hover:bg-[#24243a] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              <span>{A.next}</span>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
