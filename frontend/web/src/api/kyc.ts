import api from './axios';

export type KycStatus =
  | 'NONE'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | (string & {});

export interface KycStatusResponse {
  status: KycStatus;
  message_key?: string;
  reject_reason?: string | null;
}

export interface SumsubAccessTokenResponse {
  ok: boolean;
  token: string;
}

export const getKycStatus = async () => {
  const response = await api.get<KycStatusResponse>('/v1/auth/kyc/status');

  return response.data;
};

export const getSumsubAccessToken = async () => {
  const response = await api.get<SumsubAccessTokenResponse>('/v1/auth/kyc/sumsub/token');

  return response.data;
};
