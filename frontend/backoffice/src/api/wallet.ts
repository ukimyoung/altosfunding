import api from './axios';

export interface WalletTransaction {
  id: string | number;
  source: string;
  ref_id?: number;
  user_id: string;
  user_email: string;
  user_nickname: string;
  display_tx_type: string;
  tx_type: string;
  direction: 'IN' | 'OUT' | string;
  amount: number;
  fee: number;
  balance_after?: number | null;
  source_account: string | null;
  status: string;
  display_status?: string;
  wallet_type: string | null;
  tx_hash: string | null;
  network: string | null;
  wallet_address: string | null;
  description: string | null;
  reject_reason: string | null;
  created_at: string;
}

export interface ListWalletRequestsResponse {
  items: WalletTransaction[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface ListPendingWalletRequestsParams {
  keyword?: string | null;
  display_tx_type?: string | null;
  direction?: 'IN' | 'OUT' | string | null;
  start_date?: string | null;
  end_date?: string | null;
  page?: number;
  size?: number;
}

export interface ListWalletRequestHistoryParams extends ListPendingWalletRequestsParams {
  display_status?: string | null;
}

export interface WalletRequestsSummary {
  pending_count: number;
  history_count: number;
  deposit_pending_count: number;
  withdraw_pending_count: number;
}

export interface WalletRequestsSummaryParams {
  status?: string | null;
}

export const listPendingWalletRequests = async (
  params: ListPendingWalletRequestsParams = {},
): Promise<ListWalletRequestsResponse> => {
  const response = await api.get<ListWalletRequestsResponse>('/v1/admin/wallets/requests/pending', {
    params,
  });
  return response.data;
};

export const listWalletRequestHistory = async (
  params: ListWalletRequestHistoryParams = {},
): Promise<ListWalletRequestsResponse> => {
  const response = await api.get<ListWalletRequestsResponse>('/v1/admin/wallets/requests/history', {
    params,
  });
  return response.data;
};

export const getWalletRequestsSummary = async (
  params: WalletRequestsSummaryParams = {},
): Promise<WalletRequestsSummary> => {
  const response = await api.get<WalletRequestsSummary>('/v1/admin/wallets/requests/summary', {
    params,
  });
  return response.data;
};

export interface RejectDepositRequestParams {
  reason: string;
}

export interface ApproveWithdrawalRequestParams {
  tx_hash: string;
}

export interface RejectWithdrawalRequestParams {
  note: string;
}

export interface RejectPayoutRequestParams {
  note: string;
}

export const approveDepositRequest = async (requestId: string | number): Promise<void> => {
  await api.post(`/v1/admin/wallets/deposits/${requestId}/approve`);
};

export const rejectDepositRequest = async (
  requestId: string | number,
  params: RejectDepositRequestParams,
): Promise<void> => {
  await api.post(`/v1/admin/wallets/deposits/${requestId}/reject`, params);
};

export const approveWithdrawalRequest = async (
  requestId: string | number,
  params: ApproveWithdrawalRequestParams,
): Promise<void> => {
  await api.post(`/v1/admin/wallets/withdrawals/${requestId}/approve`, params);
};

export const rejectWithdrawalRequest = async (
  requestId: string | number,
  params: RejectWithdrawalRequestParams,
): Promise<void> => {
  await api.post(`/v1/admin/wallets/withdrawals/${requestId}/reject`, params);
};

export const approvePayoutRequest = async (payoutId: string | number): Promise<void> => {
  await api.post(`/v1/admin/payouts/${payoutId}/approve`);
};

export const rejectPayoutRequest = async (
  payoutId: string | number,
  params: RejectPayoutRequestParams,
): Promise<void> => {
  await api.post(`/v1/admin/payouts/${payoutId}/reject`, params);
};
