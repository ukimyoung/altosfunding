import api from './axios';

export interface ChallengeOrder {
  id: string;
  uid: string;
  user_id: string;
  user_email: string;
  user_nickname: string;
  product_name: string;
  quantity: number;
  /** 가격(단가, USDT). 없으면 화면에서 total_price ÷ quantity로 계산 */
  unit_price?: number | null;
  total_price: number;
  payment_method: string;
  status: string;
  created_at: string;
}

export interface ListChallengeOrdersParams {
  keyword?: string | null;
  product_type?: string | null;
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  page?: number;
  size?: number;
}

export interface ListChallengeOrdersResponse {
  items: ChallengeOrder[];
  total?: number;
  page?: number;
  size?: number;
  pages?: number;
}

export interface ChallengeOrderSummary {
  total_orders: number;
  total_payment: number;
  this_month_completed: number;
  total_refunds: number;
}

export const listChallengeOrders = async (
  params: ListChallengeOrdersParams = {},
): Promise<ListChallengeOrdersResponse> => {
  const page = params.page ?? 1;
  const size = params.size ?? 20;
  const response = await api.get<ListChallengeOrdersResponse>('/v1/admin/challenges/orders', {
    params: { ...params, page, size },
  });
  return response.data;
};

export const getChallengeOrdersSummary = async (): Promise<ChallengeOrderSummary> => {
  const response = await api.get<ChallengeOrderSummary>('/v1/admin/challenges/orders/summary');
  return response.data;
};
