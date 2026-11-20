export type RevenuePeriod = "일별" | "주별" | "월별" | "연별";
export type RevenueSearchState = "idle" | "loading" | "no_period" | "not_found" | "no_data" | "error" | "results";

export interface RevenueThemeTokens {
  surface: string;
  surface2: string;
  surface3: string;
  border: string;
  border2: string;
  text: string;
  textSec: string;
  textHint: string;
  accent: string;
  accentBg: string;
  tfoot: string;
}

export interface ChallengeRevenueRow {
  label: string;
  /** 상품(product_id)별 수량·금액. 열은 Core 응답 columns 기준이라 Prime 등 티어 수에 제한이 없다. */
  products: Record<string, { quantity: number; amount: number } | undefined>;
  totalQty: number;
  totalAmt: number;
}

export interface ChallengeRevenueColumn {
  product_id: string;
  label: string;
  price_usdt: number;
}

export interface ChallengeRevenueSummary {
  quantity: number;
  amount: number;
  by_product: Record<string, { quantity: number; amount: number } | undefined>;
}

export interface FundedRevenueDailyRow {
  date: string;
  reqCount: number;
  reqAmt: number;
  traderAmt: number;
  companyAmt: number;
}

export interface FundedRevenueRow {
  label: string;
  reqCount: number;
  reqAmt: number;
  traderAmt: number;
  companyAmt: number;
}

export interface FundedRevenueSummary {
  reqCount: number;
  reqAmt: number;
  traderAmt: number;
  companyAmt: number;
}
