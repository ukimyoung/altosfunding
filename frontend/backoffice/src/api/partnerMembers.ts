import api from './axios';

// 트레이더 관리 > 제휴사 회원 — Core /api/v1/admin/partner-members
// 제휴사(10Power·xnsoft) 회원 조회 API에서 가져온 회원과 가져오기 실행·이력.

export type PartnerSite = '10power' | 'xnsoft';
export type PartnerStatus = 'active' | 'unconfirmed' | 'suspended' | 'deleted';
export type SyncMode = 'INCREMENTAL' | 'FULL';
export type SyncStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export interface PartnerMember {
  member_id: string;
  site: PartnerSite;
  name: string;
  email: string | null;
  phone: string | null;
  sponsor_member_id: string | null;
  status: PartnerStatus;
  joined_at: string;
  membership_expires_on: string | null;
  membership_active: boolean;
  partner_updated_at: string;
  last_synced_at: string;
  user_id: string | null;
  user_uid: string | null;
  user_email: string | null;
  user_status: string | null;
  activated_at: string | null;
}

export interface PartnerMemberPage {
  items: PartnerMember[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface PartnerMemberSummary {
  total: number;
  status: Record<PartnerStatus, number>;
  linked: number;
  membership_active: number;
  no_email: number;
}

export interface SyncRun {
  id: number;
  mode: SyncMode;
  status: SyncStatus;
  requested_by: string | null;
  requested_by_email: string | null;
  since: string | null;
  as_of: string | null;
  pages: number;
  fetched: number;
  inserted: number;
  updated: number;
  unchanged: number;
  failed: number;
  deactivated: number;
  reactivated: number;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface SyncRunDetail extends SyncRun {
  failures: { member_id: string; reason: string }[];
}

export interface SyncRunPage {
  items: SyncRun[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface SyncState {
  configured: boolean;
  mock: boolean;
  interval_minutes: number;
  running: SyncRun | null;
  last_succeeded: SyncRun | null;
  next_auto_at: string | null;
}

export interface PartnerMemberParams {
  keyword?: string;
  site?: PartnerSite;
  status?: PartnerStatus;
  linked?: boolean;
  membership?: 'active' | 'expired' | 'none';
  page?: number;
  size?: number;
}

const BASE = '/v1/admin/partner-members';

export const getPartnerMembers = async (params: PartnerMemberParams) =>
  (await api.get<PartnerMemberPage>(BASE, { params })).data;

export const getPartnerMemberSummary = async () =>
  (await api.get<PartnerMemberSummary>(`${BASE}/summary`)).data;

export const getSyncState = async () => (await api.get<SyncState>(`${BASE}/sync`)).data;

export const startSync = async (mode: SyncMode) => (await api.post<SyncRun>(`${BASE}/sync`, { mode })).data;

export const getSyncRuns = async (page: number, size = 20) =>
  (await api.get<SyncRunPage>(`${BASE}/sync-runs`, { params: { page, size } })).data;

export const getSyncRun = async (id: number) => (await api.get<SyncRunDetail>(`${BASE}/sync-runs/${id}`)).data;
