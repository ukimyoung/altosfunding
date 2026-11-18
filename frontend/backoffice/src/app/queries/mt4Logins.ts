import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addMt4Blacklist,
  listMt4LoginPools,
  listMt4Logins,
  releaseMt4Blacklist,
} from '@/api/mt4Login';
import type { BlacklistInput, Mt4LoginListParams, Mt4Server } from '@/api/mt4Login';

export const mt4LoginQueryKeys = {
  all: ['admin', 'mt4-logins'] as const,
  list: (params: Mt4LoginListParams) => [...mt4LoginQueryKeys.all, 'list', params] as const,
  pools: (server: Mt4Server) => [...mt4LoginQueryKeys.all, 'pools', server] as const,
};

export function useMt4LoginsQuery(params: Mt4LoginListParams) {
  return useQuery({
    queryKey: mt4LoginQueryKeys.list(params),
    queryFn: () => listMt4Logins(params),
    placeholderData: keepPreviousData,
  });
}

export function useMt4LoginPoolsQuery(server: Mt4Server) {
  return useQuery({
    queryKey: mt4LoginQueryKeys.pools(server),
    queryFn: () => listMt4LoginPools(server),
  });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: mt4LoginQueryKeys.all });
}

export function useAddMt4BlacklistMutation() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (payload: BlacklistInput) => addMt4Blacklist(payload),
    onSuccess: invalidate,
  });
}

export function useReleaseMt4BlacklistMutation() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ server, login }: { server: Mt4Server; login: number }) => releaseMt4Blacklist(server, login),
    onSuccess: invalidate,
  });
}
