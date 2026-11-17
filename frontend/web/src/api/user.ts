import api from './axios';
import type { ApiRequestConfig } from '@altosfunding/shared/api/createApiClient';
import type { KycStatus } from './kyc';

type AuthRequestConfig = ApiRequestConfig;

export interface MeResponse {
  id?: string;
  uid?: string;
  user_id?: string;
  email?: string;
  role?: string;
  is_active?: boolean;
  auth_provider?: string;
  first_name?: string;
  last_name?: string;
  country?: string;
  city?: string;
  state_province?: string;
  address_line1?: string;
  address_line2?: string;
  zip_code?: string;
  phone?: string;
  avatar_url?: string;
  registration_date?: string;
  created_at?: string;
  email_verified?: boolean;
  kyc_status?: KycStatus;
  is_2fa_enabled?: boolean;
  can_change_password?: boolean;
  account_count?: number;
  ticket_count?: number;
  referrer_code?: string;
  referral_code?: string;
  agreed_to_terms?: boolean;
  subscribed_newsletter?: boolean;
  grade?: string;
  total_referrals?: number;
  is_email_enabled?: boolean;
  /** 회원 언어 (알림 메일 언어) */
  locale?: 'en' | 'ko';
  [key: string]: unknown;
}

export type UpdateProfileRequest = {
  first_name: string;
  last_name: string;
  country: string;
  city: string;
  state_province: string;
  address_line1: string;
  address_line2: string;
  zip_code: string;
  phone: string;
  // 현재 프로필 수정 화면에서는 avatar_url을 수정하지 않음.
  // avatar_url: string;
  referrer_code?: string;
};

export type UpdatePasswordRequest = {
  old_password: string;
  new_password: string;
};

export type TwoFactorSetupResponse = {
  secret: string;
  qr_uri: string;
  [key: string]: unknown;
};

export type TwoFactorVerifyRequest = {
  code: string;
};

export type TwoFactorDisableRequest = {
  code: string;
};

export type TwoFactorBackupCodesRegenerateRequest = {
  code: string;
};

export type TwoFactorBackupCodesRegenerateResponse =
  | string[]
  | {
      backup_codes?: string[];
      codes?: string[];
      [key: string]: unknown;
    };

export type UpdateWithdrawEmailRequest = {
  enabled: boolean;
};

export type UpdateWithdrawEmailResponse = {
  ok?: boolean;
  is_email_enabled?: boolean;
  [key: string]: unknown;
};

export type LoginHistoryItem = {
  id: number;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export type LoginHistoryResponse = {
  items: LoginHistoryItem[];
  total: number;
  page: number;
  size: number;
  pages: number;
};

export type WithdrawAccountResponse = {
  ok?: boolean;
  [key: string]: unknown;
};

export const getMe = async (config?: AuthRequestConfig) => {
  const response = await api.get<MeResponse>('/v1/auth/me', config);
  return response.data;
};

export const updateProfile = async (payload: UpdateProfileRequest) => {
  const response = await api.put<MeResponse>('/v1/auth/profile', payload);
  return response.data;
};

// 회원 언어 저장. 로그인한 상태에서 웹 언어를 바꾸면 알림 메일(입출금 승인, KYC 결과 등)도 그 언어로 받는다.
export const updateLocale = async (locale: 'en' | 'ko') => {
  await api.put('/v1/auth/account/locale', { locale }, { skipAuthRedirect: true } as AuthRequestConfig);
};

export const withdrawAccount = async () => {
  const response = await api.post<WithdrawAccountResponse>('/v1/auth/account/withdraw');

  return response.data;
};

export const updatePassword = async (payload: UpdatePasswordRequest) => {
  const response = await api.put('/v1/auth/password', payload);
  return response.data;
};

export const setupTwoFactor = async () => {
  const response = await api.post<TwoFactorSetupResponse>('/v1/auth/2fa/setup');
  return response.data;
};

export const verifyTwoFactor = async (payload: TwoFactorVerifyRequest) => {
  const response = await api.post('/v1/auth/2fa/verify', payload);
  return response.data;
};

export const disableTwoFactor = async (payload: TwoFactorDisableRequest) => {
  const response = await api.post('/v1/auth/2fa/disable', payload);
  return response.data;
};

export const regenerateTwoFactorBackupCodes = async (
  payload: TwoFactorBackupCodesRegenerateRequest,
) => {
  const response = await api.post<TwoFactorBackupCodesRegenerateResponse>(
    '/v1/auth/2fa/backup-codes/regenerate',
    payload,
  );
  return response.data;
};

export const updateWithdrawEmail = async (payload: UpdateWithdrawEmailRequest) => {
  const response = await api.patch<UpdateWithdrawEmailResponse>(
    '/v1/auth/security/withdraw-email',
    payload,
  );
  return response.data;
};

export const getLoginHistory = async () => {
  const response = await api.get<LoginHistoryResponse>('/v1/auth/login-history');
  return response.data;
};
