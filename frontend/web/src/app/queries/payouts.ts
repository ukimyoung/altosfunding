import { useQuery } from '@tanstack/react-query';
import {
  calculatePayout,
  listMyPayouts,
  type CalculatePayoutPayload,
  type ListMyPayoutsParams,
} from '@/api/payouts';

export const payoutsQueryKeys = {
  all: ['payouts'] as const,
  mine: (params: ListMyPayoutsParams) => [...payoutsQueryKeys.all, 'mine', params] as const,
  calculate: (payload: CalculatePayoutPayload) =>
    [...payoutsQueryKeys.all, 'calculate', payload] as const,
};

export function useMyPayoutsQuery(params: ListMyPayoutsParams) {
  return useQuery({
    queryKey: payoutsQueryKeys.mine(params),
    queryFn: () => listMyPayouts(params),
    retry: false,
  });
}

export function useCalculatePayoutQuery(payload: CalculatePayoutPayload, enabled: boolean) {
  return useQuery({
    queryKey: payoutsQueryKeys.calculate(payload),
    queryFn: () => calculatePayout(payload),
    enabled,
    retry: false,
  });
}

