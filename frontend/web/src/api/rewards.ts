import api from './axios';

export interface ReferralCodeResponse {
  referral_code: string;
  referral_link: string;
}

export interface ReferralStatsResponse {
  total_invited: number;
  pending_referrals: number;
  total_earned: number;
  referral_link: string;
  referral_code: string;
  /** 백오피스 '리워드 정책 설정'의 추천인 리워드 지급액 (USD). 기존 서버 응답에는 없다. */
  referral_reward_amount?: number;
  /** 추천인 리워드 지급 조건. 기존 서버 응답에는 없다. */
  referral_reward_condition?: ReferralRewardCondition;
}

export type ReferralRewardCondition = 'FIRST_PURCHASE' | 'FUNDED_UPGRADE';

export type ReferralStatus = 'Active' | 'Pending';

export interface ReferralItem {
  id: string;
  name: string;
  email: string;
  register_date: string;
  total_challenge_count: number;
  status: ReferralStatus;
}

export interface ReferralListResponse {
  items: ReferralItem[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface ListReferralsParams {
  page?: number;
  size?: number;
}

export interface MyReward {
  id: number;
  type: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
  created_at: string;
  credited_at: string | null;
  rejection_reason?: string | null;
  /** 추천인 리워드면 피추천인(구매자) 이메일. 기존 서버 응답에는 없다. */
  source_user_email?: string | null;
}

export type GetMyRewardsResponse =
  | MyReward[]
  | {
      items?: MyReward[];
      data?: MyReward[];
      [key: string]: unknown;
    };

export interface ListMyRewardsParams {
  type?: 'TRADING_BONUS' | 'REFERRAL_BONUS' | 'AFFILIATE_COMMISSION';
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  page?: number;
  size?: number;
}

export const getReferralCode = async () => {
  const response = await api.get<ReferralCodeResponse>('/v1/rewards/referral-code');
  return response.data;
};

export const getReferralStats = async () => {
  const response = await api.get<ReferralStatsResponse>('/v1/rewards/referrals/stats');
  return response.data;
};

export const getReferrals = async (params?: ListReferralsParams) => {
  const response = await api.get<ReferralListResponse>('/v1/rewards/referrals', {
    params: {
      page: 1,
      size: 20,
      ...params,
    },
  });

  return response.data;
};

export const GetMyRewards = async (params?: ListMyRewardsParams) => {
  const response = await api.get<GetMyRewardsResponse>('/v1/rewards/mine', {
    params: {
      page: 1,
      size: 20,
      ...params,
    },
  });

  if (Array.isArray(response.data)) {
    return response.data;
  }

  return response.data.items ?? response.data.data ?? [];
};
