import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { AccountStatus } from '@/api/account';
import { LIVE_ACCOUNT_STATUS_FILTER } from '../../constants/status';
import { useListTierAccountsQuery } from '../../queries/accounts';
import { useAppShell } from '../../layouts/AppShell';
import { tok } from '../../theme/tokens';
import {
  TablePagination,
  buildPaginationItems,
  buildPaginationSummary,
  getPaginationRange,
} from '../../components/shared/DataTable';
import {
  DateRangeFilter,
  SEARCH_DEBOUNCE_MS,
  SearchField,
  SelectFilter,
  TableFilterBar,
} from '../../components/shared/TableFilters';
import { AccountListTable } from '../../components/accounts/AccountListTable';
import { AccountDetailDrawer } from '../../components/accounts/AccountDetailDrawer';
import type { Account } from '../../types/account';

const pageSize = 20;
const toDateParam = (value: string) => value.replace(/\D/g, '') || null;

const toStatusParam = (value: string): AccountStatus | null => {
  if (value === 'ACTIVE' || value === 'IN_PROGRESS' || value === 'INACTIVE' || value === 'BANNED') {
    return value;
  }
  return null;
};

export function LiveAccountPage() {
  const { dark } = useAppShell();
  const t = tok(dark);
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('search') ?? '';
  // const platformFilter = searchParams.get('platform') ?? 'All';
  const statusFilter = searchParams.get('status') ?? 'All';
  const startDate = searchParams.get('startDate') ?? '';
  const endDate = searchParams.get('endDate') ?? '';
  const currentPage = Number(searchParams.get('page') ?? '1') || 1;
  const [searchDraft, setSearchDraft] = useState(search);
  const [drawerAcct, setDrawerAcct] = useState<Account | null>(null);

  const accountParams = useMemo(
    () => ({
      keyword: search.trim().length >= 2 ? search.trim() : null,
      status: toStatusParam(statusFilter),
      start_date: toDateParam(startDate),
      end_date: toDateParam(endDate),
      page: currentPage,
      size: pageSize,
    }),
    [currentPage, endDate, search, startDate, statusFilter],
  );
  const { data: accountData, isLoading, isPlaceholderData } = useListTierAccountsQuery(
    'LIVE',
    accountParams,
  );
  const rows = accountData?.items ?? [];

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

  const totalRows = accountData?.total ?? rows.length;
  const responsePageSize = accountData?.size ?? pageSize;
  const totalPages = Math.max(1, accountData?.pages ?? Math.ceil(totalRows / responsePageSize));
  const responsePage = !isPlaceholderData && accountData ? accountData.page : currentPage;
  const safeCurrentPage = Math.min(Math.max(1, responsePage), totalPages);
  const paginationRange = getPaginationRange({
    totalItems: totalRows,
    currentPage: safeCurrentPage,
    pageSize: responsePageSize,
    currentPageItemCount: rows.length,
  });

  useEffect(() => {
    if (accountData && !isPlaceholderData && currentPage !== safeCurrentPage) {
      updateParams({ page: safeCurrentPage });
    }
  }, [accountData, currentPage, isPlaceholderData, safeCurrentPage]);

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
    <div style={{ padding: 32, background: t.pageBg, minHeight: '100vh' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: t.text, margin: 0, marginBottom: 8 }}>
          라이브 계좌 관리
        </h1>
        <p style={{ fontSize: 13, color: t.textSec, margin: 0 }}>
          Altos Funding에서 발급한 MTS 라이브 계좌 목록을 관리합니다.
        </p>
      </div>

      <div
        style={{
          maxWidth: 240,
          padding: '16px 20px',
          background: t.surface,
          borderRadius: 12,
          border: `1px solid ${t.border}`,
          marginBottom: 24,
        }}
      >
        <div style={{ fontSize: 11, color: t.textSec, marginBottom: 6 }}>전체 라이브 계좌</div>
        <div style={{ fontSize: 28, fontWeight: 600, color: t.text }}>
          {totalRows.toLocaleString()}
        </div>
      </div>

      <TableFilterBar background={t.surface} borderColor={t.border}>
        <SearchField
          value={searchDraft}
          onChange={setSearchDraft}
          placeholder="계좌번호 / 이름 / 이메일 검색"
          minWidth={280}
          background={t.surface2}
          borderColor={t.border}
          textColor={t.text}
          iconColor={t.text}
        />
        {/* <SelectFilter
          value={platformFilter}
          onChange={(value) => updateParams({ platform: value, page: 1 })}
          width={120}
          background={t.surface2}
          borderColor={t.border}
          textColor={t.text}
          iconColor={t.text}
          options={PLATFORM_FILTER}
        /> */}
        <SelectFilter
          value={statusFilter}
          onChange={(value) => updateParams({ status: value, page: 1 })}
          width={120}
          background={t.surface2}
          borderColor={t.border}
          textColor={t.text}
          iconColor={t.text}
          options={LIVE_ACCOUNT_STATUS_FILTER}
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

      <AccountListTable
        dark={dark}
        tier="LIVE"
        accounts={rows}
        isLoading={isLoading}
        onRowClick={(row) => setDrawerAcct(row.drawerAccount)}
        footer={
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
        }
      />

      {drawerAcct && (
        <AccountDetailDrawer
          acct={drawerAcct}
          dark={dark}
          useApi
          showTradeHistory={false}
          onClose={() => setDrawerAcct(null)}
        />
      )}
    </div>
  );
}
