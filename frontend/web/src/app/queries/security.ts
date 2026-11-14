import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  regenerateTwoFactorBackupCodes,
  disableTwoFactor,
  getLoginHistory,
  setupTwoFactor,
  updatePassword,
  updateWithdrawEmail,
  verifyTwoFactor,
  type TwoFactorBackupCodesRegenerateRequest,
  type TwoFactorDisableRequest,
  type TwoFactorVerifyRequest,
  type UpdatePasswordRequest,
  type UpdateWithdrawEmailRequest,
} from '@/api/user';
import { profileQueryKey } from './profile';

export const loginHistoryQueryKey = ['auth', 'login-history'] as const;

export function useUpdatePasswordMutation() {
  return useMutation({
    mutationFn: (payload: UpdatePasswordRequest) => updatePassword(payload),
  });
}

export function useTwoFactorSetupMutation() {
  return useMutation({
    mutationFn: setupTwoFactor,
  });
}

export function useTwoFactorVerifyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: TwoFactorVerifyRequest) => verifyTwoFactor(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileQueryKey });
    },
  });
}

export function useTwoFactorDisableMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: TwoFactorDisableRequest) => disableTwoFactor(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileQueryKey });
    },
  });
}

export function useTwoFactorBackupCodesRegenerateMutation() {
  return useMutation({
    mutationFn: (payload: TwoFactorBackupCodesRegenerateRequest) =>
      regenerateTwoFactorBackupCodes(payload),
  });
}

export function useUpdateWithdrawEmailMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateWithdrawEmailRequest) => updateWithdrawEmail(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileQueryKey });
    },
  });
}

export function useLoginHistoryQuery() {
  return useQuery({
    queryKey: loginHistoryQueryKey,
    queryFn: getLoginHistory,
    retry: false,
  });
}
