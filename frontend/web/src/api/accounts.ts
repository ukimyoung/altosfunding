import api from './axios';

export interface AccountProductSummary {
  product_id: string;
  product_name: string;
  count: number;
}

export type AccountTier = 'CHALLENGE' | 'FUNDED' | 'DEMO' | 'LIVE';

export type ChallengeAccountStatus =
  | 'PENDING' // 대기 : MT4 계좌 생성은 되어있으나 미공개 상태
  | 'ACTIVE' // 활성 : MT4 계좌 활성. 첫 거래 대기
  | 'IN_PROGRESS' // 진행중 : 거래중인 상태
  | 'PASSED' // 통과 : 어드민 최종 승인 후 펀디드 등록
  | 'FAILED' // 실패 : 탈락 사유 조회 가능
  | 'CLOSED' // 종료? : 현재 테스트 시 응답에 내려오고 있어서 임시 추가함.
  | 'INACTIVE' // 비활성 : 중지 또는 폐쇄 처리
  | 'BANNED'; // 영구정지 : 어뷰징, 악용 등 영구 조치

export type FundedAccountStatus =
  | 'PENDING' // 대기 : MT4 계좌 생성은 되어있으나 미공개 상태
  | 'ACTIVE' // 활성 : MT4 계좌 활성. 첫 거래 대기
  | 'IN_PROGRESS' // 진행중 : 거래중인 상태
  | 'PENDING_PAYOUT' // 보상금 출금중 : 펀디드 전용. 거래 일시 중단 상태
  | 'FAILED' // 실패 : 탈락 사유 조회 가능
  | 'CLOSED' // 종료
  | 'INACTIVE' // 비활성 : 중지 또는 폐쇄 처리
  | 'BANNED'; // 영구정지 : 어뷰징, 악용 등 영구 조치

export type AccountStatus = ChallengeAccountStatus | FundedAccountStatus;

export const CHALLENGE_ACCOUNT_STATUSES = [
  'PENDING',
  'ACTIVE',
  'IN_PROGRESS',
  'PASSED',
  'FAILED',
  'CLOSED',
  'INACTIVE',
  'BANNED',
] as const satisfies readonly ChallengeAccountStatus[];

export const FUNDED_ACCOUNT_STATUSES = [
  'PENDING',
  'ACTIVE',
  'IN_PROGRESS',
  'CLOSED',
  'PENDING_PAYOUT',
  'FAILED',
  'INACTIVE',
  'BANNED',
] as const satisfies readonly FundedAccountStatus[];

export interface AccountListItem {
  mt4_login: number | null;
  account_id: string;
  user_id: string;
  product_id: string;
  product_name?: string | null;
  // 계좌 유형 (Starter·Professional·Elite·Prime). 펀디드 계좌는 원래 챌린지 상품 기준.
  account_type?: string | null;
  status: AccountStatus | string;
  tier: AccountTier | string;
  type_code: string;
  is_read_only: boolean;
  capital: number;
  balance: number;
  equity: number;
  total_profit: number;
  promoted_at: string | null;
  failed_reason: string | null;
  reason?: string | null;
  created_at: string;
  challenge_id: string;
  challenge_name: string;
  start_date: string;
  end_date: string;
  user_email: string | null;
  mt4_password?: string | null;
  leverage_override?: number | null;
  // Core: QUEUED(발급 중) → DONE(발급 완료)
  provision_status?: string | null;
}

export interface ListAccountsParams {
  tier: AccountTier;
  status?: AccountStatus;
  type_code?: string;
  // 계좌 유형: 상품명에서 'Challenge '를 뺀 이름 (Starter·Professional·Elite·Prime)
  product_type?: string;
  mt4_login?: number;
  account_id?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  size?: number;
}

export interface ListAccountsResponse {
  items: AccountListItem[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface ChallengeSummaryResponse {
  total_challenges: number;
  active_challenges: number;
  passed_challenges: number;
  failed_challenges: number;
  by_product: AccountProductSummary[];
}

export interface FundedSummaryResponse {
  total_fundings: number;
  active_fundings: number;
  closed_fundings: number;
  total_payout: number;
  pending_payout_amount: number;
  pending_payout_count: number;
  by_product: AccountProductSummary[];
}

export interface AccountDetailResponse {
  mt4_login: number | null;
  account_id: string;
  user_id: string;
  product_id: string;
  status: AccountStatus | string;
  tier: AccountTier | string;
  type_code: string;
  is_read_only: boolean;
  capital: number;
  leverage_override: number | null;
  balance: number;
  equity: number;
  total_profit: number;
  available_balance: number;
  total_completed_payout: number;
  promoted_at: string | null;
  failed_reason: string | null;
  created_at: string;
  session_id: string;
  session_name: string;
  start_at: string | null;
  end_at: string | null;
  start_date: string;
  end_date: string | null;
  challenge_id: string;
  challenge_mt4_login: number | null;
  user_name: string | null;
  user_email: string | null;
  user_grade: string | null;
  mt4_password: string;
}

export interface AccountTradeItem {
  deal_id: number;
  date: string;
  symbol: string;
  action: 'BUY' | 'SELL' | 'BALANCE' | string;
  volume: number;
  price: number;
  profit: number;
  fee: number;
  swap: number;
  entry: 'In' | 'Out' | string;
  comment: string | null;
}

export interface AccountTradeHistoryResponse {
  items: AccountTradeItem[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface UpdateAccountPasswordRequest {
  new_password: string;
  password_type: 'main' | 'investor';
}

export interface UpdateAccountPasswordResponse {
  ok?: boolean;
  [key: string]: unknown;
}

export const GetChallengeSummary = async () => {
  const response = await api.get<ChallengeSummaryResponse>('/v1/accounts/challenge-summary');

  return response.data;
};

export const getAccountDetail = async (accountId: string) => {
  const response = await api.get<AccountDetailResponse>(`/v1/accounts/${accountId}`);

  return response.data;
};

/** 챌린지 룰별 결과 1개 (Core가 판정 때 기록). values는 화면 문구용 숫자 값 (이전 판정에는 없음). */
export interface AccountEvaluationCheck {
  key: 'profit_target' | 'min_trading_days' | 'max_drawdown' | 'consistency' | string;
  label: string;
  passed: boolean;
  detail: string | null;
  values?: Record<string, number | string | boolean | null> | null;
}

/** 챌린지 최종 판정. 대회 기간이 끝나고 판정이 난 뒤에만 오고, 그 전에는 null. */
export interface AccountEvaluationResponse {
  result: 'PASSED' | 'FAILED';
  period_start: string;
  period_end: string;
  evaluated_at: string;
  checks: AccountEvaluationCheck[];
}

export const getAccountEvaluation = async (accountId: string) => {
  const response = await api.get<AccountEvaluationResponse | null>(`/v1/accounts/${accountId}/evaluation`);

  return response.data;
};

export const getAccountTradeHistory = async (accountId: string) => {
  const response = await api.get<AccountTradeHistoryResponse>(`/v1/accounts/${accountId}/trades`);

  return response.data;
};

export const GetFundedSummary = async () => {
  const response = await api.get<FundedSummaryResponse>('/v1/accounts/funding-summary');

  return response.data;
};

export const listAccounts = async (params: ListAccountsParams) => {
  const response = await api.get<ListAccountsResponse>('/v1/accounts', {
    params,
  });

  return response.data;
};

export const updateAccountPassword = async (
  accountId: string,
  payload: UpdateAccountPasswordRequest,
) => {
  const response = await api.post<UpdateAccountPasswordResponse>(
    `/v1/accounts/${accountId}/password`,
    payload,
  );
  return response.data;
};
