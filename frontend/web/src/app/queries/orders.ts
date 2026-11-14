import { useQuery } from '@tanstack/react-query';
import { ListUserOrders, type ListOrdersParams } from '@/api/orders';

export const ordersQueryKeys = {
  all: ['orders'] as const,
  list: (params: ListOrdersParams) => [...ordersQueryKeys.all, 'list', params] as const,
};

export function useOrdersQuery(params: ListOrdersParams) {
  return useQuery({
    queryKey: ordersQueryKeys.list(params),
    queryFn: () => ListUserOrders(params),
  });
}
