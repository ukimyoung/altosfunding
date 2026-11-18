import axios from 'axios';
import api from './axios';

// 챌린지 대회 자동 생성 스케줄과 휴장일 (Core /admin/schedules, /admin/holidays).
// 시각(start_time, end_time)은 모두 UTC "HH:MM:SS"이다.

export type ScheduleStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED';

export interface ChallengeSchedule {
  id: number;
  name_template: string;
  product_id: string;
  /** 대회 정원. null이면 무제한 */
  group_size: number | null;
  interval_days: number;
  interval_minutes: number | null;
  duration_days: number;
  duration_minutes: number | null;
  start_time: string;
  end_time: string;
  exclude_holiday: boolean;
  max_occurrences: number | null;
  status: ScheduleStatus;
  created_count: number;
  last_created_at: string | null;
  next_run_at: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChallengeSchedulePage {
  items: ChallengeSchedule[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface ScheduleInput {
  name_template: string;
  product_id: string;
  group_size: number | null;
  interval_days: number;
  duration_days: number;
  start_time: string;
  end_time: string;
  exclude_holiday: boolean;
  max_occurrences: number | null;
  description: string | null;
}

export interface ScheduleTriggerResult {
  created: boolean;
  reason: string | null;
  challenge: { challenge_id: string; name: string; start_at: string; end_at: string } | null;
  schedule: ChallengeSchedule;
}

/** 휴장 기간 [start_at, end_at) (UTC ISO 문자열) */
export interface Holiday {
  id: number;
  start_at: string;
  end_at: string;
  name: string;
  is_active: boolean;
}

export interface HolidayInput {
  start_at: string;
  end_at: string;
  name: string;
}

export const listSchedules = async (): Promise<ChallengeSchedulePage> => {
  const response = await api.get<ChallengeSchedulePage>('/v1/admin/schedules', {
    params: { page: 1, size: 100 },
  });
  return response.data;
};

export const createSchedule = async (payload: ScheduleInput): Promise<ChallengeSchedule> => {
  const response = await api.post<ChallengeSchedule>('/v1/admin/schedules', payload);
  return response.data;
};

export const updateSchedule = async (
  id: number,
  payload: Partial<ScheduleInput> & { status?: 'ACTIVE' | 'PAUSED' },
): Promise<ChallengeSchedule> => {
  const response = await api.patch<ChallengeSchedule>(`/v1/admin/schedules/${id}`, payload);
  return response.data;
};

/** 지우지 않고 일시중지(PAUSED)한다. 이미 만든 대회는 그대로 진행된다. */
export const pauseSchedule = async (id: number): Promise<ChallengeSchedule> => {
  const response = await api.delete<ChallengeSchedule>(`/v1/admin/schedules/${id}`);
  return response.data;
};

/** 다음 대회를 기다리지 않고 지금 만든다. 모집 중인 대회가 있으면 만들지 않는다. */
export const triggerSchedule = async (id: number): Promise<ScheduleTriggerResult> => {
  const response = await api.post<ScheduleTriggerResult>(`/v1/admin/schedules/${id}/trigger`);
  return response.data;
};

export const listHolidays = async (year: number): Promise<Holiday[]> => {
  const response = await api.get<Holiday[]>('/v1/admin/holidays', { params: { year } });
  return response.data;
};

export const createHoliday = async (payload: HolidayInput): Promise<Holiday> => {
  const response = await api.post<Holiday>('/v1/admin/holidays', payload);
  return response.data;
};

export const updateHoliday = async (
  id: number,
  payload: Partial<HolidayInput> & { is_active?: boolean },
): Promise<Holiday> => {
  const response = await api.patch<Holiday>(`/v1/admin/holidays/${id}`, payload);
  return response.data;
};

export const deleteHoliday = async (id: number): Promise<void> => {
  await api.delete(`/v1/admin/holidays/${id}`);
};

const ERROR_MESSAGES: Record<string, string> = {
  product_not_found: '상품을 찾을 수 없습니다.',
  invalid_product_tier: '챌린지 상품만 선택할 수 있습니다.',
  invalid_duration: '진행 기간은 1일 이상이어야 합니다.',
  invalid_name_template: '대회 이름 규칙 형식이 올바르지 않습니다.',
  invalid_holiday_period: '종료 시각은 시작 시각보다 뒤여야 합니다.',
  no_trading_day: '휴장 기간이 너무 길어 대회를 만들 수 있는 날이 없습니다.',
};

/** 스케줄·휴장일 API 오류를 화면에 보여 줄 문구로 바꾼다. */
export const getScheduleApiErrorMessage = (error: unknown, fallback: string) => {
  if (!axios.isAxiosError<{ message?: string; error_code?: string }>(error)) return fallback;
  const code = error.response?.data?.error_code;
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  if (code === 'validation_error' || error.response?.status === 422) return '입력값을 확인해 주세요.';
  if (error.response?.status === 409) return '이미 등록된 값입니다.';
  return error.response?.data?.message || fallback;
};
