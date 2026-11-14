import { useMutation, useQueryClient } from '@tanstack/react-query';
import { login, loginTwoFactor, logout } from '@/api/login';
import type { LoginRequest, TwoFactorLoginRequest } from '@/api/login';

export const profileQueryKey = ['auth', 'me'] as const;

export function useLoginMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: LoginRequest) => login(payload),
    onSuccess: (data) => {
      if (data.access_token) {
        void queryClient.invalidateQueries({ queryKey: profileQueryKey });
      }
    },
  });
}

export function useTwoFactorLoginMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: TwoFactorLoginRequest) => loginTwoFactor(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileQueryKey });
    },
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSettled: () => {
      queryClient.removeQueries({ queryKey: profileQueryKey });
    },
  });
}
