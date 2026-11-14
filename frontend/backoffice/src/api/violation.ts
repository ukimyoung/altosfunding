import api from './axios';

export type ViolationAccountStatus = 'FAILED' | 'INACTIVE' | 'BANNED';
export type ViolationAccountTier = 'CHALLENGE' | 'FUNDED' | string;

export interface ViolationAccount {
  account_id: string;
  mt4_login: number;
  user_name: string;
  user_email: string;
  tier: ViolationAccountTier;
  type_code: string;
  capital: number;
  balance: number;
  profit: number;
  status: ViolationAccountStatus;
  suspended_at: string | null;
  suspended_by: string | null;
  suspend_reason: string | null;
}

export interface ListViolationAccountsParams {
  keyword?: string | null;
  type_code?: string | null;
  tier?: string | null;
  status?: ViolationAccountStatus | null;
  start_date?: string | null;
  end_date?: string | null;
  page?: number;
  size?: number;
}

export interface ListViolationAccountsResponse {
  items: ViolationAccount[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export const listViolationAccounts = async (
  params: ListViolationAccountsParams = {},
): Promise<ListViolationAccountsResponse> => {
  const response = await api.get<ListViolationAccountsResponse>('/v1/admin/violation-accounts', {
    params: {
      ...params,
      page: params.page ?? 1,
      size: params.size ?? 20,
    },
  });

  return response.data;
};
