import api from './axios';

// 백오피스 대시보드 (Core /admin/dashboard/*). 날짜 경계는 한국 시간(GMT+9).

export type DashboardRange = 'today' | 'yesterday' | 'this_week' | 'this_month';
export type DashboardTrendPeriod = 'daily' | 'weekly' | 'monthly';

export interface DashboardSystem {
  worker_alive: boolean;
  worker_last_seen_at: string | null;
  /** {"DEMO": "OK" | "실패 HTTP 500" | "미설정", "LIVE": ...}. 점검 전이면 빈 객체 */
  mt4: Record<string, string>;
  mt4_checked_at: string | null;
  failed_jobs: number;
  pending_jobs: number;
  provisioning_accounts: number;
}

export interface DashboardActions {
  withdraw_pending_count: number;
  withdraw_pending_amount: number;
  deposit_pending_count: number;
  contacts_unanswered: number;
  rewards_pending_count: number;
  kyc_pending: number;
  rule_violations_open: number;
}

export interface DashboardRevenueValue {
  amount: number | null;
  prev_amount: number | null;
  change_pct: number | null;
}

export interface DashboardRevenue {
  challenge: DashboardRevenueValue;
  funded: DashboardRevenueValue & { ready: boolean };
  total: DashboardRevenueValue;
}

export interface DashboardCompetition {
  challenge_id: string;
  name: string;
  product_id: string;
  product_name: string;
  participants: number;
  group_size: number | null;
  start_at: string;
  end_at: string;
}

export interface DashboardCompetitions {
  recruiting: DashboardCompetition[];
  active: DashboardCompetition[];
  recruiting_participants: number;
  active_participants: number;
  ended: { competitions: number; participants: number; passed: number; failed: number };
  pass_rate: { days: number; passed: number; failed: number; rate: number | null };
}

export interface DashboardSummary {
  range: DashboardRange;
  start_date: string;
  end_date: string;
  prev_start_date: string;
  prev_end_date: string;
  generated_at: string;
  system: DashboardSystem;
  actions: DashboardActions;
  revenue: DashboardRevenue;
  competitions: DashboardCompetitions;
}

export interface DashboardSeriesProduct {
  product_id: string;
  label: string;
  values: number[];
}

export interface DashboardSeries {
  labels: string[];
  products: DashboardSeriesProduct[];
  totals: number[];
  sum: number;
}

export interface DashboardTrendParams {
  metric: 'revenue' | 'accounts';
  period: DashboardTrendPeriod;
  start_date?: string | null;
  end_date?: string | null;
}

export interface DashboardTrends {
  metric: 'revenue' | 'accounts';
  period: DashboardTrendPeriod;
  start_date: string;
  end_date: string;
  revenue?: DashboardSeries;
  challenge?: DashboardSeries;
  funded?: DashboardSeries;
}

export async function getDashboardSummary(range: DashboardRange): Promise<DashboardSummary> {
  const { data } = await api.get<DashboardSummary>('/v1/admin/dashboard/summary', { params: { range } });
  return data;
}

export async function getDashboardTrends(params: DashboardTrendParams): Promise<DashboardTrends> {
  const { data } = await api.get<DashboardTrends>('/v1/admin/dashboard/trends', {
    params: {
      metric: params.metric,
      period: params.period,
      start_date: params.start_date || undefined,
      end_date: params.end_date || undefined,
    },
  });
  return data;
}
