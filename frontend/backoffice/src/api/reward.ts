import api from './axios';

export type RewardStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ReferralRewardCondition = 'FIRST_PURCHASE' | 'FUNDED_UPGRADE';

export interface RewardPolicy {
  referral_reward_condition: ReferralRewardCondition;
  referral_reward_amount: number | string;
  trading_bonus_rate: number | string;
}

export interface UpdateRewardPolicyRequest {
  referral_reward_condition?: ReferralRewardCondition;
  referral_reward_amount?: number;
  trading_bonus_rate?: number;
}

export interface RewardActionResponse {
  message: string;
}

export interface ListRewardParams {
  status?: RewardStatus | null;
  keyword?: string | null;
  page?: number;
  size?: number;
}

export interface AdminReferralReward {
  id: number;
  user_id: string;
  user_name?: string | null;
  user_email?: string | null;
  referral_code?: string | null;
  type: string;
  amount: number;
  currency: string;
  status: RewardStatus;
  source_user_id: string;
  source_user_name?: string | null;
  source_user_email?: string | null;
  description: string;
  approved_at: string | null;
  approved_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminTradingBonus {
  id: number;
  user_id: string;
  user_name?: string | null;
  user_email?: string | null;
  payout_request_id: number;
  mt4_login?: number | null;
  trader_profit?: number | null;
  profit_split_pct?: number | null;
  company_share: number;
  bonus_rate: number;
  bonus_amount: number;
  status: RewardStatus;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface ListRewardsResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface TradingBonusStats {
  total_accumulated: number;
  total_approved: number;
  total_pending: number;
  trading_bonus_rate: number;
}

export interface ReferralRewardStats {
  total_accumulated: number;
  total_approved: number;
  total_pending: number;
  active_referrals: number;
}

export interface RejectRewardRequest {
  rejection_reason: string;
}

export const getRewardPolicy = async (): Promise<RewardPolicy> => {
  const response = await api.get<RewardPolicy>('/v1/admin/rewards/policy');
  return response.data;
};

export const updateRewardPolicy = async (
  payload: UpdateRewardPolicyRequest,
): Promise<RewardActionResponse> => {
  const response = await api.put<RewardActionResponse>('/v1/admin/rewards/policy', payload);
  return response.data;
};

export const listReferralRewards = async (
  params: ListRewardParams = {},
): Promise<ListRewardsResponse<AdminReferralReward>> => {
  const page = params.page ?? 1;
  const size = params.size ?? 20;
  const response = await api.get<ListRewardsResponse<AdminReferralReward>>(
    '/v1/admin/rewards/referrals',
    {
      params: { ...params, page, size },
    },
  );
  return response.data;
};

export const approveReferralReward = async (rewardId: number): Promise<RewardActionResponse> => {
  const response = await api.post<RewardActionResponse>(
    `/v1/admin/rewards/referrals/${rewardId}/approve`,
  );
  return response.data;
};

export const rejectReferralReward = async (
  rewardId: number,
  payload: RejectRewardRequest,
): Promise<RewardActionResponse> => {
  const response = await api.post<RewardActionResponse>(
    `/v1/admin/rewards/referrals/${rewardId}/reject`,
    payload,
  );
  return response.data;
};

export const getReferralRewardStats = async (): Promise<ReferralRewardStats> => {
  const response = await api.get<ReferralRewardStats>('/v1/admin/rewards/referrals/stats');
  return response.data;
};

export const getTradingBonusStats = async (): Promise<TradingBonusStats> => {
  const response = await api.get<TradingBonusStats>('/v1/admin/rewards/trading-bonuses/stats');
  return response.data;
};

export const listTradingBonuses = async (
  params: ListRewardParams = {},
): Promise<ListRewardsResponse<AdminTradingBonus>> => {
  const page = params.page ?? 1;
  const size = params.size ?? 20;
  const response = await api.get<ListRewardsResponse<AdminTradingBonus>>(
    '/v1/admin/rewards/trading-bonuses',
    {
      params: { ...params, page, size },
    },
  );
  return response.data;
};

export const approveTradingBonus = async (bonusId: number): Promise<RewardActionResponse> => {
  const response = await api.post<RewardActionResponse>(
    `/v1/admin/rewards/trading-bonuses/${bonusId}/approve`,
  );
  return response.data;
};

export const rejectTradingBonus = async (
  bonusId: number,
  payload: RejectRewardRequest,
): Promise<RewardActionResponse> => {
  const response = await api.post<RewardActionResponse>(
    `/v1/admin/rewards/trading-bonuses/${bonusId}/reject`,
    payload,
  );
  return response.data;
};
