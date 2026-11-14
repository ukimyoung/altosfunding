import api from './axios';

export interface ValidateCouponRequest {
  coupon_code: string;
  product_tier?: string;
  unit_price: number;
  quantity: number;
}

export interface ValidateCouponResponse {
  valid: boolean;
  coupon_code: string;
  discount_rate: number;
  unit_price: number;
  quantity: number;
  total_price: number;
  discount_amount: number;
  final_amount: number;
  message: string;
}

export const validateCoupon = async (payload: ValidateCouponRequest) => {
  const response = await api.post<ValidateCouponResponse>('/v1/coupons/validate', payload);
  return response.data;
};
