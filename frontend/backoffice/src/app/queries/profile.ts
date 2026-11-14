import { useQuery } from '@tanstack/react-query';
import { getMe } from '@/api/user';

export const profileQueryKey = ['auth', 'me'] as const;

export function useMeQuery() {
  return useQuery({
    queryKey: profileQueryKey,
    queryFn: getMe,
    retry: false,
  });
}
