import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveReferralReward,
  approveTradingBonus,
  getReferralRewardStats,
  getRewardPolicy,
  getTradingBonusStats,
  listReferralRewards,
  listTradingBonuses,
  rejectReferralReward,
  rejectTradingBonus,
  updateRewardPolicy,
} from '@/api/reward';
import type {
  ListRewardParams,
  RejectRewardRequest,
  UpdateRewardPolicyRequest,
} from '@/api/reward';

export const rewardQueryKeys = {
  all: ['admin', 'rewards'] as const,
  policy: () => [...rewardQueryKeys.all, 'policy'] as const,
  referrals: (params: ListRewardParams) => [...rewardQueryKeys.all, 'referrals', params] as const,
  referralStats: () => [...rewardQueryKeys.all, 'referrals', 'stats'] as const,
  tradingBonuses: (params: ListRewardParams) =>
    [...rewardQueryKeys.all, 'trading-bonuses', params] as const,
  tradingBonusStats: () => [...rewardQueryKeys.all, 'trading-bonuses', 'stats'] as const,
};

export function useRewardPolicyQuery() {
  return useQuery({
    queryKey: rewardQueryKeys.policy(),
    queryFn: getRewardPolicy,
  });
}

export function useUpdateRewardPolicyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateRewardPolicyRequest) => updateRewardPolicy(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rewardQueryKeys.policy() });
      queryClient.invalidateQueries({ queryKey: rewardQueryKeys.tradingBonusStats() });
    },
  });
}

export function useReferralRewardsQuery(params: ListRewardParams) {
  return useQuery({
    queryKey: rewardQueryKeys.referrals(params),
    queryFn: () => listReferralRewards(params),
    placeholderData: keepPreviousData,
  });
}

export function useReferralRewardStatsQuery() {
  return useQuery({
    queryKey: rewardQueryKeys.referralStats(),
    queryFn: getReferralRewardStats,
  });
}

export function useTradingBonusStatsQuery() {
  return useQuery({
    queryKey: rewardQueryKeys.tradingBonusStats(),
    queryFn: getTradingBonusStats,
  });
}

export function useTradingBonusesQuery(params: ListRewardParams) {
  return useQuery({
    queryKey: rewardQueryKeys.tradingBonuses(params),
    queryFn: () => listTradingBonuses(params),
    placeholderData: keepPreviousData,
  });
}

export function useApproveReferralRewardMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (rewardId: number) => approveReferralReward(rewardId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rewardQueryKeys.all });
    },
  });
}

export function useRejectReferralRewardMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ rewardId, payload }: { rewardId: number; payload: RejectRewardRequest }) =>
      rejectReferralReward(rewardId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rewardQueryKeys.all });
    },
  });
}

export function useApproveTradingBonusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (bonusId: number) => approveTradingBonus(bonusId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rewardQueryKeys.all });
    },
  });
}

export function useRejectTradingBonusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ bonusId, payload }: { bonusId: number; payload: RejectRewardRequest }) =>
      rejectTradingBonus(bonusId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rewardQueryKeys.all });
    },
  });
}
