import { Fragment, type CSSProperties } from "react";
import type {
  ChallengeRevenueColumn,
  ChallengeRevenueRow,
  ChallengeRevenueSummary,
  RevenueSearchState,
  RevenueThemeTokens,
} from "../../types/revenue";
import { CHALLENGE_REVENUE_FALLBACK_COLUMNS } from "../../constants/revenue";
import { formatRevenueAmount, formatRevenueQuantity } from "../../utils/revenue";
import { RevenueEmptyCell } from "./RevenueEmptyCell";

interface ChallengeRevenueTableProps {
  state: RevenueSearchState;
  rows: ChallengeRevenueRow[];
  allRows: ChallengeRevenueRow[];
  columns: ChallengeRevenueColumn[];
  summary: ChallengeRevenueSummary | null;
  query: string;
  t: RevenueThemeTokens;
}

export function ChallengeRevenueTable({ state, rows, allRows, columns, summary, query, t }: ChallengeRevenueTableProps) {
  const thBase: CSSProperties = {
    padding: "10px 12px", fontSize: 12, fontWeight: 600,
    color: t.textSec, textAlign: "center", whiteSpace: "nowrap",
    borderBottom: `1px solid ${t.border}`,
    fontFamily: "'DM Sans','Noto Sans KR',sans-serif",
    background: t.surface2,
  };
  const numCell: CSSProperties = {
    textAlign: "right", padding: "9px 14px",
    fontFamily: "ui-monospace,'DM Mono',monospace",
    fontSize: 13, color: t.text,
    borderBottom: `1px solid ${t.border}`,
  };
  const dateCell: CSSProperties = {
    textAlign: "left", padding: "9px 14px",
    fontFamily: "ui-monospace,'DM Mono',monospace",
    fontSize: 13, color: t.text,
    borderBottom: `1px solid ${t.border}`,
  };

  // 열은 Core 활성 챌린지 상품 기준(RevenuePage에서 전달). 상품을 못 불러온 경우에만 디자인 기본 4개.
  const visibleColumns = columns.length > 0 ? columns : CHALLENGE_REVENUE_FALLBACK_COLUMNS;

  const total = summary ?? allRows.reduce<ChallengeRevenueSummary>((acc, r) => ({
    quantity: acc.quantity + r.totalQty,
    amount: acc.amount + r.totalAmt,
    by_product: visibleColumns.reduce<ChallengeRevenueSummary["by_product"]>((next, column) => {
      const product = r.products[column.product_id];
      const current = acc.by_product[column.product_id] ?? { quantity: 0, amount: 0 };
      next[column.product_id] = {
        quantity: current.quantity + (product?.quantity ?? 0),
        amount: current.amount + (product?.amount ?? 0),
      };
      return next;
    }, { ...acc.by_product }),
  }), { quantity: 0, amount: 0, by_product: {} });

  const tfootCell: CSSProperties = {
    ...numCell, fontWeight: 700,
    background: t.tfoot,
    borderBottom: "none",
  };

  const emptyMsg =
    state === "idle"       ? "검색 조건을 설정하고 조회 버튼을 눌러주세요." :
    state === "loading"    ? "조회 중입니다." :
    state === "no_period"  ? "일별 / 주별 / 월별 / 연별 중 하나를 선택해주세요." :
    state === "not_found"  ? `'${query}'에 해당하는 유저를 찾을 수 없습니다.` :
    state === "no_data"    ? "데이터가 없습니다." :
    state === "error"      ? "매출 현황을 불러오지 못했습니다." : "";

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: Math.max(700, 160 + visibleColumns.length * 170) }}>
        <thead>
          <tr>
            <th rowSpan={2} style={{ ...thBase, textAlign: "left", paddingLeft: 14, borderRight: `1px solid ${t.border}` }}>일자</th>
            {visibleColumns.map((column) => (
              <th key={column.product_id} colSpan={2} style={{ ...thBase, borderRight: `1px solid ${t.border}` }}>
                {column.label}
                {/* 이전 디자인: 티어명 옆 가격 표시 — {column.label} (${formatRevenueQuantity(column.price_usdt)}) */}
              </th>
            ))}
            <th colSpan={2} style={{ ...thBase }}>합계</th>
          </tr>
          <tr>
            {visibleColumns.map((column) => (
              <Fragment key={column.product_id}>
                <th key={`${column.product_id}-qty`} style={{ ...thBase, fontWeight: 500 }}>수량</th>
                <th key={`${column.product_id}-amt`} style={{ ...thBase, fontWeight: 500, borderRight: `1px solid ${t.border}` }}>금액</th>
              </Fragment>
            ))}
            <th style={{ ...thBase, fontWeight: 500 }}>수량</th>
            <th style={{ ...thBase, fontWeight: 500 }}>금액</th>
          </tr>
        </thead>
        <tbody>
          {state !== "results" ? (
            <RevenueEmptyCell colspan={3 + visibleColumns.length * 2} msg={emptyMsg} t={t} />
          ) : (
            rows.map(r => (
              <tr key={r.label} style={{ transition: "background 0.1s" }}>
                <td style={{ ...dateCell, borderRight: `1px solid ${t.border}` }}>{r.label}</td>
                {visibleColumns.map((column) => {
                  const product = r.products[column.product_id];
                  return (
                    <Fragment key={`${r.label}-${column.product_id}`}>
                      <td key={`${r.label}-${column.product_id}-qty`} style={numCell}>{formatRevenueQuantity(product?.quantity ?? 0)}</td>
                      <td key={`${r.label}-${column.product_id}-amt`} style={{ ...numCell, borderRight: `1px solid ${t.border}` }}>{formatRevenueAmount(product?.amount ?? 0)}</td>
                    </Fragment>
                  );
                })}
                <td style={numCell}>{formatRevenueQuantity(r.totalQty)}</td>
                <td style={numCell}>{formatRevenueAmount(r.totalAmt)}</td>
              </tr>
            ))
          )}
        </tbody>
        {state === "results" && (
          <tfoot>
            <tr>
              <td style={{ ...tfootCell, textAlign: "left", paddingLeft: 14, borderRight: `1px solid ${t.border}`, fontFamily: "'DM Sans','Noto Sans KR',sans-serif" }}>합계</td>
              {visibleColumns.map((column) => {
                const product = total.by_product[column.product_id] ?? { quantity: 0, amount: 0 };
                return (
                  <Fragment key={`total-${column.product_id}`}>
                    <td key={`total-${column.product_id}-qty`} style={tfootCell}>{formatRevenueQuantity(product.quantity)}</td>
                    <td key={`total-${column.product_id}-amt`} style={{ ...tfootCell, borderRight: `1px solid ${t.border}` }}>{formatRevenueAmount(product.amount)}</td>
                  </Fragment>
                );
              })}
              <td style={tfootCell}>{formatRevenueQuantity(total.quantity)}</td>
              <td style={tfootCell}>{formatRevenueAmount(total.amount)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
