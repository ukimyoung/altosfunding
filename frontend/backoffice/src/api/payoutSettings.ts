import api from './axios';

export interface ProfitSplitSettings {
  trader_pct: number;
  company_pct: number;
}

export interface ProfitSplitHistoryItem {
  id: number;
  old_pct: number;
  new_pct: number;
  admin_email: string;
  changed_at: string;
}

export interface ListProfitSplitHistoryParams {
  page?: number;
  size?: number;
}

export interface ListProfitSplitHistoryResponse {
  items: ProfitSplitHistoryItem[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface UpdateProfitSplitSettingsRequest {
  trader_pct: number;
}

export interface NetworkFeeSettings {
  name: string;
  desc: string;
  fee: number;
  is_active: boolean;
}

export interface UpdateNetworkFeeSettingsRequest {
  networks: Array<{
    name: string;
    desc: string;
    fee: number;
    is_active: boolean;
  }>;
}

export const getProfitSplitSettings = async (): Promise<ProfitSplitSettings> => {
  const response = await api.get<ProfitSplitSettings>('/v1/admin/payout-settings/profit-split');
  return response.data;
};

export const listProfitSplitHistory = async (
  params: ListProfitSplitHistoryParams = {},
): Promise<ListProfitSplitHistoryResponse> => {
  const response = await api.get<ListProfitSplitHistoryResponse>(
    '/v1/admin/payout-settings/profit-split/history',
    {
      params,
    },
  );
  return response.data;
};

export const updateProfitSplitSettings = async (
  payload: UpdateProfitSplitSettingsRequest,
): Promise<ProfitSplitSettings> => {
  const response = await api.put<ProfitSplitSettings>(
    '/v1/admin/payout-settings/profit-split',
    payload,
  );
  return response.data;
};

export const listNetworkFeeSettings = async (): Promise<NetworkFeeSettings[]> => {
  const response = await api.get<NetworkFeeSettings[]>('/v1/admin/payout-settings/network-fees');
  return response.data;
};

export const updateNetworkFeeSettings = async (
  payload: UpdateNetworkFeeSettingsRequest,
): Promise<NetworkFeeSettings[]> => {
  const response = await api.put<NetworkFeeSettings[]>(
    '/v1/admin/payout-settings/network-fees',
    payload,
  );
  return response.data;
};
