import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMe, updateProfile, withdrawAccount, type UpdateProfileRequest } from '@/api/user';

export const profileQueryKey = ['auth', 'me'] as const;

export function useMeQuery() {
  return useQuery({
    queryKey: profileQueryKey,
    queryFn: getMe,
    retry: false,
  });
}

export function useOptionalMeQuery() {
  return useQuery({
    queryKey: [...profileQueryKey, 'optional'],
    queryFn: () => getMe({ skipAuthRedirect: true }),
    retry: false,
  });
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateProfileRequest) => updateProfile(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileQueryKey });
    },
  });
}

export function useWithdrawAccountMutation() {
  return useMutation({
    mutationFn: withdrawAccount,
  });
}
