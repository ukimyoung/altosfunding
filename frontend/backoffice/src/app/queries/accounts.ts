import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  banAccount,
  freezeAccount,
  getAccountDetail,
  getAccountEvaluation,
  getAccountStats,
  issueFundedAccount,
  listAccountTrades,
  listAccounts,
  unfreezeAccount,
} from '@/api/account';
import type {
  AccountTier,
  BanAccountRequest,
  ListAccountsParams,
  ListAccountTradesParams,
} from '@/api/account';
import { violationQueryKeys } from './violations';
import { challengeQueryKeys } from './challenges';

export const accountsQueryKeys = {
  all: ['admin', 'accounts'] as const,
  listAccounts: (params: ListAccountsParams) =>
    [...accountsQueryKeys.all, 'ListAccounts', params] as const,
  listTierAccounts: (tier: AccountTier, params: Omit<ListAccountsParams, 'tier' | 'user_id'>) =>
    [...accountsQueryKeys.all, 'ListTierAccounts', tier, params] as const,
  getAccountStats: (tier: AccountTier) =>
    [...accountsQueryKeys.all, 'GetAccountStats', tier] as const,
  listUserAccounts: (userId: string, params: Omit<ListAccountsParams, 'user_id'>) =>
    [...accountsQueryKeys.all, 'ListUserAccounts', userId, params] as const,
  getAccountDetail: (accountId: string) =>
    [...accountsQueryKeys.all, 'GetAccountDetail', accountId] as const,
  getAccountEvaluation: (accountId: string) =>
    [...accountsQueryKeys.all, 'GetAccountEvaluation', accountId] as const,
  listAccountTrades: (accountId: string, params: ListAccountTradesParams) =>
    [...accountsQueryKeys.all, 'ListAccountTrades', accountId, params] as const,
};

export function useListAccountsQuery(params: ListAccountsParams, enabled = true) {
  return useQuery({
    queryKey: accountsQueryKeys.listAccounts(params),
    queryFn: () => listAccounts(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

// 챌린지/펀디드 계좌 관리 페이지처럼 "전체 유저의 계좌 목록"을 볼 때 사용
// tier(CHALLENGE/FUNDED)로 계좌 종류를 구분한다.
// params에서 tier/user_id를 Omit한 이유는 호출부에서 user_id와 tier를 섞어 보내는 실수를 막기 위함.
export function useListTierAccountsQuery(
  tier: AccountTier,
  params: Omit<ListAccountsParams, 'tier' | 'user_id'>,
  enabled = true,
) {
  return useQuery({
    queryKey: accountsQueryKeys.listTierAccounts(tier, params),
    queryFn: () => listAccounts({ ...params, tier }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

// 회원 상세 페이지처럼 "특정 유저의 계좌 목록"을 볼 때 사용
// user_id로 대상 유저를 구분한다.
// params에서 user_id를 Omit한 이유는 호출부에서 대상 유저 조건을 직접 덮어쓰는 실수를 막기 위함.
export function useAccountStatsQuery(tier: AccountTier, enabled = true) {
  return useQuery({
    queryKey: accountsQueryKeys.getAccountStats(tier),
    queryFn: () => getAccountStats(tier),
    enabled,
  });
}

export function useListUserAccountsQuery(
  userId?: string | null,
  params: Omit<ListAccountsParams, 'user_id'> = {},
  enabled = true,
) {
  const resolvedUserId = userId ?? '';

  return useQuery({
    queryKey: accountsQueryKeys.listUserAccounts(resolvedUserId, params),
    queryFn: () => listAccounts({ ...params, user_id: resolvedUserId }),
    placeholderData: keepPreviousData,
    enabled: enabled && Boolean(resolvedUserId),
  });
}

export function useGetAccountDetailQuery(accountId?: string | null) {
  const resolvedAccountId = accountId ?? '';

  return useQuery({
    queryKey: accountsQueryKeys.getAccountDetail(resolvedAccountId),
    queryFn: () => getAccountDetail(resolvedAccountId),
    enabled: Boolean(resolvedAccountId),
  });
}

// 챌린지 결과: 대회가 끝나고 판정이 난 뒤에만 값이 온다 (그 전이면 null)
export function useGetAccountEvaluationQuery(accountId?: string | null) {
  const resolvedAccountId = accountId ?? '';

  return useQuery({
    queryKey: accountsQueryKeys.getAccountEvaluation(resolvedAccountId),
    queryFn: () => getAccountEvaluation(resolvedAccountId),
    enabled: Boolean(resolvedAccountId),
  });
}

export function useListAccountTradesQuery(
  accountId: string | null | undefined,
  params: ListAccountTradesParams = {},
) {
  const resolvedAccountId = accountId ?? '';

  return useQuery({
    queryKey: accountsQueryKeys.listAccountTrades(resolvedAccountId, params),
    queryFn: () => listAccountTrades(resolvedAccountId, params),
    placeholderData: keepPreviousData,
    enabled: Boolean(resolvedAccountId),
  });
}

const useAccountStatusMutation = (mutationFn: (accountId: string) => Promise<void>) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountsQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: violationQueryKeys.all });
    },
  });
};

export function useUnfreezeAccountMutation() {
  return useAccountStatusMutation(unfreezeAccount);
}

export function useFreezeAccountMutation() {
  return useAccountStatusMutation(freezeAccount);
}

export function useIssueFundedAccountMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (accountId: string) => issueFundedAccount(accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountsQueryKeys.all });
      // Leaderboard '펀디드계좌' 열
      queryClient.invalidateQueries({ queryKey: challengeQueryKeys.all });
    },
  });
}

export function useBanAccountMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ accountId, payload }: { accountId: string; payload: BanAccountRequest }) =>
      banAccount(accountId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountsQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: violationQueryKeys.all });
    },
  });
}
