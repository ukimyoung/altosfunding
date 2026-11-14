import { useEffect, useMemo, useState } from 'react';
import type { ViolationAccount, ViolationAccountStatus } from '@/api/violation';
import { VIOL_STATUS_MAP } from '../../constants/status';
import { useAppShell } from '../../layouts/AppShell';
import { Badge } from '../../components/shared/Badge';
import { ModalCloseBtn } from '../../components/shared/ModalCloseButton';
import {
  DataTable,
  TablePagination,
  buildPaginationItems,
  buildPaginationSummary,
  getPaginationRange,
} from '../../components/shared/DataTable';
import {
  DateRangeFilter,
  SearchField,
  SelectFilter,
  TableFilterBar,
  SEARCH_DEBOUNCE_MS,
} from '../../components/shared/TableFilters';
import { tok } from '../../theme/tokens';
import { useSearchParams } from 'react-router';
import { useListViolationAccountsQuery } from '../../queries/violations';
import { formatSignedUsdMoney, formatUsdMoney } from '../../utils/utils';

const pageSize = 20;

const STATUS_LABELS: Record<ViolationAccountStatus, string> = {
  FAILED: '실패',
  INACTIVE: '비활성',
  BANNED: '영구정지',
};

const formatTier = (tier: string) => {
  if (tier === 'CHALLENGE') return 'Challenge';
  if (tier === 'FUNDED') return 'Funded';
  return tier || '—';
};

const formatTypeCode = (typeCode: string) => (typeCode ? `$${typeCode}` : '—');

const toApiDate = (value: string) => (value ? value.replace(/-/g, '.') : null);

const formatDateTime = (value: string | null) => {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
};

export function ViolationHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { dark } = useAppShell();
  const t = tok(dark);
  const [reasonModal, setReasonModal] = useState<ViolationAccount | null>(null);

  const search = searchParams.get('search') ?? '';
  const accountType = searchParams.get('accountType') ?? 'all';
  const violationType = searchParams.get('violationType') ?? 'all';
  const statusFilter = searchParams.get('status') ?? 'all';
  const startDate = searchParams.get('startDate') ?? '';
  const endDate = searchParams.get('endDate') ?? '';
  const currentPage = Number(searchParams.get('page') ?? '1') || 1;
  const [searchDraft, setSearchDraft] = useState(search);
  const queryParams = useMemo(
    () => ({
      keyword: search.trim().length >= 2 ? search.trim() : null,
      type_code: accountType !== 'all' ? accountType : null,
      tier: violationType !== 'all' ? violationType : null,
      status: statusFilter !== 'all' ? (statusFilter as ViolationAccountStatus) : null,
      start_date: toApiDate(startDate),
      end_date: toApiDate(endDate),
      page: currentPage,
      size: pageSize,
    }),
    [accountType, currentPage, endDate, search, startDate, statusFilter, violationType],
  );
  const { data, isLoading, isError, isPlaceholderData } =
    useListViolationAccountsQuery(queryParams);
  const rows = data?.items ?? [];

  const updateParams = (updates: Record<string, string | number | null | undefined>) => {
    const next = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '' || value === 'all') {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });

    setSearchParams(next, { replace: true });
  };

  const totalRows = data?.total ?? rows.length;
  const responsePageSize = data?.size ?? pageSize;
  const totalPages = Math.max(1, data?.pages ?? 1);
  const responsePage = !isPlaceholderData && data ? data.page : currentPage;
  const safeCurrentPage = Math.min(Math.max(1, responsePage), totalPages);
  const visibleRows = rows;
  const paginationRange = getPaginationRange({
    totalItems: totalRows,
    currentPage: safeCurrentPage,
    pageSize: responsePageSize,
    currentPageItemCount: visibleRows.length,
  });

  useEffect(() => {
    if (data && !isPlaceholderData && currentPage !== safeCurrentPage) {
      updateParams({ page: safeCurrentPage });
    }
  }, [currentPage, data, isPlaceholderData, safeCurrentPage]);

  useEffect(() => {
    setSearchDraft(search);
  }, [search]);

  useEffect(() => {
    const query = searchDraft.trim();
    if (query === search) return;

    const timer = window.setTimeout(() => {
      updateParams({ search: query.length >= 2 ? query : null, page: 1 });
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [searchDraft, search]);

  return (
    <div style={{ padding: '28px 28px 48px', fontFamily: "'DM Sans','Noto Sans KR',sans-serif" }}>
      {/* Filter Bar */}
      <TableFilterBar background={t.surface} borderColor={t.border}>
        <SearchField
          value={searchDraft}
          onChange={setSearchDraft}
          placeholder="검색어를 입력해주세요."
          minWidth={200}
          background={t.surface2}
          borderColor={t.border}
          textColor={t.text}
          iconColor={t.text}
        />
        <SelectFilter
          value={accountType}
          onChange={(value) => updateParams({ accountType: value, page: 1 })}
          width={150}
          background={t.surface2}
          borderColor={t.border2}
          textColor={t.textSec}
          iconColor={t.text}
          options={[
            { value: 'all', label: '계좌 유형: 전체' },
            { value: '100', label: '$100' },
            { value: '300', label: '$300' },
            { value: '500', label: '$500' },
          ]}
        />
        <SelectFilter
          value={violationType}
          onChange={(value) => updateParams({ violationType: value, page: 1 })}
          width={110}
          background={t.surface2}
          borderColor={t.border2}
          textColor={t.textSec}
          iconColor={t.text}
          options={[
            { value: 'all', label: '유형: 전체' },
            { value: 'CHALLENGE', label: 'Challenge' },
            { value: 'FUNDED', label: 'Funded' },
          ]}
        />
        <SelectFilter
          value={statusFilter}
          onChange={(value) => updateParams({ status: value, page: 1 })}
          width={130}
          background={t.surface2}
          borderColor={t.border2}
          textColor={t.textSec}
          iconColor={t.text}
          options={[
            { value: 'all', label: '상태: 전체' },
            { value: 'FAILED', label: '실패' },
            { value: 'INACTIVE', label: '비활성' },
            { value: 'BANNED', label: '영구정지' },
          ]}
        />
        <DateRangeFilter
          startValue={startDate}
          onStartChange={(value) => updateParams({ startDate: value, page: 1 })}
          endValue={endDate}
          onEndChange={(value) => updateParams({ endDate: value, page: 1 })}
          startMax={endDate || undefined}
          endMin={startDate || undefined}
          background={t.surface2}
          borderColor={t.border}
          textColor={t.text}
        />
      </TableFilterBar>

      {/* Table */}
      <DataTable
        columns={[
          { key: 'id', label: '계좌번호', width: '20%' },
          { key: 'type', label: '유형', width: '10%' },
          { key: 'acctType', label: '계좌 유형', width: '11%' },
          { key: 'capital', label: '자본금', width: '10%' },
          { key: 'balance', label: '잔고', width: '10%' },
          { key: 'profit', label: '수익', width: '11%' },
          { key: 'status', label: '상태', width: '10%' },
          { key: 'date', label: '처리 일자', width: '8%' },
          { key: 'actions', label: '' },
        ]}
        rows={visibleRows}
        isLoading={isLoading}
        shellStyle={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: 12,
          overflow: 'hidden',
        }}
        tableStyle={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}
        headerRowStyle={{
          background: t.surface2,
          height: 40,
          borderBottom: `1px solid ${t.border}`,
        }}
        headerCellStyle={{
          padding: '0 16px',
          textAlign: 'left',
          fontSize: 10,
          fontWeight: 600,
          color: t.textHint,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          fontFamily: "'DM Sans',sans-serif",
          whiteSpace: 'nowrap',
        }}
        emptyState={
          <div style={{ padding: 24, textAlign: 'center', color: t.textHint, fontSize: 12 }}>
            {isLoading
              ? '조회 중입니다.'
              : isError
                ? '목록을 불러오지 못했습니다.'
                : '조회 결과가 없습니다.'}
          </div>
        }
        rowStyle={(_, i) => ({
          height: 56,
          borderBottom: i < visibleRows.length - 1 ? `1px solid ${t.border}` : 'none',
        })}
        footer={
          totalRows > 0 ? (
            <TablePagination
              summary={buildPaginationSummary({
                totalItems: totalRows,
                start: paginationRange.start,
                end: paginationRange.end,
              })}
              containerStyle={{ padding: '12px 16px' }}
              borderColor={t.border}
              textColor={t.textHint}
              activeBackground={t.accent}
              inactiveBackground={t.surface2}
              inactiveBorderColor={t.border2}
              items={buildPaginationItems({
                currentPage: safeCurrentPage,
                totalPages,
                onPageChange: (page) => updateParams({ page }),
              })}
            />
          ) : null
        }
        rowKey={(row) => row.account_id}
        rowRenderer={(row) => {
          const statusLabel = STATUS_LABELS[row.status] ?? row.status;
          const vs = VIOL_STATUS_MAP[statusLabel] ?? {
            bg: t.surface2,
            color: t.textSec,
            border: t.border,
          };
          return (
            <>
              <td style={{ padding: '0 16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: t.text }}>
                    {row.mt4_login}
                  </span>
                  <span style={{ fontSize: 10, color: t.textHint }}>{row.user_name || '—'}</span>
                  <span style={{ fontSize: 10, color: t.textHint }}>{row.user_email || '—'}</span>
                </div>
              </td>
              <td style={{ padding: '0 16px' }}>
                <span style={{ fontSize: 11, color: t.textSec }}>{formatTier(row.tier)}</span>
              </td>
              <td style={{ padding: '0 16px' }}>
                <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: t.textSec }}>
                  {formatTypeCode(row.type_code)}
                </span>
              </td>
              <td style={{ padding: '0 16px' }}>
                <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: t.textSec }}>
                  {formatUsdMoney(row.capital)}
                </span>
              </td>
              <td style={{ padding: '0 16px' }}>
                <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: t.textSec }}>
                  {formatUsdMoney(row.balance)}
                </span>
              </td>
              <td style={{ padding: '0 16px' }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: "'DM Mono',monospace",
                    color: row.profit >= 0 ? '#16A34A' : '#DC2626',
                  }}
                >
                  {formatSignedUsdMoney(row.profit)}
                </span>
              </td>
              <td style={{ padding: '0 16px' }}>
                <Badge label={statusLabel} bg={vs.bg} color={vs.color} border={vs.border} />
              </td>
              <td style={{ padding: '0 16px' }}>
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: "'DM Mono',monospace",
                    color: t.textSec,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatDateTime(row.suspended_at)}
                </span>
              </td>
              <td style={{ padding: '0 16px' }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setReasonModal(row);
                  }}
                  style={{
                    height: 28,
                    padding: '0 10px',
                    borderRadius: 6,
                    border: `1px solid ${t.border2}`,
                    background: 'transparent',
                    color: t.textSec,
                    fontSize: 10,
                    fontFamily: "'Noto Sans KR',sans-serif",
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  정지 사유 보기
                </button>
              </td>
            </>
          );
        }}
      />

      {/* Modal A — 정지 사유 보기 */}
      {reasonModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setReasonModal(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 110,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 320,
              background: t.surface,
              borderRadius: 16,
              padding: 20,
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              fontFamily: "'Noto Sans KR','DM Sans',sans-serif",
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>정지 사유</span>
              <ModalCloseBtn onClick={() => setReasonModal(null)} t={t} />
            </div>
            <div style={{ height: 1, background: t.border, margin: '10px 0' }} />
            <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 14 }}>
              {[
                { label: '처리일시', value: formatDateTime(reasonModal.suspended_at), mono: true },
                { label: '처리자', value: reasonModal.suspended_by || 'System', mono: false },
              ].map((row, i, arr) => (
                <div
                  key={row.label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '7px 0',
                    borderBottom: i < arr.length - 1 ? `1px solid ${t.border}` : 'none',
                  }}
                >
                  <span style={{ fontSize: 11, color: t.textHint }}>{row.label}</span>
                  <span
                    style={{
                      fontSize: 12,
                      color: t.textSec,
                      fontFamily: row.mono ? "'DM Mono',monospace" : undefined,
                    }}
                  >
                    {row.value}
                  </span>
                </div>
              ))}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '7px 0',
                }}
              >
                <span style={{ fontSize: 11, color: t.textHint }}>변경 상태</span>
                <Badge
                  label={STATUS_LABELS[reasonModal.status] ?? reasonModal.status}
                  bg={
                    VIOL_STATUS_MAP[STATUS_LABELS[reasonModal.status] ?? reasonModal.status]?.bg ??
                    t.surface2
                  }
                  color={
                    VIOL_STATUS_MAP[STATUS_LABELS[reasonModal.status] ?? reasonModal.status]
                      ?.color ?? t.textSec
                  }
                  border={
                    VIOL_STATUS_MAP[STATUS_LABELS[reasonModal.status] ?? reasonModal.status]
                      ?.border ?? t.border
                  }
                />
              </div>
            </div>
            <div style={{ fontSize: 11, color: t.textHint, marginBottom: 6 }}>사유</div>
            <div style={{ fontSize: 13, color: t.text, lineHeight: 1.6 }}>
              {reasonModal.suspend_reason || '—'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                onClick={() => setReasonModal(null)}
                style={{
                  height: 32,
                  padding: '0 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: t.accent,
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: "'Noto Sans KR',sans-serif",
                }}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
