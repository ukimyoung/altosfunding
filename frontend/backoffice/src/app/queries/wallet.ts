import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveDepositRequest,
  approvePayoutRequest,
  approveWithdrawalRequest,
  getWalletRequestHistoryTotals,
  getWalletRequestsSummary,
  listPendingWalletRequests,
  listWalletRequestHistory,
  rejectDepositRequest,
  rejectPayoutRequest,
  rejectWithdrawalRequest,
} from '@/api/wallet';
import type {
  ListPendingWalletRequestsParams,
  ListWalletRequestHistoryParams,
  WalletRequestHistoryTotalsParams,
  WalletRequestsSummaryParams,
} from '@/api/wallet';

export const walletQueryKeys = {
  all: ['admin', 'wallet'] as const,
  listPendingWalletRequestsRoot: () =>
    [...walletQueryKeys.all, 'ListPendingWalletRequests'] as const,
  listPendingWalletRequests: (params: ListPendingWalletRequestsParams = {}) =>
    [...walletQueryKeys.listPendingWalletRequestsRoot(), params] as const,
  listWalletRequestHistoryRoot: () => [...walletQueryKeys.all, 'ListWalletRequestHistory'] as const,
  listWalletRequestHistory: (params: ListWalletRequestHistoryParams = {}) =>
    [...walletQueryKeys.listWalletRequestHistoryRoot(), params] as const,
  walletRequestHistoryTotalsRoot: () =>
    [...walletQueryKeys.all, 'WalletRequestHistoryTotals'] as const,
  walletRequestHistoryTotals: (params: WalletRequestHistoryTotalsParams = {}) =>
    [...walletQueryKeys.walletRequestHistoryTotalsRoot(), params] as const,
  walletRequestsSummaryRoot: () => [...walletQueryKeys.all, 'WalletRequestsSummary'] as const,
  walletRequestsSummary: (params: WalletRequestsSummaryParams = {}) =>
    [...walletQueryKeys.walletRequestsSummaryRoot(), params] as const,
};

export function useListPendingWalletRequestsQuery(
  params: ListPendingWalletRequestsParams = {},
  enabled = true,
) {
  return useQuery({
    queryKey: walletQueryKeys.listPendingWalletRequests(params),
    queryFn: () => listPendingWalletRequests(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useListWalletRequestHistoryQuery(
  params: ListWalletRequestHistoryParams = {},
  enabled = true,
) {
  return useQuery({
    queryKey: walletQueryKeys.listWalletRequestHistory(params),
    queryFn: () => listWalletRequestHistory(params),
    enabled,
  });
}

export function useWalletRequestHistoryTotalsQuery(
  params: WalletRequestHistoryTotalsParams = {},
) {
  return useQuery({
    queryKey: walletQueryKeys.walletRequestHistoryTotals(params),
    queryFn: () => getWalletRequestHistoryTotals(params),
    placeholderData: keepPreviousData,
  });
}

export function useWalletRequestsSummaryQuery(params: WalletRequestsSummaryParams = {}) {
  return useQuery({
    queryKey: walletQueryKeys.walletRequestsSummary(params),
    queryFn: () => getWalletRequestsSummary(params),
  });
}

const useWalletRequestActionMutation = <TVariables,>(
  mutationFn: (variables: TVariables) => Promise<void>,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: walletQueryKeys.listPendingWalletRequestsRoot() });
      queryClient.invalidateQueries({ queryKey: walletQueryKeys.listWalletRequestHistoryRoot() });
      queryClient.invalidateQueries({ queryKey: walletQueryKeys.walletRequestsSummaryRoot() });
      queryClient.invalidateQueries({ queryKey: walletQueryKeys.walletRequestHistoryTotalsRoot() });
    },
  });
};

export function useApproveDepositRequestMutation() {
  return useWalletRequestActionMutation((requestId: string | number) =>
    approveDepositRequest(requestId),
  );
}

export function useRejectDepositRequestMutation() {
  return useWalletRequestActionMutation(
    ({ requestId, reason }: { requestId: string | number; reason: string }) =>
      rejectDepositRequest(requestId, { reason }),
  );
}

export function useApproveWithdrawalRequestMutation() {
  return useWalletRequestActionMutation(
    ({ requestId, txHash }: { requestId: string | number; txHash: string }) =>
      approveWithdrawalRequest(requestId, { tx_hash: txHash }),
  );
}

export function useRejectWithdrawalRequestMutation() {
  return useWalletRequestActionMutation(
    ({ requestId, note }: { requestId: string | number; note: string }) =>
      rejectWithdrawalRequest(requestId, { note }),
  );
}

export function useApprovePayoutRequestMutation() {
  return useWalletRequestActionMutation((payoutId: string | number) =>
    approvePayoutRequest(payoutId),
  );
}

export function useRejectPayoutRequestMutation() {
  return useWalletRequestActionMutation(
    ({ payoutId, note }: { payoutId: string | number; note: string }) =>
      rejectPayoutRequest(payoutId, { note }),
  );
}
