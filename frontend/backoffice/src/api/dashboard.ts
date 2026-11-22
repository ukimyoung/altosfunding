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

export interface DashboardMembers {
  total_users: number;
  total_users_at_end: number;
  total_users_prev: number;
  total_change_pct: number | null;
  new_signups: number;
  new_signups_prev: number;
  new_signups_change_pct: number | null;
}

export interface DashboardAccounts {
  challenge_active: number;
  challenge_issued: number;
  challenge_issued_prev: number;
  challenge_issued_change_pct: number | null;
  funded_active: number;
  funded_issued: number;
  funded_issued_prev: number;
  funded_issued_change_pct: number | null;
  funded_halted: number;
}

export interface DashboardFunds {
  total_deposit_amount: number;
  total_withdraw_amount: number;
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
  members: DashboardMembers;
  accounts: DashboardAccounts;
  funds: DashboardFunds;
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

/** 상품 구분 없는 한 줄 추이 */
export interface DashboardSimpleSeries {
  labels: string[];
  totals: number[];
  sum: number;
}

export type DashboardTrendMetric = 'revenue' | 'accounts' | 'signups' | 'funds';

export interface DashboardTrendParams {
  metric: DashboardTrendMetric;
  period: DashboardTrendPeriod;
  start_date?: string | null;
  end_date?: string | null;
}

export interface DashboardTrends {
  metric: DashboardTrendMetric;
  period: DashboardTrendPeriod;
  start_date: string;
  end_date: string;
  revenue?: DashboardSeries;
  challenge?: DashboardSeries;
  funded?: DashboardSeries;
  signups?: DashboardSimpleSeries;
  deposit?: DashboardSimpleSeries;
  withdraw?: DashboardSimpleSeries;
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
