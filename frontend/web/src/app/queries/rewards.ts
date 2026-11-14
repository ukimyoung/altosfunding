import { useQuery } from '@tanstack/react-query';
import {
  GetMyRewards,
  getReferralCode,
  getReferralStats,
  getReferrals,
  type ListMyRewardsParams,
  type ListReferralsParams,
} from '@/api/rewards';

export const referralCodeQueryKey = ['rewards', 'referral-code'] as const;
export const referralStatsQueryKey = ['rewards', 'referrals', 'stats'] as const;
export const referralsQueryKey = ['rewards', 'referrals'] as const;
export const myRewardsQueryKey = ['rewards', 'mine'] as const;

export function useReferralCodeQuery() {
  return useQuery({
    queryKey: referralCodeQueryKey,
    queryFn: getReferralCode,
    retry: false,
    staleTime: 10 * 60 * 1000,
  });
}

export function useMyRewardsQuery(params?: ListMyRewardsParams) {
  return useQuery({
    queryKey: [...myRewardsQueryKey, params] as const,
    queryFn: () => GetMyRewards(params),
    retry: false,
  });
}

export function useReferralStatsQuery() {
  return useQuery({
    queryKey: referralStatsQueryKey,
    queryFn: getReferralStats,
    retry: false,
  });
}

export function useReferralsQuery(params?: ListReferralsParams) {
  return useQuery({
    queryKey: [...referralsQueryKey, params] as const,
    queryFn: () => getReferrals(params),
    retry: false,
  });
}
