import { useQuery } from '@tanstack/react-query';
import { listChallengeOffers, listProducts } from '@/api/products';

export const listProductsQueryKey = ['products', 'list'] as const;

export function useListProductsQuery() {
  return useQuery({
    queryKey: listProductsQueryKey,
    queryFn: listProducts,
  });
}

export const listChallengeOffersQueryKey = ['products', 'challenge-offers'] as const;

export function useListChallengeOffersQuery() {
  return useQuery({
    queryKey: listChallengeOffersQueryKey,
    queryFn: listChallengeOffers,
  });
}
