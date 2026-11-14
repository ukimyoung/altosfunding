import { useQuery } from '@tanstack/react-query';
import { GetAssetSummary, getMyAsset } from '@/api/assets';

export const assetSummaryQueryKey = ['assets', 'summary'] as const;
export const myAssetQueryKey = ['assets', 'my-asset'] as const;

export function useAssetSummaryQuery() {
  return useQuery({
    queryKey: assetSummaryQueryKey,
    queryFn: GetAssetSummary,
    retry: false,
  });
}

export function useMyAssetQuery() {
  return useQuery({
    queryKey: myAssetQueryKey,
    queryFn: getMyAsset,
    retry: false,
  });
}
