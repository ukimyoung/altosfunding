import api from './axios';

export type CreateDepositRequest = {
  amount: number;
  tx_hash: string;
  network: string;
};

export type CreateDepositResponse = {
  ok?: boolean;
  [key: string]: unknown;
};

export const createDeposit = async (payload: CreateDepositRequest) => {
  const response = await api.post<CreateDepositResponse>('/v1/wallets/me/deposit', payload);
  return response.data;
};

export type CreateWithdrawRequest = {
  amount: number;
  network: string;
  wallet_address: string;
  verification_code?: string;
  totp_code?: string;
};

export type CreateWithdrawResponse = {
  ok?: boolean;
  [key: string]: unknown;
};

export const createWithdraw = async (payload: CreateWithdrawRequest) => {
  const response = await api.post<CreateWithdrawResponse>('/v1/wallets/me/withdraw', payload);
  return response.data;
};

export type TransferDirection = 'TO_PERSONAL' | 'TO_INTEGRATED';

export type CreateTransferRequest = {
  direction: TransferDirection;
  amount: number;
  account_id: string;
};

export type CreateTransferResponse = {
  ok?: boolean;
  [key: string]: unknown;
};

export const createTransfer = async (payload: CreateTransferRequest) => {
  const response = await api.post<CreateTransferResponse>('/v1/wallets/me/transfer', payload);
  return response.data;
};

export interface WalletNetworkItem {
  name: string;
  desc: string;
  fee: number;
  is_active: boolean;
  [key: string]: unknown;
}

export type WalletNetworksResponse =
  | WalletNetworkItem
  | WalletNetworkItem[]
  | { items?: WalletNetworkItem[] };

export const listWalletNetworks = async () => {
  const response = await api.get<WalletNetworksResponse>('/v1/payouts/config/networks');

  if (Array.isArray(response.data)) {
    return response.data;
  }

  if ('name' in response.data) {
    return [response.data];
  }

  return response.data.items ?? [];
};

export type WalletTransactionCategory = 'DEPOSIT' | 'WITHDRAW';
export type WalletTransactionStatus = 'Completed' | 'Pending' | 'Failed';

export interface WalletTransactionItem {
  id: number;
  date: string;
  tx_type: WalletTransactionCategory | string;
  label: string;
  display_tx_type: string;
  direction: 'IN' | 'OUT' | string;
  deposit: number | null;
  withdraw: number | null;
  fee: number | null;
  address: string | null;
  network: string | null;
  txid: string | null;
  status: WalletTransactionStatus;
  display_status: WalletTransactionStatus;
  reject_reason?: string | null;
  balance_after: number | null;
  [key: string]: unknown;
}

export interface WalletTransactionResponse {
  items: WalletTransactionItem[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface ListWalletTransactionsParams {
  category?: WalletTransactionCategory;
  status?: WalletTransactionStatus;
  start_date?: string;
  end_date?: string;
  page?: number;
  size?: number;
}

export const listWalletTransactions = async (params: ListWalletTransactionsParams) => {
  const response = await api.get<WalletTransactionResponse>('/v1/wallets/me/transactions', {
    params,
  });

  return response.data;
};
