import api from './axios';

export interface CompletePaymentRequest {
  challenge_id: string;
  /** 예전 서버 호환용. Core는 무시하고 항상 새 계좌를 발급한다. */
  mt4_login?: number;
  quantity: number;
  coupon_code?: string;
}

/** QUEUED: 발급 중 / DONE: 발급 완료 / FAILED: 발급 실패(자동 환불) */
export type ProvisionStatus = 'QUEUED' | 'DONE' | 'FAILED';

export interface OrderAccount {
  account_id: string;
  mt4_login: number | null;
  provision_status: ProvisionStatus | string;
  status: string;
  start_at: string | null;
  end_at: string | null;
}

/** Core 주문 상세. status: PENDING(계좌 발급 중) / COMPLETED / REFUNDED */
export interface OrderDetail {
  order_id: string;
  challenge_id: string;
  challenge_name: string | null;
  product_id: string;
  product_name: string;
  type_code: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  issued_quantity: number;
  refunded_quantity: number;
  refunded_amount: number;
  status: string;
  created_at: string;
  completed_at: string | null;
  accounts: OrderAccount[];
}

export interface CompletePaymentResponse extends OrderDetail {
  ok: boolean;
  total_asset: number;
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
  const response = await api.post<CompletePaymentResponse>(`/v1/challenges/${challenge_id}/join`, body);
  return response.data;
};

/** 결제 뒤 계좌 발급 진행 상황 확인 */
export const getMyOrder = async (orderId: string) => {
  const response = await api.get<OrderDetail>(`/v1/challenges/orders/${encodeURIComponent(orderId)}`);
  return response.data;
};

export const ListUserOrders = async (params: ListOrdersParams) => {
  const response = await api.get<ListOrdersResponse>('/v1/challenges/orders/me', {
    params,
  });

  return response.data;
};
