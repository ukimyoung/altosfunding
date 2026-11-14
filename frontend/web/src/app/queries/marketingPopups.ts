import { useQuery } from '@tanstack/react-query';
import {
  getActiveMarketingPopups,
  type MarketingPopupLocation,
} from '@/api/marketingPopups';

export const marketingPopupsQueryKey = ['marketing-popups', 'active'] as const;

export function useActiveMarketingPopupsQuery(location: MarketingPopupLocation) {
  return useQuery({
    queryKey: [...marketingPopupsQueryKey, location] as const,
    queryFn: () => getActiveMarketingPopups(location),
    retry: false,
  });
}
