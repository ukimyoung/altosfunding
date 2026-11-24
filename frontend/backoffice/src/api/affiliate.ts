import api from './axios';

// 재무/정산 > 제휴 프로그램(IB) · 운영 관리 > 마케팅 비율 관리 — Core /api/v1/admin/affiliate

export type IbStatus = 'ACTIVE' | 'INACTIVE' | 'BANNED';

export interface UserBrief {
  user_id: string;
  uid: string;
  name: string | null;
  email: string;
}

export interface IbPartner extends UserBrief {
  phone: string | null;
  level: number;
  status: IbStatus;
  registered_at: string;
  upline: UserBrief | null;
  downline_ibs: UserBrief[];
  downline_ib_count: number;
  downline_count: number;
  commission_total: number;
}

export interface IbPartnerList {
  items: IbPartner[];
  total: number;
  page: number;
  size: number;
  summary: { total: number; active: number; inactive: number; banned: number };
}

export interface IbCandidate extends UserBrief {
  is_ib: boolean;
  upline: UserBrief | null;
}

export interface NetworkNode extends UserBrief {
  depth: number;
  is_ib: boolean;
  level: number | null;
  ib_status: IbStatus | null;
  member_status: string;
  commission_total: number;
  children: NetworkNode[];
}

export interface NetworkResponse {
  root: NetworkNode;
  total: number;
  active: number;
  truncated: boolean;
}

export interface LevelRateSet {
  id: number;
  version: number;
  effective_from: string;
  reason: string | null;
  actor_name: string | null;
  created_at: string;
  rates?: { level: number; rate: number }[];
}

export interface LevelRatesOverview {
  current: LevelRateSet | null;
  scheduled: LevelRateSet[];
  history: LevelRateSet[];
  marketing_rate: number | null;
}

export interface MarketingVersion {
  id: number;
  version: number;
  rate: number;
  effective_from: string;
  reason: string;
  actor_name: string | null;
  created_at: string;
}

export interface MarketingOverview {
  current: MarketingVersion | null;
  scheduled: MarketingVersion[];
  history: MarketingVersion[];
}

export interface CommissionItem {
  id: number;
  created_at: string;
  order_id: string;
  product_name: string | null;
  base_amount: number;
  buyer: UserBrief | null;
  ib: UserBrief | null;
  depth: number;
  level: number | null;
  level_rate: number | null;
  prev_max_rate: number;
  applied_rate: number;
  amount: number;
  clawed_back_amount: number;
  net_amount: number;
  status: 'CREDITED' | 'PARTIAL_CLAWBACK' | 'CLAWED_BACK';
}

export interface CommissionList {
  items: CommissionItem[];
  total: number;
  page: number;
  size: number;
  summary: { paid: number; clawed_back: number; net: number };
}

export interface CommissionFlowLine {
  depth: number;
  member: UserBrief | null;
  is_ib: boolean;
  level: number | null;
  ib_status: IbStatus | null;
  member_status: string;
  level_rate: number | null;
  prev_max_rate: number;
  applied_rate: number;
  amount: number;
  clawed_back_amount: number;
  result: 'PAID' | 'ZERO' | 'SKIPPED_NOT_IB' | 'SKIPPED_INACTIVE';
}

export interface CommissionFlow {
  id: number;
  order_id: string;
  product_name: string | null;
  created_at: string;
  buyer: UserBrief | null;
  base_amount: number;
  marketing_rate: number;
  budget: number;
  paid_amount: number;
  retained_amount: number;
  refunded_base: number;
  clawed_back_amount: number;
  lines?: CommissionFlowLine[];
}

const BASE = '/v1/admin/affiliate';

export const listPartners = async (params: { keyword?: string; status?: IbStatus; page?: number; size?: number }) =>
  (await api.get<IbPartnerList>(`${BASE}/partners`, { params })).data;

export const searchCandidates = async (keyword: string) =>
  (await api.get<{ items: IbCandidate[] }>(`${BASE}/partners/candidates`, { params: { keyword } })).data.items;

export const addPartner = async (body: { user_id: string; level: number; status: IbStatus }) =>
  (await api.post<IbPartner>(`${BASE}/partners`, body)).data;

export const updatePartner = async (userId: string, body: { level?: number; status?: IbStatus; reason?: string }) =>
  (await api.patch<IbPartner>(`${BASE}/partners/${userId}`, body)).data;

export const getNetwork = async (params: { user_id?: string; keyword?: string }) =>
  (await api.get<NetworkResponse>(`${BASE}/network`, { params })).data;

export const relocate = async (body: { member_id: string; new_parent_id: string; reason: string }) =>
  (await api.post<IbPartner>(`${BASE}/network/relocate`, body)).data;

export const getLevelRates = async () => (await api.get<LevelRatesOverview>(`${BASE}/level-rates`)).data;

export const saveLevelRates = async (body: { rates: { level: number; rate: number }[]; effective_from?: string; reason?: string }) =>
  (await api.put<LevelRatesOverview>(`${BASE}/level-rates`, body)).data;

export const getMarketingPolicy = async () => (await api.get<MarketingOverview>(`${BASE}/marketing-policy`)).data;

export const createMarketingPolicy = async (body: { rate: number; effective_from?: string; reason: string }) =>
  (await api.post<MarketingOverview>(`${BASE}/marketing-policy`, body)).data;

export const listCommissions = async (params: { keyword?: string; start_date?: string; end_date?: string; page?: number; size?: number }) =>
  (await api.get<CommissionList>(`${BASE}/commissions`, { params })).data;

export const listCommissionFlows = async (params: { keyword?: string; page?: number; size?: number }) =>
  (await api.get<{ items: CommissionFlow[]; total: number }>(`${BASE}/commission-flows`, { params })).data;

export const getCommissionFlow = async (orderId: string) =>
  (await api.get<CommissionFlow>(`${BASE}/commission-flows/${encodeURIComponent(orderId)}`)).data;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

export const apiErrorMessage = (error: unknown, fallback: string) => {
  const data = isRecord(error) && isRecord(error.response) && isRecord(error.response.data) ? error.response.data : null;
  if (typeof data?.message === 'string') return data.message;
  return fallback;
};

/** ISO 시각 → 'YYYY-MM-DD HH:mm' (KST) */
export const formatKst = (value: string | null | undefined, withSeconds = false) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', ...(withSeconds ? { second: '2-digit' } : {}), hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour') === '24' ? '00' : get('hour')}:${get('minute')}${withSeconds ? `:${get('second')}` : ''}`;
};

/** datetime-local 값(KST로 입력) → ISO */
export const kstLocalToIso = (value: string) => (value ? new Date(`${value}:00+09:00`).toISOString() : undefined);

export const usd = (value: number | null | undefined) =>
  `$${(value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const pct = (value: number | null | undefined) => `${Number((value ?? 0).toFixed(4))}%`;
