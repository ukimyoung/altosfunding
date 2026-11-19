import { useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import type { AccountStatus, AccountTier, ListAccountsResponse } from '@/api/account';
import type { Account } from '../../types/account';
import { getPageIdFromPath } from '../../config/navigation';
import { useAppShell } from '../../layouts/AppShell';
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
import { tok } from '../../theme/tokens';
import { challengeTierLabel } from '../../utils/revenue';
import { useListCatalogProductsQuery } from '../../queries/catalogProducts';
import { AccountDetailDrawer } from '../../components/accounts/AccountDetailDrawer';
import { AccountListTable } from '../../components/accounts/AccountListTable';
import {
  accountsQueryKeys,
  useAccountStatsQuery,
  useListTierAccountsQuery,
} from '../../queries/accounts';

type AccountListView = 'challenge' | 'funded';

const pageSize = 20;

const CHALLENGE_STATUS_OPTIONS = [
  { value: 'PENDING', label: '대기' },
  { value: 'ACTIVE', label: '활성' },
  // Core는 IN_PROGRESS를 쓰지 않는다 (대회 진행 중 = ACTIVE)
  // { value: 'IN_PROGRESS', label: '진행중' },
  { value: 'CLOSED', label: '종료' },
  { value: 'PASSED', label: '통과' },
  { value: 'FAILED', label: '실패' },
  { value: 'INACTIVE', label: '비활성' },
  { value: 'BANNED', label: '영구정지' },
] as const satisfies ReadonlyArray<{ value: AccountStatus; label: string }>;

const FUNDED_STATUS_OPTIONS = [
  { value: 'PENDING', label: '대기' },
  { value: 'ACTIVE', label: '활성' },
  { value: 'IN_PROGRESS', label: '진행중' },
  { value: 'CLOSED', label: '종료' },
  { value: 'PENDING_PAYOUT', label: '보상금 출금중' },
  { value: 'FAILED', label: '실패' },
  { value: 'INACTIVE', label: '비활성' },
  { value: 'BANNED', label: '영구정지' },
] as const satisfies ReadonlyArray<{ value: AccountStatus; label: string }>;

const viewToTier = (view: AccountListView): AccountTier =>
  view === 'challenge' ? 'CHALLENGE' : 'FUNDED';

const toAccountTypeParam = (value: string) => {
  if (value === 'all') return null;
  return value;
};

const toDateParam = (value: string) => value.replace(/\D/g, '') || null;

export function AccountManagementPage() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { dark } = useAppShell();
  const view: AccountListView =
    getPageIdFromPath(location.pathname) === 'funded-account' ? 'funded' : 'challenge';
  const t = tok(dark);
  const [drawerAcct, setDrawerAcct] = useState<Account | null>(null);

  const isChallenge = view === 'challenge';
  const tier = viewToTier(view);
  const search = searchParams.get('search') ?? '';
  const statusFilter = searchParams.get('status') ?? 'all';
  const accountTypeFilter = searchParams.get('accountType') ?? 'all';
  const startDate = searchParams.get('startDate') ?? '';
  const endDate = searchParams.get('endDate') ?? '';
  const currentPage = Number(searchParams.get('page') ?? '1') || 1;
  const [searchDraft, setSearchDraft] = useState(search);
  const accountParams = useMemo(
    () => ({
      keyword: search.trim().length >= 2 ? search.trim() : null,
      status: statusFilter !== 'all' ? (statusFilter as AccountStatus) : null,
      type_code: toAccountTypeParam(accountTypeFilter),
      start_date: toDateParam(startDate),
      end_date: toDateParam(endDate),
      page: currentPage,
      size: pageSize,
    }),
    [accountTypeFilter, currentPage, endDate, search, startDate, statusFilter],
  );
  const {
    data: accountData,
    isLoading: isAccountLoading,
    isPlaceholderData,
    refetch: refetchAccounts,
  } = useListTierAccountsQuery(tier, accountParams);
  const { data: accountStats, refetch: refetchAccountStats } = useAccountStatsQuery(tier);
  // 계좌 유형 필터 = 해당 티어 상품 (상품명에서 'Challenge ' 제외, 값은 상품코드)
  const { data: productData } = useListCatalogProductsQuery({ tier_type: tier, page: 1, size: 100 });
  const accountTypeOptions = (productData?.items ?? []).map((product) => ({
    value: product.product_id,
    label: challengeTierLabel(product.name) || product.product_id,
  }));
  const rows = accountData?.items ?? [];

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

  const totalRows = accountData?.total ?? rows.length;
  const responsePageSize = accountData?.size ?? pageSize;
  const totalPages = Math.max(1, accountData?.pages ?? Math.ceil(totalRows / responsePageSize));
  const responsePage = !isPlaceholderData && accountData ? accountData.page : currentPage;
  const safeCurrentPage = Math.min(Math.max(1, responsePage), totalPages);
  const visibleRows = rows;
  const paginationRange = getPaginationRange({
    totalItems: totalRows,
    currentPage: safeCurrentPage,
    pageSize: responsePageSize,
    currentPageItemCount: visibleRows.length,
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
    setDrawerAcct(null);
  }, [tier]);

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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        {(isChallenge
          ? [
              {
                label: '전체 챌린지 계좌',
                value: accountStats?.total_accounts.toLocaleString() ?? '0',
                color: t.text,
              },
              {
                label: '진행중',
                value: accountStats?.in_progress_accounts.toLocaleString() ?? '0',
                color: '#2563EB',
              },
            ]
          : [
              {
                label: '전체 펀디드 계좌',
                value: accountStats?.total_accounts.toLocaleString() ?? '0',
                color: t.text,
              },
              {
                label: '진행중',
                value: accountStats?.in_progress_accounts.toLocaleString() ?? '0',
                color: '#2563EB',
              },
            ]
        ).map((card, ci) => (
          <div
            key={ci}
            style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: 12,
              padding: 16,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: t.textHint,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                fontFamily: "'DM Sans',sans-serif",
                marginBottom: 8,
              }}
            >
              {card.label}
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 600,
                color: card.color,
                fontFamily: "'DM Mono',monospace",
              }}
            >
              {card.value}
            </div>
          </div>
        ))}
      </div>

      <TableFilterBar background={t.surface} borderColor={t.border}>
        <SearchField
          value={searchDraft}
          onChange={setSearchDraft}
          placeholder="계좌번호 / 이름 / 이메일 검색"
          minWidth={200}
          background={t.surface2}
          borderColor={t.border}
          textColor={t.text}
          iconColor={t.text}
        />
        <SelectFilter
          value={statusFilter}
          onChange={(value) => updateParams({ status: value, page: 1 })}
          width={140}
          background={t.surface2}
          borderColor={t.border2}
          textColor={t.textSec}
          iconColor={t.text}
          options={[
            { value: 'all', label: '상태: 전체' },
            ...(isChallenge ? CHALLENGE_STATUS_OPTIONS : FUNDED_STATUS_OPTIONS),
          ]}
        />
        <SelectFilter
          value={accountTypeFilter}
          onChange={(value) => updateParams({ accountType: value, page: 1 })}
          width={140}
          background={t.surface2}
          borderColor={t.border2}
          textColor={t.textSec}
          iconColor={t.text}
          options={[
            { value: 'all', label: '계좌 유형: 전체' },
            ...accountTypeOptions,
            // { value: '100', label: '$100' },
            // { value: '300', label: '$300' },
            // { value: '500', label: '$500' },
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

      <AccountListTable
        dark={dark}
        tier={tier}
        accounts={visibleRows}
        isLoading={isAccountLoading}
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
          onStatusChanged={async (accountId, status) => {
            await Promise.all([refetchAccounts(), refetchAccountStats()]);
            queryClient.setQueryData<ListAccountsResponse>(
              accountsQueryKeys.listTierAccounts(tier, accountParams),
              (current) =>
                current
                  ? {
                      ...current,
                      items: current.items.map((account) =>
                        account.account_id === accountId ? { ...account, status } : account,
                      ),
                    }
                  : current,
            );
          }}
          onClose={() => setDrawerAcct(null)}
        />
      )}
    </div>
  );
}
