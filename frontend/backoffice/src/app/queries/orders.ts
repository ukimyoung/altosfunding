import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getChallengeOrdersSummary, listChallengeOrders } from '@/api/order';
import type { ListChallengeOrdersParams } from '@/api/order';

export const ordersQueryKeys = {
  all: ['admin', 'orders'] as const,
  challengeOrders: (params: ListChallengeOrdersParams) =>
    [...ordersQueryKeys.all, 'challenge-orders', params] as const,
  challengeOrdersSummary: () => [...ordersQueryKeys.all, 'challenge-orders-summary'] as const,
};

export function useListChallengeOrdersQuery(params: ListChallengeOrdersParams = {}) {
  return useQuery({
    queryKey: ordersQueryKeys.challengeOrders(params),
    queryFn: () => listChallengeOrders(params),
    placeholderData: keepPreviousData,
  });
}

export function useChallengeOrdersSummaryQuery() {
  return useQuery({
    queryKey: ordersQueryKeys.challengeOrdersSummary(),
    queryFn: getChallengeOrdersSummary,
  });
}
