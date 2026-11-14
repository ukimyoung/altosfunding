import { useMutation, useQueryClient } from '@tanstack/react-query';
import { login, loginTwoFactor, logout } from '@/api/login';
import type { LoginRequest, TwoFactorLoginRequest } from '@/api/login';
import {
  register,
  sendVerificationEmail,
  verifyVerificationEmail,
  type RegisterRequest,
  type SendVerificationEmailRequest,
  type VerifyVerificationEmailRequest,
} from '@/api/signup';
import {
  forgotPassword,
  resetPassword,
  type ForgotPasswordRequest,
  type ResetPasswordRequest,
} from '@/api/password';
import { profileQueryKey } from './profile';

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

export function useSendVerificationEmailMutation() {
  return useMutation({
    mutationFn: (payload: SendVerificationEmailRequest) => sendVerificationEmail(payload),
  });
}

export function useVerifyVerificationEmailMutation() {
  return useMutation({
    mutationFn: (payload: VerifyVerificationEmailRequest) => verifyVerificationEmail(payload),
  });
}

export function useRegisterMutation() {
  return useMutation({
    mutationFn: (payload: RegisterRequest) => register(payload),
  });
}

export function useForgotPasswordMutation() {
  return useMutation({
    mutationFn: (payload: ForgotPasswordRequest) => forgotPassword(payload),
  });
}

export function useResetPasswordMutation() {
  return useMutation({
    mutationFn: (payload: ResetPasswordRequest) => resetPassword(payload),
  });
}
