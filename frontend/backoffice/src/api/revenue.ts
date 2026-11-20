import api from './axios';

export type SalesReportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface SalesReportParams {
  period: SalesReportPeriod;
  start_date?: string | null;
  end_date?: string | null;
  keyword?: string | null;
}

export interface ChallengeSalesColumn {
  product_id: string;
  label: string;
  price_usdt: number;
}

export interface SalesProductTotal {
  quantity: number;
  amount: number;
}

export interface ChallengeSalesItem {
  date: string;
  products: Record<string, SalesProductTotal | undefined>;
  subtotal: SalesProductTotal;
}

export interface ChallengeSalesSummary extends SalesProductTotal {
  by_product: Record<string, SalesProductTotal | undefined>;
}

export interface ChallengeSalesReportResponse {
  period: SalesReportPeriod;
  columns: ChallengeSalesColumn[];
  items: ChallengeSalesItem[];
  total: number;
  page: number;
  size: number;
  pages: number;
  summary: ChallengeSalesSummary;
}

export interface FundedSalesProfitSplit {
  trader_pct: number;
  company_pct: number;
}

export interface FundedSalesItem {
  date: string;
  request_count: number;
  request_amount: number;
  trader_amount: number;
  company_amount: number;
}

export interface FundedSalesSummary {
  request_count: number;
  request_amount: number;
  trader_amount: number;
  company_amount: number;
}

export interface FundedSalesReportResponse {
  period: SalesReportPeriod;
  profit_split: FundedSalesProfitSplit;
  items: FundedSalesItem[];
  total: number;
  page: number;
  size: number;
  pages: number;
  summary: FundedSalesSummary;
}

export const getChallengeSalesReport = async (
  params: SalesReportParams,
): Promise<ChallengeSalesReportResponse> => {
  const response = await api.get<ChallengeSalesReportResponse>('/v1/admin/reports/sales/challenge', {
    params,
  });
  return response.data;
};

export const getFundedSalesReport = async (
  params: SalesReportParams,
): Promise<FundedSalesReportResponse> => {
  const response = await api.get<FundedSalesReportResponse>('/v1/admin/reports/sales/funded', {
    params,
  });
  return response.data;
};
