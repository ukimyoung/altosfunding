export type RevenuePeriod = "주별" | "월별" | "연별";
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

export interface ChallengeRevenueDailyRow {
  date: string;
  starterQty: number;
  starterAmt: number;
  proQty: number;
  proAmt: number;
  eliteQty: number;
  eliteAmt: number;
}

export interface ChallengeRevenueRow {
  label: string;
  products: Record<string, { quantity: number; amount: number } | undefined>;
  starterQty: number;
  starterAmt: number;
  proQty: number;
  proAmt: number;
  eliteQty: number;
  eliteAmt: number;
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
