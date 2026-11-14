import api from './axios';

export interface ListMyPayoutsParams {
  account_id?: string;
  page?: number;
  size?: number;
}

export interface CreatePayoutRequestPayload {
  account_id: string;
  amount: number;
  currency: string;
  network: string;
  wallet_address: string;
}

export interface CalculatePayoutPayload {
  account_id: string;
  amount: number;
}

export interface CalculatePayoutResponse {
  gross_profit: number;
  trader_share: number;
  amount: number;
  fee: number;
  total_fee: number;
  currency: string;
  network: string;
}

export interface CheckPayoutPositionsResponse {
  ok: boolean;
  message: string;
}

export interface MyPayoutItem {
  id: number;
  mt4_login: number | null;
  account_id: string;
  user_id: string;
  gross_profit: number;
  trader_share: number;
  amount: number;
  currency: string;
  fee: number;
  total_fee: number;
  network: string;
  wallet_address: string;
  profit_split_pct: number;
  status: string;
  approved_at: string | null;
  executed_at: string | null;
  rejected_reason: string | null;
  created_at: string;
  user_nickname: string | null;
  user_email: string | null;
}

export interface ListMyPayoutsResponse {
  items: MyPayoutItem[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export const listMyPayouts = async (params: ListMyPayoutsParams) => {
  const response = await api.get<ListMyPayoutsResponse>('/v1/payouts/mine', {
    params,
  });

  return response.data;
};

export const createPayoutRequest = async (payload: CreatePayoutRequestPayload) => {
  const response = await api.post('/v1/payouts/request', payload);
  return response.data;
};

export const calculatePayout = async (payload: CalculatePayoutPayload) => {
  const response = await api.post<CalculatePayoutResponse>('/v1/payouts/calculate', payload);
  return response.data;
};

export const checkPayoutPositions = async (accountId: string) => {
  const response = await api.get<CheckPayoutPositionsResponse>(
    `/v1/payouts/check-positions/${encodeURIComponent(accountId)}`,
  );

  return response.data;
};
