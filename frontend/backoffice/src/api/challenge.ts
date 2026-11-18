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
  snapshot_ts: string;
  is_passed: boolean;
  rank: number;
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
