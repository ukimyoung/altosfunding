import api from './axios';

export interface AssetSummaryAccount {
  [key: string]: unknown;
}

export interface AssetSummaryResponse {
  total_balance: number;
  total_equity: number;
  total_capital: number;
  total_profit: number;
  total_profit_pct: number;
  total_payouts: number;
  total_rewards: number;
  accounts_count: number;
  active_accounts: number;
  passed_accounts: number;
  accounts: AssetSummaryAccount[];
}

export interface MyAssetLiveAccount {
  account_id: string;
  mt4_login: number;
  product_id: string;
  status: string;
  balance: number;
  equity: number;
  snapshot_at: string;
  [key: string]: unknown;
}

export interface MyAssetResponse {
  total_asset: number;
  total_live_balance?: number;
  live_accounts: MyAssetLiveAccount[];
  [key: string]: unknown;
}

export const GetAssetSummary = async () => {
  const response = await api.get<AssetSummaryResponse>('/v1/assets/summary');

  return response.data;
};

export const getMyAsset = async () => {
  const response = await api.get<MyAssetResponse>('/v1/accounts/my-asset');

  return response.data;
};
