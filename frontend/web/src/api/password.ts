import api from './axios';

export interface ForgotPasswordRequest {
  email: string;
  recaptcha_token: string;
}

export interface PasswordResetResponse {
  ok: boolean;
  message_key: string;
}

export interface ResetPasswordRequest {
  token: string;
  new_password: string;
}

export const forgotPassword = async (payload: ForgotPasswordRequest) => {
  const response = await api.post<PasswordResetResponse>('/v1/auth/password/forgot', payload);

  return response.data;
};

export const resetPassword = async (payload: ResetPasswordRequest) => {
  const response = await api.post<PasswordResetResponse>('/v1/auth/password/reset', payload);

  return response.data;
};
