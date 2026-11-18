import { REVENUE_KNOWN_USERS } from "../constants/revenue";
import type {
  ChallengeRevenueColumn,
  ChallengeRevenueDailyRow,
  ChallengeRevenueRow,
  ChallengeRevenueSummary,
  FundedRevenueDailyRow,
  FundedRevenueRow,
  FundedRevenueSummary,
  RevenuePeriod,
} from "../types/revenue";
import type {
  ChallengeSalesReportResponse,
  FundedSalesReportResponse,
  SalesReportPeriod,
  SalesReportParams,
} from "@/api/revenue";

export const formatRevenueAmount = (value: number) => "$" + value.toLocaleString("en-US");
export const formatRevenueQuantity = (value: number) => value.toLocaleString("en-US");

/** 상품명에서 'Challenge ' 접두어를 떼어 티어 이름으로 쓴다 (대회 목록·웹 Start New Challenge와 같은 규칙). */
export function challengeTierLabel(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  return trimmed.replace(/^challenge\s+/i, "") || trimmed;
}

export function toSalesReportPeriod(period: RevenuePeriod): SalesReportPeriod {
  if (period === "주별") return "weekly";
  if (period === "월별") return "monthly";
  return "yearly";
}

export function buildSalesReportParams(
  period: RevenuePeriod,
  keyword: string,
  startDate: string,
  endDate: string,
): SalesReportParams {
  const trimmedKeyword = keyword.trim();
  return {
    period: toSalesReportPeriod(period),
    ...(startDate ? { start_date: startDate } : {}),
    ...(endDate ? { end_date: endDate } : {}),
    ...(trimmedKeyword ? { keyword: trimmedKeyword } : {}),
  };
}

export function mapChallengeSalesReport(response: ChallengeSalesReportResponse): {
  columns: ChallengeRevenueColumn[];
  rows: ChallengeRevenueRow[];
  summary: ChallengeRevenueSummary;
} {
  const rows = response.items.map((item) => {
    const first = response.columns[0]?.product_id;
    const second = response.columns[1]?.product_id;
    const third = response.columns[2]?.product_id;

    return {
      label: item.date,
      products: item.products,
      starterQty: first ? item.products[first]?.quantity ?? 0 : 0,
      starterAmt: first ? item.products[first]?.amount ?? 0 : 0,
      proQty: second ? item.products[second]?.quantity ?? 0 : 0,
      proAmt: second ? item.products[second]?.amount ?? 0 : 0,
      eliteQty: third ? item.products[third]?.quantity ?? 0 : 0,
      eliteAmt: third ? item.products[third]?.amount ?? 0 : 0,
      totalQty: item.subtotal.quantity,
      totalAmt: item.subtotal.amount,
    };
  });

  return {
    columns: response.columns.map((column) => ({ ...column, label: challengeTierLabel(column.label) })),
    rows,
    summary: response.summary,
  };
}

export function mapFundedSalesReport(response: FundedSalesReportResponse): {
  rows: FundedRevenueRow[];
  summary: FundedRevenueSummary;
  traderPct: number;
  companyPct: number;
} {
  return {
    rows: response.items.map((item) => ({
      label: item.date,
      reqCount: item.request_count,
      reqAmt: item.request_amount,
      traderAmt: item.trader_amount,
      companyAmt: item.company_amount,
    })),
    summary: {
      reqCount: response.summary.request_count,
      reqAmt: response.summary.request_amount,
      traderAmt: response.summary.trader_amount,
      companyAmt: response.summary.company_amount,
    },
    traderPct: response.profit_split.trader_pct,
    companyPct: response.profit_split.company_pct,
  };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function weekMonday(dateStr: string): Date {
  const date = new Date(dateStr + "T00:00:00");
  const dayOfWeek = date.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  date.setDate(date.getDate() + diffToMonday);
  return date;
}

function weekLabel(dateStr: string): string {
  const monday = weekMonday(dateStr);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return `${isoDate(monday)} ~ ${isoDate(sunday)}`;
}

function getRevenuePeriodLabel(date: string, period: RevenuePeriod): string {
  if (period === "주별") return weekLabel(date);
  if (period === "월별") return date.slice(0, 7);
  return date.slice(0, 4);
}

function getRevenueSortKey(label: string, period: RevenuePeriod): string {
  if (period === "주별") return label.slice(0, 10);
  return label;
}

export function filterRevenueByDate<T extends { date: string }>(rows: T[], from: string, to: string): T[] {
  return rows.filter((row) => {
    if (from && row.date < from) return false;
    if (to && row.date > to) return false;
    return true;
  });
}

export function matchesRevenueUser(query: string): boolean {
  const normalizedQuery = query.toLowerCase().trim();
  return REVENUE_KNOWN_USERS.some((user) => user.includes(normalizedQuery));
}

export function aggregateChallengeRevenue(
  rows: ChallengeRevenueDailyRow[],
  period: RevenuePeriod,
): ChallengeRevenueRow[] {
  const map = new Map<string, ChallengeRevenueRow>();
  for (const row of rows) {
    const label = getRevenuePeriodLabel(row.date, period);
    const entry = map.get(label) ?? {
      label,
      products: {},
      starterQty: 0,
      starterAmt: 0,
      proQty: 0,
      proAmt: 0,
      eliteQty: 0,
      eliteAmt: 0,
      totalQty: 0,
      totalAmt: 0,
    };
    entry.starterQty += row.starterQty;
    entry.starterAmt += row.starterAmt;
    entry.proQty += row.proQty;
    entry.proAmt += row.proAmt;
    entry.eliteQty += row.eliteQty;
    entry.eliteAmt += row.eliteAmt;
    entry.totalQty += row.starterQty + row.proQty + row.eliteQty;
    entry.totalAmt += row.starterAmt + row.proAmt + row.eliteAmt;
    map.set(label, entry);
  }
  return Array.from(map.values()).sort((a, b) =>
    getRevenueSortKey(b.label, period).localeCompare(getRevenueSortKey(a.label, period)),
  );
}

export function aggregateFundedRevenue(
  rows: FundedRevenueDailyRow[],
  period: RevenuePeriod,
): FundedRevenueRow[] {
  const map = new Map<string, FundedRevenueRow>();
  for (const row of rows) {
    const label = getRevenuePeriodLabel(row.date, period);
    const entry = map.get(label) ?? { label, reqCount: 0, reqAmt: 0, traderAmt: 0, companyAmt: 0 };
    entry.reqCount += row.reqCount;
    entry.reqAmt += row.reqAmt;
    entry.traderAmt += row.traderAmt;
    entry.companyAmt += row.companyAmt;
    map.set(label, entry);
  }
  return Array.from(map.values()).sort((a, b) =>
    getRevenueSortKey(b.label, period).localeCompare(getRevenueSortKey(a.label, period)),
  );
}
