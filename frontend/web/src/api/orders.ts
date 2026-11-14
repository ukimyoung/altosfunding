import api from './axios';

export interface CompletePaymentRequest {
  challenge_id: string;
  mt4_login: number;
  quantity: number;
  coupon_code?: string;
}

export interface OrderTicket {
  id: string;
  user_id: string;
  product_id: string;
  status: string;
  mt4_login: number;
  mt4_password: string;
  mt4_investor_password: string;
  challenge_id: string;
  created_at: string;
  used_at: string;
  user_email: string;
  product_name: string;
}

export interface Order {
  order_id: string;
  challenge_id: string;
  product_name: string;
  type_code: string;
  quantity: number;
  status: string;
  total_price: number;
  created_at: string;
}

export interface ListOrdersParams {
  page?: number;
  size?: number;
  search?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
}

export interface ListOrdersResponse {
  items: Order[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export const completePayment = async (payload: CompletePaymentRequest) => {
  const { challenge_id, ...body } = payload;
  const response = await api.post(`/v1/challenges/${challenge_id}/join`, body);
  return response.data;
};

export const ListUserOrders = async (params: ListOrdersParams) => {
  const response = await api.get<ListOrdersResponse>('/v1/challenges/orders/me', {
    params,
  });

  return response.data;
};
