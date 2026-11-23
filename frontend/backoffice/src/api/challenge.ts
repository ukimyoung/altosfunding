import api from './axios';

export interface ChallengeGroupedTier {
  challenge_id: string;
  product_id: string;
  product_name: string;
  capital: number;
  participants: number;
  group_size: number | null;
}

export interface ChallengeGroupedItem {
  start_at: string;
  end_at: string;
  status: string;
  participants: Record<string, number>;
  /** 같은 기간에 묶인 상품별 회차 (자본금 순) */
  tiers?: ChallengeGroupedTier[];
}

export interface ChallengeGroupedParams {
  status?: string | null;
  date?: string | null;
  /** 시작일 범위 (한국 시간, YYYY-MM-DD) */
  date_from?: string | null;
  date_to?: string | null;
  page?: number;
  size?: number;
}

export interface ChallengeGroupedResponse {
  items: ChallengeGroupedItem[];
  total?: number;
  page?: number;
  size?: number;
  pages?: number;
}

export interface DailyLeaderboardEntry {
  account_id: string;
  mt4_login: number;
  user_id: string;
  email: string;
  user_grade: string;
  nickname: string;
  product_name: string;
  capital: number;
  equity: number;
  balance: number;
  profit: number;
  profit_rate: number;
  account_status: string;
  participant_status: string;
  /** 수익률 계산에 쓴 잔고 시각 (없으면 자본금 기준) */
  snapshot_ts: string | null;
  /** END: 대회 종료 시각 기준, LATEST: 진행 중이라 최근 값 기준 */
  basis?: 'END' | 'LATEST';
  /** '확인하기' 마지막 판정 (판정 전이면 null) */
  evaluation_id?: number | null;
  evaluation_result?: 'PASSED' | 'FAILED' | null;
  evaluated_at?: string | null;
  /** 마지막 판정이 통과면 true */
  is_passed: boolean;
  rank: number;
  /** 펀디드 계좌: 상품의 발급 방법과 이 계좌로 만든 펀디드 계좌 (없으면 null) */
  funded_issue_method?: 'AUTO' | 'MANUAL';
  funded_account_id?: string | null;
  funded_mt4_login?: number | null;
  funded_provision_status?: string | null;
  funded_start_at?: string | null;
}

export interface DailyLeaderboardParams {
  date: string;
  product_id?: string | number | null;
  grade?: string | null;
}

export interface DailyLeaderboardResponse {
  date: string;
  product_id: string | number | null;
  grade: string | null;
  total: number;
  entries: DailyLeaderboardEntry[];
}

export interface ChallengeSummaryStatsParams {
  target_date: string;
}

export interface ChallengeSummaryChallenge {
  id: string;
  name: string;
  status: string;
  start_at?: string;
  end_at?: string;
  /** 수익률 기준 시각 (대회 종료 시각, 관리자가 먼저 종료했으면 그 시각) */
  cutoff_at?: string;
}

export interface ChallengeSummaryStats {
  total_active_participants: number;
  passed_count: number;
  failed_count: number;
  withdrawn_count: number;
  vip_count: number;
}

export interface ChallengeSummaryStatsResponse {
  target_date: string;
  challenges: ChallengeSummaryChallenge[];
  stats: ChallengeSummaryStats;
}

export interface PromoteByAccountsRequest {
  account_ids: string[];
  note: string;
}

export const listActiveChallengeDates = async (): Promise<string[]> => {
  const response = await api.get<string[]>('/v1/admin/challenges/active-dates');
  return response.data;
};

/** Leaderboard 날짜 목록: 대회 종료일 (한국 시간 YYYYMMDD, 최근 순) */
export const listLeaderboardEndDates = async (): Promise<string[]> => {
  const response = await api.get<string[]>('/v1/admin/challenges/leaderboard/end-dates');
  return response.data;
};

export const listChallengeGrouped = async (
  params: ChallengeGroupedParams = {},
): Promise<ChallengeGroupedResponse> => {
  const page = params.page ?? 1;
  const size = params.size ?? 20;
  const response = await api.get<ChallengeGroupedResponse>('/v1/admin/challenges/grouped', {
    params: {
      ...params,
      page,
      size,
    },
  });
  return response.data;
};

export interface ChallengeEvaluationCheck {
  key: string;
  label: string;
  passed: boolean;
  detail: string | null;
}

/** Leaderboard '확인하기' 판정 결과 */
export interface ChallengeEvaluation {
  id: number;
  account_id: string;
  challenge_id: string;
  ruleset_id: string | null;
  /** 룰셋 이름 (룰셋이 삭제되었으면 null) */
  ruleset_name?: string | null;
  result: 'PASSED' | 'FAILED';
  period_start: string;
  period_end: string;
  capital: number;
  equity: number;
  profit: number;
  profit_rate: number;
  trades_count: number;
  open_positions: number;
  /** 적용한 룰 수 (0이면 룰셋 판정 로직 미적용) */
  rules_applied: number;
  checks: ChallengeEvaluationCheck[];
  evaluated_by: string | null;
  created_at: string;
}

export const evaluateLeaderboardAccount = async (accountId: string): Promise<ChallengeEvaluation> => {
  const response = await api.post<ChallengeEvaluation>(
    `/v1/admin/challenges/leaderboard/accounts/${accountId}/evaluate`,
  );
  return response.data;
};

export const listDailyLeaderboard = async (
  params: DailyLeaderboardParams,
): Promise<DailyLeaderboardResponse> => {
  const response = await api.get<DailyLeaderboardResponse>('/v1/admin/challenges/leaderboard/daily', {
    params,
  });
  return response.data;
};

export const getChallengeSummaryStats = async (
  params: ChallengeSummaryStatsParams,
): Promise<ChallengeSummaryStatsResponse> => {
  const response = await api.get<ChallengeSummaryStatsResponse>('/v1/admin/challenges/summary-stats', {
    params,
  });
  return response.data;
};

export const promoteByAccounts = async (payload: PromoteByAccountsRequest): Promise<void> => {
  const response = await api.post('/v1/admin/challenges/promote-by-accounts', payload);
  return response.data;
};

export const notifyFailedByAccounts = async (payload: PromoteByAccountsRequest): Promise<void> => {
  const response = await api.post('/v1/admin/challenges/notify-failed', payload);
  return response.data;
};
