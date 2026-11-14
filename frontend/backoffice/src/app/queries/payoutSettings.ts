import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getProfitSplitSettings,
  listProfitSplitHistory,
  listNetworkFeeSettings,
  updateNetworkFeeSettings,
  updateProfitSplitSettings,
} from '@/api/payoutSettings';
import type {
  ListProfitSplitHistoryParams,
  NetworkFeeSettings,
  ProfitSplitSettings,
  UpdateNetworkFeeSettingsRequest,
  UpdateProfitSplitSettingsRequest,
} from '@/api/payoutSettings';

export const payoutSettingsQueryKeys = {
  all: ['admin', 'payout-settings'] as const,
  profitSplit: () => [...payoutSettingsQueryKeys.all, 'profit-split'] as const,
  profitSplitHistoryRoot: () => [...payoutSettingsQueryKeys.profitSplit(), 'history'] as const,
  profitSplitHistory: (params: ListProfitSplitHistoryParams = {}) =>
    [...payoutSettingsQueryKeys.profitSplitHistoryRoot(), params] as const,
  networkFees: () => [...payoutSettingsQueryKeys.all, 'network-fees'] as const,
};

export function useProfitSplitSettingsQuery() {
  return useQuery({
    queryKey: payoutSettingsQueryKeys.profitSplit(),
    queryFn: getProfitSplitSettings,
  });
}

export function useProfitSplitHistoryQuery(params: ListProfitSplitHistoryParams = {}) {
  return useQuery({
    queryKey: payoutSettingsQueryKeys.profitSplitHistory(params),
    queryFn: () => listProfitSplitHistory(params),
    placeholderData: keepPreviousData,
  });
}

export function useNetworkFeeSettingsQuery() {
  return useQuery({
    queryKey: payoutSettingsQueryKeys.networkFees(),
    queryFn: listNetworkFeeSettings,
  });
}

export function useUpdateProfitSplitSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateProfitSplitSettingsRequest) => updateProfitSplitSettings(payload),
    onSuccess: (data: ProfitSplitSettings) => {
      queryClient.setQueryData(payoutSettingsQueryKeys.profitSplit(), data);
      void queryClient.invalidateQueries({
        queryKey: payoutSettingsQueryKeys.profitSplitHistoryRoot(),
      });
    },
  });
}

export function useUpdateNetworkFeeSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateNetworkFeeSettingsRequest) => updateNetworkFeeSettings(payload),
    onSuccess: (data: NetworkFeeSettings[]) => {
      queryClient.setQueryData(payoutSettingsQueryKeys.networkFees(), data);
    },
  });
}
