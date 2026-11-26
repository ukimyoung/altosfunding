import axios from 'axios';
import api from './axios';

export interface MeResponse {
  id?: string;
  uid?: string;
  user_id?: string;
  email?: string;
  role?: string;
  is_active?: boolean;
  auth_provider?: string;
  first_name?: string;
  last_name?: string;
  country?: string;
  city?: string;
  state_province?: string;
  address_line1?: string;
  address_line2?: string;
  zip_code?: string;
  phone?: string;
  avatar_url?: string;
  registration_date?: string;
  created_at?: string;
  email_verified?: boolean;
  is_2fa_enabled?: boolean;
  account_count?: number;
  ticket_count?: number;
  referral_code?: string;
  agreed_to_terms?: boolean;
  subscribed_newsletter?: boolean;
  grade?: string;
  total_referrals?: number;
  /** 회원 언어 (알림 메일 언어) */
  locale?: UserLocale;
  [key: string]: unknown;
}

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'BANNED';
export type UserGrade = 'NORMAL' | 'VIP';
export type UserRole = 'USER' | 'ADMIN';
export type UserLocale = 'en' | 'ko';
export type UserKycStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface CreateUserRequest {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  country?: string;
  state_province?: string;
  city?: string;
  zip_code?: string;
  address_line1?: string;
  address_line2?: string;
  admin_note?: string;
  role: UserRole;
  grade: UserGrade;
  status: UserStatus;
  kyc_status: UserKycStatus;
}

export interface UpdateUserRequest {
  first_name?: string;
  last_name?: string;
  country?: string;
  city?: string;
  state_province?: string;
  address_line1?: string;
  address_line2?: string;
  zip_code?: string;
  phone?: string;
  avatar_url?: string;
  password?: string;
  status?: UserStatus;
  kyc_status?: UserKycStatus;
  grade?: UserGrade;
  role?: UserRole;
  admin_note?: string;
  locale?: UserLocale;
  /** 마케팅(뉴스레터) 메일 수신 동의 */
  subscribed_newsletter?: boolean;
}

export const USER_ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'USER', label: 'USER' },
  { value: 'ADMIN', label: 'ADMIN' },
];

/** 회원 추가·수정 API 오류를 화면에 보여 줄 문구로 바꾼다. */
export const getUserApiErrorMessage = (error: unknown, fallback: string) => {
  if (!axios.isAxiosError<{ message?: string; error_code?: string }>(error)) return fallback;
  const code = error.response?.data?.error_code;
  if (code === 'email_already_exists') return '이미 가입된 이메일입니다.';
  if (code === 'cannot_change_own_role') return '본인 계정의 Role은 변경할 수 없습니다.';
  if (code === 'validation_error' || error.response?.status === 422) return '입력값을 확인해 주세요.';
  return error.response?.data?.message || fallback;
};

export interface SuspendUserRequest {
  reason: string;
}

export interface BanUserRequest {
  reason: string;
}

export interface User {
  id: string;
  uid: string | null;
  email: string;
  role: string;
  is_active: boolean;
  status?: UserStatus | null;
  kyc_status: UserKycStatus | null;
  kyc_reject_reason: string | null;
  kyc_submitted_at: string | null;
  kyc_approved_at: string | null;
  kyc_rejected_at: string | null;
  auth_provider: string | null;
  first_name: string | null;
  last_name: string | null;
  country: string | null;
  city: string | null;
  state_province: string | null;
  address_line1: string | null;
  address_line2: string | null;
  zip_code: string | null;
  phone: string | null;
  avatar_url: string | null;
  email_verified: boolean;
  is_2fa_enabled: boolean;
  require_email_for_withdraw: boolean;
  created_at: string;
  last_login_at: string | null;
  challenge_account_count: number;
  funded_account_count: number;
  live_account_count: number;
  demo_account_count: number;
  total_assets: number;
  referral_code: string | null;
  agreed_to_terms: boolean;
  subscribed_newsletter: boolean;
  grade: UserGrade;
  total_referrals: number;
  admin_note?: string | null;
  /** 회원 언어 (알림 메일 언어) */
  locale?: UserLocale;
  /** 제휴사(10Power·xnsoft) 회원 계정이면 true */
  is_partner_member?: boolean;
  /** 제휴사 Member ID (일반 계정은 null) */
  partner_member_id?: string | null;
}

export interface ListUsersParams {
  keyword?: string | null;
  status?: UserStatus | null;
  grade?: UserGrade | null;
  kyc_status?: UserKycStatus | null;
  is_active?: boolean | null;
  page?: number;
  size?: number;
}

export interface ListUsersResponse {
  items: User[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface UserSummary {
  total_users: number;
  active_users: number;
  inactive_users: number;
  banned_users: number;
  vip_users: number;
  normal_users: number;
  yesterday_signups: number;
  kyc: {
    approved: number;
    pending: number;
    rejected: number;
    unverified: number;
  };
}

export interface PartnerStatsParams {
  page?: number;
  size?: number;
}

export interface PartnerStatsSummary {
  total_usage_count: number;
  total_original_amount: number;
  total_discount_amount: number;
  total_final_amount: number;
  total_commission_amount: number;
}

export interface PartnerCouponStats {
  coupon_id: number;
  code: string;
  name: string;
  discount_rate: number;
  commission_rate: number;
  is_active: boolean;
  max_uses: number;
  used_count: number;
  usage_count: number;
  created_at: string;
  total_original_amount: number;
  total_discount_amount: number;
  total_final_amount: number;
  total_commission_amount: number;
}

export interface PartnerStatsResponse {
  user_id: string;
  total_coupons: number;
  summary: PartnerStatsSummary;
  coupons: PartnerCouponStats[];
  page: number;
  size: number;
  total: number;
  pages: number;
}

export const getMe = async (): Promise<MeResponse> => {
  const response = await api.get<MeResponse>('/v1/auth/me');
  return response.data;
};

export const listUsers = async (params: ListUsersParams = {}): Promise<ListUsersResponse> => {
  const page = params.page ?? 1;
  const size = params.size ?? 20;
  const response = await api.get<ListUsersResponse>('/v1/admin/users', {
    params: { ...params, page, size },
  });

  return response.data;
};

export const getUserDetail = async (userId: string): Promise<User> => {
  const response = await api.get<User>(`/v1/admin/users/${userId}`);
  return response.data;
};

export const createUser = async (payload: CreateUserRequest): Promise<User> => {
  const response = await api.post<User>('/v1/admin/users', payload);
  return response.data;
};

export const updateUser = async (userId: string, payload: UpdateUserRequest): Promise<User> => {
  const response = await api.patch<User>(`/v1/admin/users/${userId}/profile`, payload);
  return response.data;
};

export const suspendUser = async (userId: string, payload: SuspendUserRequest): Promise<void> => {
  await api.post(`/v1/admin/users/${userId}/suspend`, payload);
};

export const banUser = async (userId: string, payload: BanUserRequest): Promise<void> => {
  await api.post(`/v1/admin/users/${userId}/ban`, payload);
};

export const withdrawUser = async (userId: string): Promise<void> => {
  await api.post(`/v1/admin/users/${userId}/withdraw`);
};

export const activateUser = async (userId: string): Promise<void> => {
  await api.post(`/v1/admin/users/${userId}/activate`);
};

export const getUserSummary = async (): Promise<UserSummary> => {
  const response = await api.get<UserSummary>('/v1/admin/users/summary');
  return response.data;
};

export const getUserPartnerStats = async (
  userId: string,
  params: PartnerStatsParams = {},
): Promise<PartnerStatsResponse> => {
  const response = await api.get<PartnerStatsResponse>(
    `/v1/admin/users/${userId}/partner-stats`,
    { params: { page: params.page ?? 1, size: params.size ?? 20 } },
  );
  return response.data;
};
