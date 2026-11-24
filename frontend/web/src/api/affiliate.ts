import api from './axios';

// My Page > Affiliate Program — Core /api/v1/affiliate (IB 회원만)

export type IbStatus = 'ACTIVE' | 'INACTIVE' | 'BANNED';

export type AffiliateMe =
  | { is_ib: false }
  | {
      is_ib: true;
      uid: string;
      level: number;
      status: IbStatus;
      commission_rate: number;
      total_commission: number;
      network_total: number;
      network_active: number;
    };

export interface AffiliateNetworkNode {
  uid: string;
  name: string;
  email: string;
  depth: number;
  is_ib: boolean;
  level: number | null;
  ib_status: IbStatus | null;
  member_status: string;
  /** 이 회원(과 그 아래)의 구매로 내가 받은 순 커미션 */
  commission: number;
  children: AffiliateNetworkNode[];
}

export interface AffiliateNetworkResponse {
  root: AffiliateNetworkNode;
  total: number;
  active: number;
  truncated: boolean;
}

export interface AffiliateCommission {
  id: number;
  created_at: string;
  order_id: string;
  product_name: string | null;
  buyer: { uid: string; name: string; email: string } | null;
  /** 구매자에서 나까지 몇 단계 위인지 (1 = 직속) */
  depth: number;
  base_amount: number;
  applied_rate: number;
  amount: number;
  clawed_back_amount: number;
  net_amount: number;
  status: 'COMPLETED' | 'PARTIAL_REFUND' | 'REFUNDED';
}

export interface AffiliateCommissionList {
  items: AffiliateCommission[];
  total: number;
  page: number;
  size: number;
  summary: { paid: number; clawed_back: number; net: number };
}

export interface AffiliateCommissionParams {
  keyword?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  size?: number;
}

export async function getAffiliateMe() {
  const response = await api.get<AffiliateMe>('/v1/affiliate/me');
  return response.data;
}

export async function getAffiliateNetwork() {
  const response = await api.get<AffiliateNetworkResponse>('/v1/affiliate/network');
  return response.data;
}

export async function getAffiliateCommissions(params: AffiliateCommissionParams) {
  const response = await api.get<AffiliateCommissionList>('/v1/affiliate/commissions', { params });
  return response.data;
}
