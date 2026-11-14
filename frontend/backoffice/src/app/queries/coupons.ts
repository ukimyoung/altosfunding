import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createCoupon, deleteCoupon, getCoupon, getCouponStats, listCoupons, listCouponUsages, updateCoupon } from '@/api/coupon';
import type { CreateCouponRequest, ListCouponsParams, ListCouponUsagesParams, UpdateCouponRequest } from '@/api/coupon';

export const couponQueryKeys = {
  all: ['admin', 'coupons'] as const,
  list: (params: ListCouponsParams) => [...couponQueryKeys.all, 'list', params] as const,
  detail: (couponId: number) => [...couponQueryKeys.all, couponId, 'detail'] as const,
  stats: () => [...couponQueryKeys.all, 'stats'] as const,
  usages: (couponId: number, params: ListCouponUsagesParams) =>
    [...couponQueryKeys.all, couponId, 'usages', params] as const,
};

export function useCouponsQuery(params: ListCouponsParams) {
  return useQuery({
    queryKey: couponQueryKeys.list(params),
    queryFn: () => listCoupons(params),
    placeholderData: keepPreviousData,
  });
}

export function useCouponDetailQuery(couponId: number | null) {
  return useQuery({
    queryKey: couponQueryKeys.detail(couponId ?? 0),
    queryFn: () => getCoupon(couponId as number),
    enabled: couponId != null,
  });
}

export function useCreateCouponMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateCouponRequest) => createCoupon(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: couponQueryKeys.all });
    },
  });
}

export function useUpdateCouponMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ couponId, payload }: { couponId: number; payload: UpdateCouponRequest }) =>
      updateCoupon(couponId, payload),
    onSuccess: (updatedCoupon, { couponId }) => {
      queryClient.setQueryData(couponQueryKeys.detail(couponId), updatedCoupon);
      void queryClient.invalidateQueries({ queryKey: couponQueryKeys.all });
    },
  });
}

export function useDeleteCouponMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (couponId: number) => deleteCoupon(couponId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: couponQueryKeys.all });
    },
  });
}

export function useCouponStatsQuery() {
  return useQuery({
    queryKey: couponQueryKeys.stats(),
    queryFn: getCouponStats,
  });
}

export function useCouponUsagesQuery(
  couponId: number,
  params: ListCouponUsagesParams,
) {
  return useQuery({
    queryKey: couponQueryKeys.usages(couponId, params),
    queryFn: () => listCouponUsages(couponId, params),
    enabled: Number.isFinite(couponId),
    placeholderData: keepPreviousData,
  });
}
