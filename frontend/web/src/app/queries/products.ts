import { useQuery } from '@tanstack/react-query';
import { listProducts } from '@/api/products';

export const listProductsQueryKey = ['products', 'list'] as const;

export function useListProductsQuery() {
  return useQuery({
    queryKey: listProductsQueryKey,
    queryFn: listProducts,
  });
}
