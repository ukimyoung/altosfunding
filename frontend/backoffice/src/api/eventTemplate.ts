import api from './axios';

export type EventTemplateChannel = 'email' | 'telegram' | 'push' | string;
export type EventTemplatePriority = 'low' | 'normal' | 'high' | 'critical' | string;
export type EventTemplateSendMode = 'instant' | 'delay' | 'delayed' | string;

export type EventTemplateLocale = 'en' | 'ko';

export interface EventTemplate {
  template_id: string;
  template_name: string;
  description: string | null;
  is_system?: boolean;
  rule: {
    event_type: string;
  };
  locales: Record<string, EventTemplateLocaleContent>;
}

export interface EventTemplateListResponse {
  items: EventTemplate[];
}

export interface EventType {
  id: string;
  name: string;
}

export interface ListEventTypesResponse {
  events: EventType[];
}

export interface EventTemplateDetailRule {
  event_type: string;
  send_mode: EventTemplateSendMode;
  delay_minutes: number;
  is_active: boolean;
  event_name: string | null;
  channels?: EventTemplateChannel[];
  priority?: EventTemplatePriority;
}

export interface EventTemplateLocaleContent {
  subject: string;
  html_content: string;
}

export interface EventTemplateDetailResponse {
  template_id: string;
  template_name: string;
  description: string | null;
  is_system?: boolean;
  variables?: string[];
  rule: EventTemplateDetailRule;
  locales: Record<string, EventTemplateLocaleContent>;
}

export interface CreateEventTemplatePayload {
  template_id: string;
  template_name: string;
  description: string;
  rule: {
    send_mode: EventTemplateSendMode;
    delay_minutes: number;
  };
  variables?: string[];
  locales: Record<string, EventTemplateLocaleContent>;
}

export interface UpdateEventTemplatePayload {
  template_name: string;
  description: string;
  rule: {
    event_type: string;
    is_active: boolean;
    event_name: string;
    send_mode: EventTemplateSendMode;
    delay_minutes: number;
  };
  locales: Record<string, EventTemplateLocaleContent>;
}

export type NotificationLogStatus = 'SENT' | 'FAILED';

export interface ListNotificationLogsParams {
  event_type?: string;
  /** SENT | FAILED */
  status?: NotificationLogStatus;
  /** 수신자 이메일 / 제목 */
  keyword?: string;
  start_date?: string;
  end_date?: string;
  /** 같은 묶음(수동 발송 등)을 한 줄로 */
  group_by_batch?: boolean;
  /** 한 묶음의 수신자별 이력 */
  trace_id?: string;
  page?: number;
  page_size?: number;
}

export interface NotificationLog {
  /** 한 통의 이력 id (묶음 보기에서는 한 통뿐인 묶음만) */
  id?: number | null;
  trace_id: string | null;
  recipient?: string | null;
  /** 묶음 보기에서는 일부 실패면 PARTIAL */
  status?: NotificationLogStatus | 'PARTIAL';
  error_message?: string | null;
  locale?: string | null;
  provider?: string;
  provider_message_id?: string | null;
  user_id?: string | null;
  user_uid?: string | null;
  event_type: string;
  subject: string;
  total_count: number;
  success_count: number;
  failed_count: number;
  sent_at: string;
  template_name: string | null;
  event_name: string | null;
  send_mode: EventTemplateSendMode;
  delay_minutes: number;
}

export interface ListNotificationLogsResponse {
  total: number;
  page: number;
  page_size: number;
  /** 필터 조건 전체의 발송 건수 요약 */
  summary?: { total: number; sent: number; failed: number };
  items: NotificationLog[];
}

export interface PreviewEventTemplatePayload {
  content_html: string;
  subject?: string;
  locale?: string;
}

export interface PreviewEventTemplateResponse {
  html: string;
  subject: string | null;
}

export const listEventTemplates = async (): Promise<EventTemplateListResponse> => {
  const response = await api.get<EventTemplateListResponse>('/v1/admin/templates', {});
  return response.data;
};

export const listEventTypes = async (): Promise<ListEventTypesResponse> => {
  const response = await api.get<ListEventTypesResponse>('/v1/admin/events');
  return response.data;
};

export const getEventTemplateDetail = async (
  templateId: string,
): Promise<EventTemplateDetailResponse> => {
  const response = await api.get<EventTemplateDetailResponse>(`/v1/admin/templates/${templateId}`);
  return response.data;
};

export const updateEventTemplate = async (
  templateId: string,
  payload: UpdateEventTemplatePayload,
): Promise<EventTemplateDetailResponse> => {
  const response = await api.put<EventTemplateDetailResponse>(
    `/v1/admin/templates/${templateId}`,
    payload,
  );
  return response.data;
};

export const createEventTemplate = async (
  payload: CreateEventTemplatePayload,
): Promise<EventTemplateDetailResponse> => {
  const response = await api.post<EventTemplateDetailResponse>('/v1/admin/templates', payload);
  return response.data;
};

export const listNotificationLogs = async (
  params: ListNotificationLogsParams,
): Promise<ListNotificationLogsResponse> => {
  const response = await api.get<ListNotificationLogsResponse>('/v1/admin/logs', {
    params,
  });
  return response.data;
};

export const getNotificationLog = async (logId: number): Promise<NotificationLog> => {
  const response = await api.get<NotificationLog>(`/v1/admin/logs/${logId}`);
  return response.data;
};

export const previewEventTemplate = async (
  payload: PreviewEventTemplatePayload,
): Promise<string> => {
  const response = await api.post<PreviewEventTemplateResponse>('/v1/admin/templates/preview', payload);
  return response.data.html;
};
