import { useEffect, useMemo } from 'react';
import { Calendar } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
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
import { ROUTE_BY_PAGE_ID } from '../../config/navigation';
import { useAppShell } from '../../layouts/AppShell';
import { useChallengeGroupedQuery } from '../../queries/challenges';
import type { ChallengeGroupedItem } from '../../../api/challenge';
import { formatNumber } from '../../utils/utils';

const PAGE_SIZE = 20;

type StatusFilterValue = '' | 'ACTIVE' | 'PENDING' | 'CLOSED' | 'CANCELLED';
const STATUS_VALUES: StatusFilterValue[] = ['ACTIVE', 'PENDING', 'CLOSED', 'CANCELLED'];

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> =
  {
    ACTIVE: {
      label: '진행 중',
      bg: 'rgba(22,163,74,0.1)',
      color: '#16A34A',
      border: 'rgba(22,163,74,0.2)',
    },
    PENDING: {
      label: '모집 중',
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
    CANCELLED: {
      label: '취소',
      bg: 'rgba(220,38,38,0.08)',
      color: '#DC2626',
      border: 'rgba(220,38,38,0.2)',
    },
  };

const kstPartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function kstParts(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = kstPartsFormatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return {
    year: get('year'),
    md: `${get('month')}.${get('day')}`,
    hm: `${get('hour')}:${get('minute')}`,
  };
}

/** 디자인 형식: 2026.06.04 09:00 ~ 06.04 23:59 (한국 시간). 종료 연도가 다르면 연도도 표시. */
function formatPeriod(startAt: string, endAt: string) {
  const start = kstParts(startAt);
  const end = kstParts(endAt);
  if (!start || !end) return `${startAt} ~ ${endAt}`;
  const endDate = end.year === start.year ? end.md : `${end.year}.${end.md}`;
  return `${start.year}.${start.md} ${start.hm} ~ ${endDate} ${end.hm}`;
}

/** Leaderboard는 대회 종료일(한국 시간, 목록의 기간 표시와 같은 기준)로 조회한다. */
function toLeaderboardDate(endAt: string) {
  const end = kstParts(endAt);
  return end ? `${end.year}${end.md.replace('.', '')}` : '';
}

/** 상품명에서 'Challenge ' 접두어를 떼어 티어 이름으로 쓴다 (웹 Start New Challenge와 같은 규칙). */
function tierLabel(name: string) {
  return name.replace(/^challenge\s+/i, '') || name;
}

function getTiers(row: ChallengeGroupedItem) {
  if (row.tiers && row.tiers.length > 0) {
    return row.tiers.map((tier) => ({
      key: tier.challenge_id,
      label: tierLabel(tier.product_name),
      participants: tier.participants,
    }));
  }
  // tiers가 없는 응답(이전 서버)은 type_code별 참가자 수로 표시
  return Object.entries(row.participants ?? {}).map(([code, participants]) => ({
    key: code,
    label: `$${code}`,
    participants,
  }));
}

function getChallengeStatusConfig(status: string) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.CLOSED;
}

export function CompetitionListPage() {
  const { dark } = useAppShell();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const statusParam = searchParams.get('status') as StatusFilterValue | null;
  const statusFilter: StatusFilterValue =
    statusParam && STATUS_VALUES.includes(statusParam) ? statusParam : '';
  const dateFrom = searchParams.get('dateFrom') ?? searchParams.get('date') ?? '';
  const dateTo = searchParams.get('dateTo') ?? '';
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
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      page,
      size: PAGE_SIZE,
    }),
    [dateFrom, dateTo, page, statusFilter],
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

  const updateDateFrom = (value: string) => {
    updateParams({ dateFrom: value, date: null, page: 1 });
  };

  const updateDateTo = (value: string) => {
    updateParams({ dateTo: value, page: 1 });
  };

  const openLeaderboard = (row: ChallengeGroupedItem) => {
    const date = toLeaderboardDate(row.end_at);
    navigate(date ? `${ROUTE_BY_PAGE_ID.leaderboard}?date=${date}` : ROUTE_BY_PAGE_ID.leaderboard);
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
              { value: 'PENDING', label: '모집 중' },
              { value: 'CLOSED', label: '종료' },
              { value: 'CANCELLED', label: '취소' },
            ]}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={15} style={{ color: t.textHint, flexShrink: 0 }} />
            {/* 현재 모든 날짜 선택 가능하도록 되어있는데 추후에 오늘까지만 선택되도록 수정 필요할 수 있음 */}
            {/* 시작일 기준(한국 시간) 범위 */}
            <DateRangeFilter
              startValue={dateFrom}
              onStartChange={updateDateFrom}
              endValue={dateTo}
              onEndChange={updateDateTo}
              startWidth={140}
              endWidth={140}
              background={t.surface2}
              borderColor={t.border}
              textColor={t.text}
              separator="~"
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
          rowKey={(row) => `${row.start_at}-${row.end_at}-${row.status}`}
          onRowClick={(row) => openLeaderboard(row)}
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
          rowStyle={(_, index, isHovered) => ({
            borderBottom: index < rows.length - 1 ? `1px solid ${t.border}` : 'none',
            cursor: 'pointer',
            background: isHovered ? (dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)') : undefined,
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
            const tiers = getTiers(row);

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
                    {tiers.length === 0 && (
                      <span style={{ fontSize: 12, color: t.textHint }}>-</span>
                    )}
                    {tiers.map((tier) => (
                      <div
                        key={tier.key}
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
                          {tier.label}
                        </span>
                        <span style={{ fontSize: 12, color: t.textSec, marginTop: 2 }}>
                          {formatNumber(tier.participants)}명
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
