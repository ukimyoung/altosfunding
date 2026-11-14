import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { listViolationAccounts } from '@/api/violation';
import type { ListViolationAccountsParams } from '@/api/violation';

export const violationQueryKeys = {
  all: ['admin', 'violations'] as const,
  list: (params: ListViolationAccountsParams) =>
    [...violationQueryKeys.all, 'list', params] as const,
};

export function useListViolationAccountsQuery(params: ListViolationAccountsParams) {
  return useQuery({
    queryKey: violationQueryKeys.list(params),
    queryFn: () => listViolationAccounts(params),
    placeholderData: keepPreviousData,
  });
}
