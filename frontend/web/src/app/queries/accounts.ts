import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  GetChallengeSummary,
  GetFundedSummary,
  getAccountDetail,
  getAccountTradeHistory,
  listAccounts,
  updateAccountPassword,
  type ListAccountsParams,
  type UpdateAccountPasswordRequest,
} from '@/api/accounts';

export const accountsQueryKeys = {
  all: ['accounts'] as const,
  challengeSummary: () => [...accountsQueryKeys.all, 'challenge-summary'] as const,
  fundedSummary: () => [...accountsQueryKeys.all, 'funded-summary'] as const,
  list: (params: ListAccountsParams) => [...accountsQueryKeys.all, 'list', params] as const,
  detail: (accountId: string) => [...accountsQueryKeys.all, 'detail', accountId] as const,
  tradeHistory: (accountId: string) =>
    [...accountsQueryKeys.all, 'trade-history', accountId] as const,
};

export function useChallengeSummaryQuery() {
  return useQuery({
    queryKey: accountsQueryKeys.challengeSummary(),
    queryFn: GetChallengeSummary,
  });
}

export function useFundedSummaryQuery() {
  return useQuery({
    queryKey: accountsQueryKeys.fundedSummary(),
    queryFn: GetFundedSummary,
  });
}

export function useAccountsQuery(params: ListAccountsParams) {
  return useQuery({
    queryKey: accountsQueryKeys.list(params),
    queryFn: () => listAccounts(params),
    // 발급 중(QUEUED)인 계좌가 있으면 3초마다 다시 불러 발급 완료(번호·비밀번호)를 보여 준다.
    refetchInterval: (query) =>
      query.state.data?.items.some((item) => item.provision_status === 'QUEUED') ? 3000 : false,
  });
}

export function useAccountDetailQuery(accountId: string, enabled: boolean) {
  return useQuery({
    queryKey: accountsQueryKeys.detail(accountId),
    queryFn: () => getAccountDetail(accountId),
    enabled: enabled && accountId.length > 0,
  });
}

export function useAccountTradeHistoryQuery(accountId: string, enabled: boolean) {
  return useQuery({
    queryKey: accountsQueryKeys.tradeHistory(accountId),
    queryFn: () => getAccountTradeHistory(accountId),
    enabled: enabled && accountId.length > 0,
  });
}

export function useUpdateAccountPasswordMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      accountId,
      payload,
    }: {
      accountId: string;
      payload: UpdateAccountPasswordRequest;
    }) => updateAccountPassword(accountId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accountsQueryKeys.all });
    },
  });
}
