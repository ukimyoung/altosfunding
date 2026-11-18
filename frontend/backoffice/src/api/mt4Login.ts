import axios from 'axios';
import api from './axios';

// MT4 계좌번호 기록·블랙리스트 (Core /admin/mt4/*).
// server: demo = Challenge 계좌(챌린지·데모 서버) / live = Funded 계좌(펀디드·라이브 서버)

export type Mt4Server = 'demo' | 'live';
export type Mt4LoginStatus = 'BLACKLISTED' | 'IN_USE' | 'RESERVED' | 'ORPHANED';
export type Mt4LoginSource = 'SYSTEM' | 'ADMIN';

export interface Mt4LoginRow {
  mt4_server: Mt4Server;
  mt4_login: number;
  status: Mt4LoginStatus;
  source: Mt4LoginSource;
  reason: string | null;
  product_id: string | null;
  product_name: string | null;
  account_id: string | null;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
  /** 번호가 속한 상품 범위. passed=true면 그 상품의 번호 카운터가 이미 이 번호를 지나갔다. */
  pool_products: { product_id: string; name: string; passed: boolean }[];
}

export interface Mt4LoginPage {
  items: Mt4LoginRow[];
  total: number;
  page: number;
  page_size: number;
  counts: Record<Mt4LoginStatus, number>;
}

export interface Mt4LoginPool {
  product_id: string;
  name: string;
  tier_type: string;
  is_active: boolean;
  pool_start: number;
  pool_end: number;
  last_mt4_login: number | null;
  next_login: number;
}

export interface Mt4LoginListParams {
  server: Mt4Server;
  status?: Mt4LoginStatus;
  source?: Mt4LoginSource;
  login?: string;
  page: number;
  page_size: number;
}

export interface BlacklistInput {
  mt4_server: Mt4Server;
  login_from: number;
  login_to: number | null;
  reason: string;
}

export interface BlacklistResult {
  added: number[];
  converted: number[];
  skipped: { mt4_login: number; status: Mt4LoginStatus; source: Mt4LoginSource }[];
}

export const listMt4Logins = async (params: Mt4LoginListParams): Promise<Mt4LoginPage> => {
  const response = await api.get<Mt4LoginPage>('/v1/admin/mt4/logins', { params });
  return response.data;
};

export const listMt4LoginPools = async (server: Mt4Server): Promise<Mt4LoginPool[]> => {
  const response = await api.get<Mt4LoginPool[]>('/v1/admin/mt4/login-pools', { params: { server } });
  return response.data;
};

export const addMt4Blacklist = async (payload: BlacklistInput): Promise<BlacklistResult> => {
  const response = await api.post<BlacklistResult>('/v1/admin/mt4/blacklist', payload);
  return response.data;
};

export const releaseMt4Blacklist = async (server: Mt4Server, login: number): Promise<void> => {
  await api.delete(`/v1/admin/mt4/blacklist/${server}/${login}`);
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid_login_range: '끝 번호는 시작 번호보다 크거나 같아야 합니다.',
  login_range_too_large: '한 번에 1,000개까지 등록할 수 있습니다.',
  mt4_login_not_found: '등록된 번호가 아닙니다.',
  mt4_login_not_releasable: '관리자가 등록한 블랙리스트만 해제할 수 있습니다.',
};

export const getMt4LoginApiErrorMessage = (error: unknown, fallback: string) => {
  if (!axios.isAxiosError<{ message?: string; error_code?: string }>(error)) return fallback;
  const code = error.response?.data?.error_code;
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  if (code === 'validation_error' || error.response?.status === 422) return '입력값을 확인해 주세요.';
  return error.response?.data?.message || fallback;
};
