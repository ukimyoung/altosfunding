import api from './axios';

export interface DemoOptionsResponse {
  allowed_leverages: number[];
  allowed_capitals: number[];
  default_leverage: number;
  default_capital: number;
}

export interface CreateDemoAccountRequest {
  product_id: string;
  capital: number;
  leverage: number;
}

export interface CreateDemoAccountResponse {
  mt4_login: number;
  tier: string;
  status: string;
  capital: number;
  leverage_override: number;
  product_id: string;
  [key: string]: unknown;
}

export const getDemoOptions = async () => {
  const response = await api.get<DemoOptionsResponse>('/v1/demo/options');
  return response.data;
};

export const createDemoAccount = async (payload: CreateDemoAccountRequest) => {
  const response = await api.post<CreateDemoAccountResponse>('/v1/demo/accounts', payload);
  return response.data;
};
