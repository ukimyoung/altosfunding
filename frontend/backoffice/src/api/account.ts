import api from './axios';

export type AccountStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'IN_PROGRESS'
  | 'PENDING_PAYOUT'
  | 'CLOSED'
  | 'PASSED'
  | 'FAILED'
  | 'INACTIVE'
  | 'BANNED';
export type AccountTier = 'CHALLENGE' | 'FUNDED' | 'DEMO' | 'LIVE';

export interface ListAccountsParams {
  status?: AccountStatus | null;
  tier?: AccountTier | null;
  user_id?: string | null;
  keyword?: string | number | null;
  type_code?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  page?: number;
  size?: number;
}

export interface ListAccountTradesParams {
  page?: number;
  size?: number;
}

export interface BanAccountRequest {
  reason: string;
}

export interface AdminAccount {
  mt4_login: number;
  account_id: string | null;
  user_id: string;
  product_id: string;
  status: AccountStatus;
  tier: AccountTier;
  type_code: string;
  is_read_only: boolean;
  capital: number;
  leverage_override: number | null;
  balance: number;
  equity: number;
  total_profit: number;
  promoted_at: string | null;
  failed_reason: string | null;
  created_at: string;
  session_id: string;
  session_name: string;
  start_at: string;
  end_at?: string | null;
  start_date: string;
  end_date?: string | null;
  challenge_id: string | null;
  challenge_mt4_login: number | null;
  user_name: string;
  user_email: string;
  user_grade: string;
  mt4_password: string | null;
  // Core 응답에만 있는 값 (기존 서버에는 없음)
  product_name?: string | null;
  leverage?: number | null;
  mt4_server?: string | null;
  provision_status?: string | null;
  // 챌린지 계좌 상세에만: 상품의 펀디드 발급 방법과 이 계좌로 만든 펀디드 계좌 (발급 실패 제외)
  funded_issue_method?: 'AUTO' | 'MANUAL' | null;
  funded_account_id?: string | null;
  funded_mt4_login?: number | null;
  funded_provision_status?: string | null;
  funded_start_at?: string | null;
}

export interface ListAccountsResponse {
  items: AdminAccount[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface AccountStats {
  tier: AccountTier;
  total_accounts: number;
  in_progress_accounts: number;
  total_capital: number;
}

export interface AccountTrade {
  deal_id: number;
  date: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  volume: number;
  price: number;
  profit: number;
  fee: number;
  swap: number;
  entry: 'In' | 'Out';
  comment: string | null;
}

export interface ListAccountTradesResponse {
  items: AccountTrade[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export const listAccounts = async (
  params: ListAccountsParams = {},
): Promise<ListAccountsResponse> => {
  const page = params.page ?? 1;
  const size = params.size ?? 20;
  const response = await api.get<ListAccountsResponse>('/v1/admin/accounts', {
    params: { ...params, page, size },
  });

  return response.data;
};

export const getAccountStats = async (tier: AccountTier): Promise<AccountStats> => {
  const response = await api.get<AccountStats>('/v1/admin/accounts-stats', {
    params: { tier },
  });

  return response.data;
};

export const getAccountDetail = async (accountId: string): Promise<AdminAccount> => {
  const response = await api.get<AdminAccount>(`/v1/admin/accounts/${accountId}`);
  return response.data;
};

export const listAccountTrades = async (
  accountId: string,
  params: ListAccountTradesParams = {},
): Promise<ListAccountTradesResponse> => {
  const page = params.page ?? 1;
  const size = params.size ?? 20;
  const response = await api.get<ListAccountTradesResponse>(
    `/v1/admin/accounts/${accountId}/trades`,
    {
      params: { ...params, page, size },
    },
  );

  return response.data;
};

export interface AccountEvaluationCheck {
  key: 'profit_target' | 'min_trading_days' | 'max_drawdown' | 'consistency' | string;
  label: string;
  passed: boolean;
  detail: string | null;
  values?: Record<string, number | string | boolean | null> | null;
}

/** 챌린지 결과 (웹 Account Detail과 같은 최종 판정). 대회 기간이 끝나고 판정이 난 뒤에만 오고, 그 전에는 null. */
export interface AccountEvaluation {
  result: 'PASSED' | 'FAILED';
  period_start: string;
  period_end: string;
  evaluated_at: string;
  checks: AccountEvaluationCheck[];
}

export const getAccountEvaluation = async (accountId: string): Promise<AccountEvaluation | null> => {
  const response = await api.get<AccountEvaluation | null>(`/v1/admin/accounts/${accountId}/evaluation`);
  return response.data;
};

export const unfreezeAccount = async (accountId: string): Promise<void> => {
  const endpoint = `/v1/admin/accounts/${accountId}/unfreeze`;
  await api.post(endpoint);
};

export const freezeAccount = async (accountId: string): Promise<void> => {
  const endpoint = `/v1/admin/accounts/${accountId}/freeze`;
  await api.post(endpoint);
};

/** 합격(PASSED)한 챌린지 계좌의 펀디드 계좌를 지금 발급한다. 만든 펀디드 계좌를 돌려준다. */
export const issueFundedAccount = async (accountId: string): Promise<AdminAccount> => {
  const response = await api.post<AdminAccount>(`/v1/admin/accounts/${accountId}/issue-funded`);
  return response.data;
};

export const banAccount = async (accountId: string, payload: BanAccountRequest): Promise<void> => {
  const endpoint = `/v1/admin/accounts/${accountId}/ban`;
  await api.post(endpoint, payload);
};
