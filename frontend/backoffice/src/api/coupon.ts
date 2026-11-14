import api from './axios';

export type AdminCouponStatus = 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'EXHAUSTED';

export interface AdminCoupon {
  id: number;
  code: string;
  name: string;
  partner_id: string | null;
  partner_email: string | null;
  partner_name: string | null;
  discount_rate: number;
  commission_rate: number;
  applicable_tiers: string[];
  max_uses: number;
  used_count: number;
  per_user_limit: number;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  note: string | null;
  status: AdminCouponStatus;
  created_at: string;
  updated_at: string;
}

export interface ListCouponsParams {
  keyword?: string | null;
  status?: AdminCouponStatus | null;
  page?: number;
  size?: number;
  is_active?: boolean | null;
  partner_id?: string | null;
}

export interface ListCouponsResponse {
  items: AdminCoupon[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface CouponWriteRequest {
  name: string;
  partner_id: string;
  discount_rate: number;
  commission_rate: number;
  applicable_tiers: string[];
  max_uses: number;
  per_user_limit: number;
  valid_from?: string | null;
  valid_until?: string | null;
  is_active?: boolean;
}

export interface CreateCouponRequest extends CouponWriteRequest {
  code: string;
}
export type UpdateCouponRequest = CouponWriteRequest;

export interface CouponStats {
  total_coupons: number;
  active_coupons: number;
  total_usage_count: number;
  total_discount_amount: number;
}

export interface CouponUsage {
  id: number;
  user_id: string;
  user_email: string;
  user_name: string;
  order_id: string;
  original_amount: number;
  discount_amount: number;
  final_amount: number;
  commission_amount: number;
  used_at: string;
}

export interface ListCouponUsagesParams {
  page?: number;
  size?: number;
}

export interface ListCouponUsagesResponse {
  coupon_id: number;
  coupon_code: string;
  items: CouponUsage[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export async function listCoupons(
  params: ListCouponsParams = {},
): Promise<ListCouponsResponse> {
  const response = await api.get<ListCouponsResponse>('/v1/admin/coupons', { params });

  return response.data;
}

export async function getCoupon(couponId: number): Promise<AdminCoupon> {
  const response = await api.get<AdminCoupon>(`/v1/admin/coupons/${couponId}`);
  return response.data;
}

export async function createCoupon(payload: CreateCouponRequest): Promise<AdminCoupon> {
  const response = await api.post<AdminCoupon>('/v1/admin/coupons', payload);
  return response.data;
}

export async function updateCoupon(
  couponId: number,
  payload: UpdateCouponRequest,
): Promise<AdminCoupon> {
  const response = await api.patch<AdminCoupon>(`/v1/admin/coupons/${couponId}`, payload);
  return response.data;
}

export async function deleteCoupon(couponId: number): Promise<void> {
  await api.delete(`/v1/admin/coupons/${couponId}`);
}

export async function getCouponStats(): Promise<CouponStats> {
  const response = await api.get<CouponStats>('/v1/admin/coupons/stats');
  return response.data;
}

export async function listCouponUsages(
  couponId: number,
  params: ListCouponUsagesParams = {},
): Promise<ListCouponUsagesResponse> {
  const response = await api.get<ListCouponUsagesResponse>(
    `/v1/admin/coupons/${couponId}/usages`,
    {
      params: {
        page: params.page ?? 1,
        size: params.size ?? 10,
      },
    },
  );
  return response.data;
}
