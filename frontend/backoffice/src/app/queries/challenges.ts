import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getChallengeSummaryStats,
  listActiveChallengeDates,
  listChallengeGrouped,
  listDailyLeaderboard,
  notifyFailedByAccounts,
  promoteByAccounts,
} from '@/api/challenge';
import type {
  ChallengeGroupedParams,
  ChallengeSummaryStatsParams,
  DailyLeaderboardParams,
  PromoteByAccountsRequest,
} from '@/api/challenge';

export const challengeQueryKeys = {
  all: ['admin', 'challenges'] as const,
  activeDates: () => [...challengeQueryKeys.all, 'active-dates'] as const,
  grouped: (params: ChallengeGroupedParams) =>
    [...challengeQueryKeys.all, 'grouped', params] as const,
  dailyLeaderboard: (params: DailyLeaderboardParams) =>
    [...challengeQueryKeys.all, 'daily-leaderboard', params] as const,
  summaryStats: (params: ChallengeSummaryStatsParams) =>
    [...challengeQueryKeys.all, 'summary-stats', params] as const,
};

export function useActiveChallengeDatesQuery() {
  return useQuery({
    queryKey: challengeQueryKeys.activeDates(),
    queryFn: listActiveChallengeDates,
  });
}

export function useChallengeGroupedQuery(params: ChallengeGroupedParams) {
  return useQuery({
    queryKey: challengeQueryKeys.grouped(params),
    queryFn: () => listChallengeGrouped(params),
    placeholderData: keepPreviousData,
  });
}

export function useDailyLeaderboardQuery(params: DailyLeaderboardParams) {
  return useQuery({
    queryKey: challengeQueryKeys.dailyLeaderboard(params),
    queryFn: () => listDailyLeaderboard(params),
    placeholderData: keepPreviousData,
    enabled: Boolean(params.date),
  });
}

export function useChallengeSummaryStatsQuery(params: ChallengeSummaryStatsParams) {
  return useQuery({
    queryKey: challengeQueryKeys.summaryStats(params),
    queryFn: () => getChallengeSummaryStats(params),
    placeholderData: keepPreviousData,
    enabled: Boolean(params.target_date),
  });
}

export function usePromoteByAccountsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: PromoteByAccountsRequest) => promoteByAccounts(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: challengeQueryKeys.all });
    },
  });
}

export function useNotifyFailedByAccountsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: PromoteByAccountsRequest) => notifyFailedByAccounts(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: challengeQueryKeys.all });
    },
  });
}
