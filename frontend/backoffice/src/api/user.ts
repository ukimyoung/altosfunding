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
  [key: string]: unknown;
}

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'BANNED';
export type UserGrade = 'NORMAL' | 'VIP';
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
  role: 'USER';
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
  admin_note?: string;
}

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
