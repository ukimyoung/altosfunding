import { useEffect, useMemo } from 'react';
import { Calendar } from 'lucide-react';
import { useSearchParams } from 'react-router';
import {
  DataTable,
  TablePagination,
  buildPaginationItems,
  buildPaginationSummary,
  getPaginationRange,
} from '../../components/shared/DataTable';
import {
  DateRangeFilter,
  SelectFilter,
  TableFilterBar,
} from '../../components/shared/TableFilters';
import { useAppShell } from '../../layouts/AppShell';
import { useChallengeGroupedQuery } from '../../queries/challenges';
import { formatKstDateTime, formatNumber } from '../../utils/utils';

const PAGE_SIZE = 20;
const TIER_CODES = ['100', '300', '500'] as const;

type StatusFilterValue = '' | 'ACTIVE' | 'PENDING' | 'CLOSED';

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> =
  {
    ACTIVE: {
      label: '진행 중',
      bg: 'rgba(22,163,74,0.1)',
      color: '#16A34A',
      border: 'rgba(22,163,74,0.2)',
    },
    PENDING: {
      label: '예정',
      bg: 'rgba(217,119,6,0.1)',
      color: '#D97706',
      border: 'rgba(217,119,6,0.2)',
    },
    CLOSED: {
      label: '종료',
      bg: 'rgba(113,113,122,0.1)',
      color: '#71717A',
      border: 'rgba(113,113,122,0.2)',
    },
  };

function toApiDate(value: string) {
  return value ? value.replace(/-/g, '') : '';
}

function formatPeriod(startAt: string, endAt: string) {
  return `${formatKstDateTime(startAt)} ~ ${formatKstDateTime(endAt)} (GMT+9)`;
}

function getChallengeStatusConfig(status: string) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.CLOSED;
}

export function CompetitionListPage() {
  const { dark } = useAppShell();
  const [searchParams, setSearchParams] = useSearchParams();

  const statusParam = searchParams.get('status');
  const statusFilter: StatusFilterValue =
    statusParam === 'ACTIVE' || statusParam === 'PENDING' || statusParam === 'CLOSED'
      ? statusParam
      : '';
  const dateFilter = searchParams.get('dateFrom') ?? searchParams.get('date') ?? '';
  const page = Number(searchParams.get('page') ?? '1') || 1;

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
      if (value === null || value === undefined || value === '' || value === 'all') {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });

    setSearchParams(next, { replace: true });
  };

  const queryParams = useMemo(
    () => ({
      status: statusFilter || undefined,
      date: dateFilter ? toApiDate(dateFilter) : undefined,
      page,
      size: PAGE_SIZE,
    }),
    [dateFilter, page, statusFilter],
  );

  const { data, isError, isLoading, isPlaceholderData } = useChallengeGroupedQuery(queryParams);

  const rows = data?.items ?? [];
  const totalCount = data?.total ?? rows.length;
  const currentPage = !isPlaceholderData && data?.page ? data.page : page;
  const currentSize = data?.size ?? PAGE_SIZE;
  const totalPages = Math.max(1, data?.pages ?? Math.ceil(totalCount / currentSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  useEffect(() => {
    if (data && !isPlaceholderData && page !== safeCurrentPage) {
      updateParams({ page: safeCurrentPage });
    }
  }, [data, isPlaceholderData, page, safeCurrentPage]);

  const { start, end } = getPaginationRange({
    totalItems: totalCount,
    currentPage: safeCurrentPage,
    pageSize: currentSize,
    currentPageItemCount: rows.length,
  });

  const paginationItems = buildPaginationItems({
    currentPage: safeCurrentPage,
    totalPages,
    onPageChange: (nextPage) => updateParams({ page: nextPage }),
  });

  const summary = buildPaginationSummary({
    totalItems: totalCount,
    start,
    end,
  });

  const updateStatus = (value: string) => {
    updateParams({ status: value, page: 1 });
  };

  const updateDate = (value: string) => {
    updateParams({ dateFrom: value, date: null, page: 1 });
  };

  return (
    <div style={{ background: t.pageBg, minHeight: '100vh' }}>
      <div
        style={{
          padding: '32px 24px 24px',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: t.text, margin: 0, marginBottom: 8 }}>
            대회 목록
          </h1>
          <p style={{ fontSize: 13, color: t.textSec, margin: 0 }}>
            챌린지 대회를 관리합니다. 행 클릭 시 해당 대회의 Leaderboard로 이동합니다.
          </p>
        </div>
      </div>

      <div style={{ padding: '0 24px' }}>
        <TableFilterBar background={t.surface} borderColor={t.border}>
          <SelectFilter
            value={statusFilter}
            onChange={updateStatus}
            width={140}
            background={t.surface2}
            borderColor={t.border}
            textColor={t.text}
            iconColor={t.text}
            options={[
              { value: '', label: '상태: 전체' },
              { value: 'ACTIVE', label: '진행 중' },
              { value: 'PENDING', label: '예정' },
              { value: 'CLOSED', label: '종료' },
            ]}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={15} style={{ color: t.textHint, flexShrink: 0 }} />
            {/* 현재 모든 날짜 선택 가능하도록 되어있는데 추후에 오늘까지만 선택되도록 수정 필요할 수 있음 */}
            <DateRangeFilter
              startValue={dateFilter}
              onStartChange={updateDate}
              endValue=""
              onEndChange={() => undefined}
              startWidth={140}
              endWidth={140}
              background={t.surface2}
              borderColor={t.border}
              textColor={t.text}
              separator="~"
              showEnd={false}
            />
          </div>
        </TableFilterBar>
      </div>

      <div style={{ padding: '0 24px 32px' }}>
        <DataTable
          columns={[
            { key: 'period', label: '기간 (GMT+9)', width: '34%' },
            { key: 'participants', label: '티어별 참가자', width: '48%' },
            { key: 'status', label: '상태', width: '18%' },
          ]}
          rows={rows}
          isLoading={isLoading}
          rowKey={(row) => `${row.start_at}-${row.end_at}`}
          shellStyle={{
            background: t.surface,
            borderRadius: 12,
            border: `1px solid ${t.border}`,
            overflow: 'hidden',
          }}
          tableStyle={{ width: '100%', borderCollapse: 'collapse' }}
          headerRowStyle={{ background: t.surface2, borderBottom: `1px solid ${t.border}` }}
          headerCellStyle={{
            padding: '12px 16px',
            textAlign: 'left',
            fontSize: 11,
            fontWeight: 600,
            color: t.textSec,
            whiteSpace: 'nowrap',
          }}
          rowStyle={(_, index) => ({
            borderBottom: index < rows.length - 1 ? `1px solid ${t.border}` : 'none',
          })}
          emptyState={
            <div style={{ padding: 24, textAlign: 'center', color: t.textHint, fontSize: 13 }}>
              {isLoading
                ? '챌린지 대회 목록을 불러오는 중입니다.'
                : isError
                  ? '챌린지 대회 목록을 불러오지 못했습니다.'
                  : '조회 결과가 없습니다.'}
            </div>
          }
          rowRenderer={(row) => {
            const statusCfg = getChallengeStatusConfig(row.status);
            const participants = row.participants ?? {};

            return (
              <>
                <td
                  style={{
                    padding: '16px',
                    fontSize: 13,
                    color: t.text,
                    fontFamily: "'DM Mono', monospace",
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatPeriod(row.start_at, row.end_at)}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {TIER_CODES.map((tier) => (
                      <div
                        key={tier}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          padding: '6px 12px',
                          borderRadius: 8,
                          background: dark ? 'rgba(124,106,247,0.08)' : 'rgba(124,106,247,0.06)',
                          border: '1px solid rgba(124,106,247,0.2)',
                          minWidth: 64,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: '#7C6AF7',
                            fontFamily: "'DM Mono', monospace",
                          }}
                        >
                          ${tier}
                        </span>
                        <span style={{ fontSize: 12, color: t.textSec, marginTop: 2 }}>
                          {formatNumber(participants[tier] ?? 0)}명
                        </span>
                      </div>
                    ))}
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
                      background: statusCfg.bg,
                      color: statusCfg.color,
                      border: `1px solid ${statusCfg.border}`,
                    }}
                  >
                    {statusCfg.label}
                  </span>
                </td>
              </>
            );
          }}
          footer={
            <TablePagination
              summary={summary}
              items={paginationItems}
              borderColor={t.border}
              textColor={t.textSec}
              activeBackground={t.accent}
              inactiveBackground={t.surface2}
              inactiveBorderColor={t.border}
              containerStyle={{ padding: '12px 16px' }}
            />
          }
        />
      </div>
    </div>
  );
}
