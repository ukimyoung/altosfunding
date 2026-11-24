import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  getAffiliateCommissions,
  getAffiliateMe,
  getAffiliateNetwork,
  type AffiliateCommissionParams,
} from '@/api/affiliate';

export const affiliateMeQueryKey = ['affiliate', 'me'] as const;
export const affiliateNetworkQueryKey = ['affiliate', 'network'] as const;
export const affiliateCommissionsQueryKey = ['affiliate', 'commissions'] as const;

export function useAffiliateMeQuery(enabled = true) {
  return useQuery({
    queryKey: affiliateMeQueryKey,
    queryFn: getAffiliateMe,
    enabled,
    retry: false,
    staleTime: 60 * 1000,
  });
}

export function useAffiliateNetworkQuery(enabled = true) {
  return useQuery({
    queryKey: affiliateNetworkQueryKey,
    queryFn: getAffiliateNetwork,
    enabled,
    retry: false,
  });
}

export function useAffiliateCommissionsQuery(params: AffiliateCommissionParams, enabled = true) {
  return useQuery({
    queryKey: [...affiliateCommissionsQueryKey, params] as const,
    queryFn: () => getAffiliateCommissions(params),
    enabled,
    retry: false,
    placeholderData: keepPreviousData,
  });
}
