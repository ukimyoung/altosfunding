import api from './axios';

export interface CreateLiveAccountRequest {
  product_id: 'LIVE_STD';
}

export interface CreateLiveAccountResponse {
  mt4_login: number;
  tier: 'LIVE' | string;
  status: 'ACTIVE' | string;
  capital: number;
  product_id: string;
  [key: string]: unknown;
}

export const createLiveAccount = async (payload: CreateLiveAccountRequest) => {
  const response = await api.post<CreateLiveAccountResponse>('/v1/live/accounts', payload);
  return response.data;
};
