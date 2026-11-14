import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { WalletTransaction } from '../../../api/wallet';
import { TransactionDetailModal } from '../../components/transactions/TransactionDetailModal';
import {
  DataTable,
  TablePagination,
  buildPaginationSummary,
  buildPaginationItems,
  getPaginationRange,
} from '../../components/shared/DataTable';
import {
  SEARCH_DEBOUNCE_MS,
  DateRangeFilter,
  SearchField,
  SelectFilter,
  TableFilterBar,
} from '../../components/shared/TableFilters';
import { useAppShell } from '../../layouts/AppShell';
import { TRANSFER_STATUS_FILTER, TRANSFER_TYPE_FILTER } from '../../constants/status';
import { useListWalletRequestHistoryQuery } from '../../queries/wallet';
import { formatKstDateTime, formatUsdMoney } from '../../utils/utils';
import { getWalletStatusBadge } from '../../utils/walletDisplay';

const PAGE_SIZE = 20;
const toDateParam = (value: string) => value || undefined;
const TRANSACTION_HISTORY_STATUS_FILTER = TRANSFER_STATUS_FILTER.filter(
  (option) => option.value !== 'Pending',
);

const parsePageParam = (value: string | null) => {
  const page = Number(value ?? '1');

  return Number.isInteger(page) && page > 0 ? page : 1;
};

const getValidFilterValue = (
  value: string | null,
  options: readonly { value: string }[],
  fallback = 'All',
) => (value && options.some((option) => option.value === value) ? value : fallback);

export function TransactionHistoryPage() {
  const { dark } = useAppShell();
  const [searchParams, setSearchParams] = useSearchParams();
  const typeParam = searchParams.get('display_tx_type');
  const statusParam = searchParams.get('display_status');
  const searchTerm = searchParams.get('keyword') ?? '';
  const typeFilter = getValidFilterValue(typeParam, TRANSFER_TYPE_FILTER);
  const statusFilter = getValidFilterValue(
    statusParam,
    TRANSACTION_HISTORY_STATUS_FILTER,
  );
  const startDate = searchParams.get('start_date') ?? '';
  const endDate = searchParams.get('end_date') ?? '';
  const currentPage = parsePageParam(searchParams.get('page'));
  const [searchQuery, setSearchQuery] = useState(searchTerm);
  const [selectedTransfer, setSelectedTransfer] = useState<WalletTransaction | null>(null);

  const requestParams = useMemo(
    () => ({
      keyword: searchTerm || undefined,
      display_tx_type: typeFilter === 'All' ? undefined : typeFilter,
      display_status: statusFilter === 'All' ? undefined : statusFilter,
      start_date: toDateParam(startDate),
      end_date: toDateParam(endDate),
      page: currentPage,
      size: PAGE_SIZE,
    }),
    [currentPage, endDate, searchTerm, startDate, statusFilter, typeFilter],
  );
  const requestsQuery = useListWalletRequestHistoryQuery(requestParams);

  const t = {
    surface: dark ? '#0F1829' : '#ffffff',
    surface2: dark ? '#1A2035' : '#F4F5F7',
    border: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)',
    text: dark ? '#E8EAF0' : '#1A1A1A',
    textSec: dark ? '#8B8FA8' : '#4A4A58',
    textHint: dark ? '#5A6080' : '#A0A0AA',
    pageBg: dark ? '#0A0F1E' : '#F4F5F7',
    accent: '#7C6AF7',
  };

  const updateParams = (updates: Record<string, string | number | null | undefined>) => {
    const next = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '' || value === 'All') {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });

    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    const updates: Record<string, null> = {};

    if (typeParam && !TRANSFER_TYPE_FILTER.some((option) => option.value === typeParam)) {
      updates.display_tx_type = null;
    }
    if (
      statusParam &&
      !TRANSACTION_HISTORY_STATUS_FILTER.some((option) => option.value === statusParam)
    ) {
      updates.display_status = null;
    }

    if (Object.keys(updates).length > 0) {
      updateParams(updates);
    }
  }, [statusParam, typeParam]);

  const handleTypeFilterChange = (value: string) => {
    updateParams({ display_tx_type: value, page: 1 });
  };

  const handleStatusFilterChange = (value: string) => {
    updateParams({ display_status: value, page: 1 });
  };

  const visibleTransfers = requestsQuery.data?.items ?? [];
  const totalCount = requestsQuery.data?.total ?? visibleTransfers.length;
  const pageSize = requestsQuery.data?.size ?? PAGE_SIZE;
  const totalPages = Math.max(1, requestsQuery.data?.pages ?? Math.ceil(totalCount / pageSize));
  const responsePage =
    !requestsQuery.isPlaceholderData && requestsQuery.data ? requestsQuery.data.page : currentPage;
  const safeCurrentPage = Math.min(Math.max(1, responsePage), totalPages);
  const paginationRange = getPaginationRange({
    totalItems: totalCount,
    currentPage: safeCurrentPage,
    pageSize,
    currentPageItemCount: visibleTransfers.length,
  });

  const paginationItems = buildPaginationItems({
    currentPage: safeCurrentPage,
    totalPages,
    onPageChange: (page) => updateParams({ page }),
  });

  useEffect(() => {
    if (requestsQuery.data && !requestsQuery.isPlaceholderData && currentPage !== safeCurrentPage) {
      updateParams({ page: safeCurrentPage });
    }
  }, [currentPage, requestsQuery.data, requestsQuery.isPlaceholderData, safeCurrentPage]);

  useEffect(() => {
    setSearchQuery(searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query === searchTerm) return;

    const timer = window.setTimeout(() => {
      updateParams({ keyword: query || null, page: 1 });
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [searchQuery, searchTerm]);

  return (
    <div style={{ padding: 32, background: t.pageBg, minHeight: '100vh' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: t.text, margin: 0, marginBottom: 8 }}>
          입출금 내역
        </h1>
        <p style={{ fontSize: 13, color: t.textSec, margin: 0 }}>
          유저의 입출금 이력을 조회합니다. 승인/반려는 입출금 승인 관리 메뉴에서 처리하세요.
        </p>
      </div>

      <TableFilterBar
        background={t.surface}
        borderColor={t.border}
        containerStyle={{ display: 'block', padding: '16px 20px', marginBottom: 20 }}
      >
        <div style={{ fontSize: 11, fontWeight: 600, color: t.textSec, marginBottom: 12 }}>
          검색 조건
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <SearchField
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="유저 이름 / UID / 이메일 / TXID 검색"
            minWidth={320}
            height={36}
            fontSize={13}
            iconLeft={12}
            iconSize={16}
            paddingLeft={36}
            background={t.surface2}
            borderColor={t.border}
            textColor={t.text}
            iconColor={t.text}
          />

          <SelectFilter
            value={typeFilter}
            onChange={handleTypeFilterChange}
            width={180}
            height={36}
            fontSize={13}
            paddingLeft={12}
            background={t.surface2}
            borderColor={t.border}
            textColor={t.text}
            iconColor={t.text}
            options={TRANSFER_TYPE_FILTER}
          />

          <SelectFilter
            value={statusFilter}
            onChange={handleStatusFilterChange}
            width={140}
            height={36}
            fontSize={13}
            paddingLeft={12}
            background={t.surface2}
            borderColor={t.border}
            textColor={t.text}
            iconColor={t.text}
            options={TRANSACTION_HISTORY_STATUS_FILTER}
          />

          <DateRangeFilter
            startValue={startDate}
            onStartChange={(value) => {
              updateParams({ start_date: value, page: 1 });
            }}
            endValue={endDate}
            onEndChange={(value) => {
              updateParams({ end_date: value, page: 1 });
            }}
            startMax={endDate || undefined}
            endMin={startDate || undefined}
            height={36}
            fontSize={13}
            background={t.surface2}
            borderColor={t.border}
            textColor={t.text}
          />
        </div>
      </TableFilterBar>

      <DataTable
        columns={[
          { key: 'user', label: '유저', width: '18%' },
          { key: 'type', label: '유형', width: '14%' },
          { key: 'deposit', label: '입금', width: '14%' },
          {
            key: 'withdraw',
            label: (
              <>
                <div>출금</div>
                <div style={{ marginTop: 2, fontSize: 10, fontWeight: 400, color: t.textHint }}>
                  (수수료 / 실수령)
                </div>
              </>
            ),
            width: '14%',
          },
          { key: 'sourceAccount', label: '출처 계좌', width: '16%' },
          { key: 'timestamp', label: '날짜', width: '14%' },
          { key: 'status', label: '상태', width: '10%' },
        ]}
        rows={visibleTransfers}
        isLoading={requestsQuery.isLoading}
        rowKey={(transfer) => `${transfer.source}-${transfer.id}`}
        onRowClick={(transfer) => setSelectedTransfer(transfer)}
        rowStyle={(_, i, isHovered) => ({
          height: 56,
          background: isHovered ? t.surface2 : 'transparent',
          borderBottom: i < visibleTransfers.length - 1 ? `1px solid ${t.border}` : 'none',
          cursor: 'pointer',
          transition: 'background 0.2s',
        })}
        shellStyle={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: 12,
          overflow: 'hidden',
          marginBottom: 20,
        }}
        tableStyle={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}
        headerRowStyle={{
          background: t.surface2,
          borderBottom: `1px solid ${t.border}`,
        }}
        headerCellStyle={{
          padding: '12px 16px',
          textAlign: 'left',
          fontSize: 11,
          fontWeight: 600,
          color: t.textSec,
          whiteSpace: 'nowrap',
        }}
        emptyState={
          <div style={{ padding: 24, textAlign: 'center', color: t.textHint, fontSize: 12 }}>
            {requestsQuery.isLoading
              ? '입출금 내역을 불러오는 중입니다.'
              : requestsQuery.isError
                ? '입출금 내역을 불러오지 못했습니다.'
                : '조회 결과가 없습니다.'}
          </div>
        }
        footer={
          <TablePagination
            summary={buildPaginationSummary({
              totalItems: totalCount,
              start: paginationRange.start,
              end: paginationRange.end,
            })}
            containerStyle={{ padding: '12px 16px' }}
            borderColor={t.border}
            textColor={t.textHint}
            activeBackground={t.accent}
            inactiveBackground={t.surface2}
            inactiveBorderColor={t.border}
            items={paginationItems}
          />
        }
        rowRenderer={(transfer: WalletTransaction) => {
          const statusLabel = transfer.display_status ?? transfer.status;
          const statusConfig = getWalletStatusBadge(statusLabel);

          return (
            <>
              <td style={{ padding: '16px' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: t.text, marginBottom: 2 }}>
                  {transfer.user_nickname}
                </div>
                <div style={{ fontSize: 12, color: t.textHint }}>{transfer.user_email}</div>
              </td>
              <td style={{ padding: '16px' }}>
                <span style={{ fontSize: 13, color: t.textSec }}>{transfer.display_tx_type}</span>
              </td>
              <td style={{ padding: '16px' }}>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: transfer.direction === 'IN' ? '#16A34A' : t.textHint,
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  {transfer.direction === 'IN' ? formatUsdMoney(transfer.amount) : '—'}
                </span>
              </td>
              <td style={{ padding: '16px' }}>
                {transfer.direction === 'OUT' ? (
                  (() => {
                    const showExternalWalletBreakdown =
                      transfer.display_tx_type === 'External Wallet';

                    if (!showExternalWalletBreakdown) {
                      return (
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: '#DC2626',
                            fontFamily: "'DM Mono', monospace",
                          }}
                        >
                          -{formatUsdMoney(Math.abs(transfer.amount))}
                        </span>
                      );
                    }

                    const withdrawalAmount = Math.abs(transfer.amount);
                    const fee = Math.abs(transfer.fee);
                    const netAmount = withdrawalAmount - fee;

                    return (
                      <div style={{ fontFamily: "'DM Mono', monospace" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#DC2626' }}>
                          -{formatUsdMoney(withdrawalAmount)}
                        </div>
                        <div style={{ marginTop: 3, fontSize: 10, whiteSpace: 'nowrap' }}>
                          <span style={{ color: '#DC2626' }}>-{formatUsdMoney(fee)}</span>
                          <span style={{ color: t.textHint }}> / </span>
                          <span style={{ fontWeight: 600, color: t.textSec }}>
                            {formatUsdMoney(netAmount)}
                          </span>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: t.textHint,
                      fontFamily: "'DM Mono', monospace",
                    }}
                  >
                    —
                  </span>
                )}
              </td>
              <td style={{ padding: '16px' }}>
                <span style={{ fontSize: 12, color: t.textSec }}>
                  {transfer.source_account || '—'}
                </span>
              </td>
              <td style={{ padding: '16px' }}>
                <div style={{ fontSize: 12, color: t.textSec, fontFamily: "'DM Mono', monospace" }}>
                  {formatKstDateTime(transfer.created_at)}
                </div>
              </td>
              <td style={{ padding: '16px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '4px 10px',
                    borderRadius: 9999,
                    fontSize: 11,
                    fontWeight: 600,
                    background: statusConfig.bg,
                    color: statusConfig.color,
                    border: `1px solid ${statusConfig.border}`,
                  }}
                >
                  {statusLabel}
                </span>
              </td>
            </>
          );
        }}
      />

      {selectedTransfer && (
        <TransactionDetailModal
          transfer={selectedTransfer}
          dark={dark}
          mode="readonly"
          onClose={() => setSelectedTransfer(null)}
        />
      )}
    </div>
  );
}
