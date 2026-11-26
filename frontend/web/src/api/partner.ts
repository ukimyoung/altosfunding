import api from './axios';
import { setAccessToken } from '@altosfunding/shared/auth/tokenStore';
import type { LoginResponse } from './login';

// 제휴사(10Power·xnsoft) 회원 첫 로그인: 제휴사 등록 이메일로 받은 코드를 확인하고 비밀번호를 정하면 Altos 계정이 만들어진다.

export interface PartnerActivationSendRequest {
  member_id: string;
  recaptcha_token?: string;
}

export interface PartnerActivationSendResponse {
  member_id: string;
  masked_email: string;
  expiry_minutes: number;
}

export interface PartnerActivationCompleteRequest {
  member_id: string;
  code: string;
  password: string;
  agree_to_terms: boolean;
  subscribe_newsletter: boolean;
}

export const sendPartnerActivationCode = async (payload: PartnerActivationSendRequest) => {
  const response = await api.post<PartnerActivationSendResponse>(
    '/v1/auth/partner/activation/send-code',
    payload,
  );
  return response.data;
};

export const completePartnerActivation = async (payload: PartnerActivationCompleteRequest) => {
  const response = await api.post<LoginResponse>('/v1/auth/partner/activation/complete', payload);
  if (response.data.access_token) {
    setAccessToken(response.data.access_token);
  }
  return response.data;
};
