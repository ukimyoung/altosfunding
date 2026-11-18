import { useEffect, useMemo, useState } from 'react';
import { useAppShell } from '../../layouts/AppShell';
import { tok } from '../../theme/tokens';
import {
  DataTable,
  TablePagination,
  buildPaginationItems,
  buildPaginationSummary,
  getPaginationRange,
} from '../../components/shared/DataTable';
import {
  SEARCH_DEBOUNCE_MS,
  DateRangeFilter,
  SearchField,
  SelectFilter,
  TableFilterBar,
} from '../../components/shared/TableFilters';
import {
  PURCHASE_STATUS_FILTER,
  getPurchaseStatusConfig,
  normalizePurchaseStatus,
} from '../../constants/purchaseHistory';
import { useChallengeOrdersSummaryQuery, useListChallengeOrdersQuery } from '../../queries/orders';
import { formatKstDateTime, formatUsdMoney } from '../../utils/utils';
import { useSearchParams } from 'react-router';
import type { ListChallengeOrdersParams } from '@/api/order';

type OrderRow = {
  id: string;
  uid: string;
  userEmail: string;
  userNickname: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: string;
  createdAt: string;
};

const PAGE_SIZE = 20;

const toDateParam = (value: string) => value.replace(/\D/g, '') || null;
const toDateInputValue = (value: string) => {
  const digits = value.replace(/\D/g, '');

  if (digits.length !== 8) {
    return '';
  }

  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
};

export function PurchaseHistoryPage() {
  const { dark } = useAppShell();
  const t = tok(dark);
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('search') ?? '';
  const statusFilter = normalizePurchaseStatus(searchParams.get('status') ?? 'All');
  const startDate = searchParams.get('startDate') ?? '';
  const endDate = searchParams.get('endDate') ?? '';
  const currentPage = Number(searchParams.get('page') ?? '1') || 1;
  const [searchDraft, setSearchDraft] = useState(search);

  const tableQueryParams = useMemo<ListChallengeOrdersParams>(
    () => ({
      keyword: search || undefined,
      status: statusFilter === 'All' ? undefined : statusFilter,
      start_date: toDateParam(startDate),
      end_date: toDateParam(endDate),
      page: currentPage,
      size: PAGE_SIZE,
    }),
    [currentPage, endDate, search, startDate, statusFilter],
  );

  const { data: tableData, isLoading, isError, isPlaceholderData } =
    useListChallengeOrdersQuery(tableQueryParams);
  const { data: summaryData } = useChallengeOrdersSummaryQuery();
  const orders = tableData?.items ?? [];

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

  const rows = useMemo<OrderRow[]>(
    () =>
      orders.map((order) => ({
        id: order.id,
        uid: order.uid,
        userEmail: order.user_email,
        userNickname: order.user_nickname,
        productName: order.product_name,
        quantity: order.quantity,
        // 가격(단가): 서버 unit_price 우선, 없으면 금액 ÷ 수량으로 계산
        unitPrice:
          order.unit_price ??
          (order.quantity > 0
            ? Math.abs(order.total_price) / order.quantity
            : Math.abs(order.total_price)),
        totalPrice: order.total_price,
        status: order.status,
        createdAt: order.created_at,
      })),
    [orders],
  );

  const totalPurchases = summaryData?.total_orders ?? 0;
  const totalPaymentAmount = summaryData?.total_payment ?? 0;
  const thisMonthNew = summaryData?.this_month_completed ?? 0;
  const refundCount = summaryData?.total_refunds ?? 0;

  const totalCount = tableData?.total ?? rows.length;
  const pageSize = tableData?.size ?? PAGE_SIZE;
  const totalPages = Math.max(1, tableData?.pages ?? Math.ceil(totalCount / pageSize));
  const responsePage = !isPlaceholderData && tableData?.page ? tableData.page : currentPage;
  const safeCurrentPage = Math.min(Math.max(1, responsePage), totalPages);
  const visiblePurchases = rows;
  const paginationRange = getPaginationRange({
    totalItems: totalCount,
    currentPage: safeCurrentPage,
    pageSize,
    currentPageItemCount: visiblePurchases.length,
  });

  const paginationItems = buildPaginationItems({
    currentPage: safeCurrentPage,
    totalPages,
    onPageChange: (page) => updateParams({ page }),
  });

  useEffect(() => {
    if (tableData && !isPlaceholderData && currentPage !== safeCurrentPage) {
      updateParams({ page: safeCurrentPage });
    }
  }, [currentPage, isPlaceholderData, safeCurrentPage, tableData]);

  useEffect(() => {
    if (startDate && endDate && startDate > endDate) {
      updateParams({ endDate: startDate, page: 1 });
    }
  }, [startDate, endDate]);

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
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: t.text, margin: 0, marginBottom: 8 }}>
          전체 구매/결제 이력
        </h1>
        <p style={{ fontSize: 13, color: t.textSec, margin: 0 }}>
          챌린지 계좌 구매 및 결제 전체 이력을 조회합니다.
        </p>
      </div>

      {/* Summary Stat Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <StatCard label="전체 구매 건수" value={totalPurchases.toLocaleString()} t={t} />
        <StatCard label="총 결제 금액" value={formatUsdMoney(totalPaymentAmount)} t={t} />
        <StatCard label="이번 달 신규" value={thisMonthNew.toLocaleString()} t={t} />
        <StatCard label="환불 건수" value={refundCount.toLocaleString()} t={t} />
      </div>

      {/* Filter Bar */}
      <TableFilterBar background={t.surface} borderColor={t.border}>
        <SearchField
          value={searchDraft}
          onChange={setSearchDraft}
          placeholder="주문번호 / 이름 / 이메일 / 상품명 검색"
          minWidth={280}
          background={t.surface2}
          borderColor={t.border}
          textColor={t.text}
          iconColor={t.text}
        />
        {/* 상품 타입 필터는 백엔드 스펙 확정 후 다시 연결 */}
        <SelectFilter
          value={statusFilter}
          onChange={(value) => updateParams({ status: value, page: 1 })}
          width={120}
          background={t.surface2}
          borderColor={t.border}
          textColor={t.text}
          iconColor={t.text}
          options={PURCHASE_STATUS_FILTER}
        />
        <DateRangeFilter
          startValue={toDateInputValue(startDate)}
          onStartChange={(value) => updateParams({ startDate: toDateParam(value), page: 1 })}
          endValue={toDateInputValue(endDate)}
          onEndChange={(value) => updateParams({ endDate: toDateParam(value), page: 1 })}
          startMax={toDateInputValue(endDate) || undefined}
          endMin={toDateInputValue(startDate) || undefined}
          background={t.surface2}
          borderColor={t.border}
          textColor={t.text}
        />
      </TableFilterBar>

      {/* Table */}
      <DataTable
        columns={[
          { key: 'orderId', label: '주문번호', width: '15%' },
          { key: 'buyer', label: '구매자', width: '21%' },
          { key: 'product', label: '상품', width: '15%' },
          { key: 'unitPrice', label: <div style={{ textAlign: 'right' }}>가격</div>, width: '10%' },
          { key: 'quantity', label: <div style={{ textAlign: 'center' }}>수량</div>, width: '7%' },
          { key: 'amount', label: <div style={{ textAlign: 'right' }}>금액</div>, width: '11%' },
          { key: 'paymentDate', label: '결제일', width: '12%' },
          { key: 'status', label: '상태' },
        ]}
        rows={visiblePurchases}
        isLoading={isLoading}
        rowKey={(purchase) => purchase.id}
        rowStyle={(_, i, isHovered) => ({
          height: 56,
          background: isHovered ? t.surface2 : 'transparent',
          borderBottom: i < visiblePurchases.length - 1 ? `1px solid ${t.border}` : 'none',
          transition: 'background 0.1s',
        })}
        shellStyle={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: 12,
          overflow: 'hidden',
        }}
        tableStyle={{
          width: '100%',
          minWidth: 1080,
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
        }}
        headerRowStyle={{
          background: t.surface2,
          height: 40,
          borderBottom: `1px solid ${t.border}`,
        }}
        headerCellStyle={{
          padding: '16px',
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
              ? '구매/결제 이력을 불러오는 중입니다.'
              : isError
                ? '구매/결제 이력을 불러오지 못했습니다.'
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
            inactiveBorderColor={t.border2}
            items={totalPages > 1 ? paginationItems : []}
          />
        }
        rowRenderer={(purchase: OrderRow) => {
          const statusConfig = getPurchaseStatusConfig(purchase.status);
          const isRefund = purchase.totalPrice < 0;
          /* 상품 열에 단가 뱃지·수량을 함께 표시하던 방식 (1118 디자인에서 가격·수량 열로 분리)
          const unitPrice =
            purchase.quantity > 0
              ? Math.abs(purchase.totalPrice) / purchase.quantity
              : Math.abs(purchase.totalPrice);
          const tierConfig = {
            100: {
              bg: 'rgba(22,163,74,0.1)',
              color: '#16A34A',
              border: 'rgba(22,163,74,0.2)',
            },
            300: {
              bg: 'rgba(124,106,247,0.1)',
              color: '#7C6AF7',
              border: 'rgba(124,106,247,0.2)',
            },
            500: {
              bg: 'rgba(217,119,6,0.1)',
              color: '#D97706',
              border: 'rgba(217,119,6,0.2)',
            },
          }[Math.round(unitPrice)] ?? {
            bg: 'rgba(124,106,247,0.1)',
            color: '#7C6AF7',
            border: 'rgba(124,106,247,0.2)',
          };

          */

          return (
            <>
              <td style={{ padding: '16px' }}>
                <div
                  style={{
                    fontSize: 11,
                    color: t.textSec,
                    fontFamily: "'DM Mono', monospace",
                    whiteSpace: 'nowrap',
                  }}
                >
                  {purchase.id}
                </div>
              </td>
              <td style={{ padding: '16px' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: t.text, marginBottom: 2 }}>
                  {purchase.userNickname}
                </div>
                <div style={{ fontSize: 12, color: t.textHint, marginBottom: 2 }}>
                  {purchase.userEmail}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: t.textHint,
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  {purchase.uid}
                </div>
              </td>
              {/* 이전 상품 열(단가 뱃지 × 수량 + 상품명) — 1118 디자인에서 가격·수량 열로 분리
              <td style={{ padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '4px 12px',
                      borderRadius: 9999,
                      fontSize: 12,
                      fontWeight: 600,
                      background: tierConfig.bg,
                      color: tierConfig.color,
                      border: `1px solid ${tierConfig.border}`,
                    }}
                  >
                    {formatUsdMoney(unitPrice)}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      color: t.text,
                      fontWeight: 500,
                    }}
                  >
                    × {purchase.quantity}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: t.text, fontWeight: 500 }}>
                  {purchase.productName}
                </div>
              </td>
              */}
              {/* Product: 상품 이름만 표시 */}
              <td style={{ padding: '16px', fontSize: 13, color: t.text, fontWeight: 500 }}>
                {purchase.productName}
              </td>
              {/* Unit Price */}
              <td
                style={{
                  padding: '16px',
                  textAlign: 'right',
                  fontSize: 13,
                  color: t.textSec,
                  fontFamily: "'DM Mono', monospace",
                  whiteSpace: 'nowrap',
                }}
              >
                {formatUsdMoney(purchase.unitPrice)}
              </td>
              {/* Quantity */}
              <td
                style={{
                  padding: '16px',
                  textAlign: 'center',
                  fontSize: 13,
                  color: t.textSec,
                  fontFamily: "'DM Mono', monospace",
                }}
              >
                {purchase.quantity.toLocaleString()}
              </td>
              <td
                style={{
                  padding: '16px',
                  textAlign: 'right',
                  fontSize: 14,
                  fontWeight: 600,
                  color: isRefund ? '#DC2626' : t.text,
                  fontFamily: "'DM Mono', monospace",
                  whiteSpace: 'nowrap',
                }}
              >
                {isRefund ? '-' : ''}
                {formatUsdMoney(Math.abs(purchase.totalPrice))}
              </td>
              <td
                style={{
                  padding: '16px',
                  fontSize: 12,
                  color: t.textSec,
                  fontFamily: "'DM Mono', monospace",
                  whiteSpace: 'nowrap',
                }}
              >
                {formatKstDateTime(purchase.createdAt)}
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
                  {statusConfig.label}
                </span>
              </td>
            </>
          );
        }}
      />
    </div>
  );
}

// Stat Card Component
interface StatCardProps {
  label: string;
  value: string;
  t: any;
}

function StatCard({ label, value, t }: StatCardProps) {
  return (
    <div
      style={{
        padding: '16px 20px',
        background: t.surface,
        borderRadius: 12,
        border: `1px solid ${t.border}`,
      }}
    >
      <div style={{ fontSize: 11, color: t.textSec, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 600, color: t.text }}>{value}</div>
    </div>
  );
}
