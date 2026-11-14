import api from './axios';

export type EventTemplateChannel = 'email' | 'telegram' | 'push' | string;
export type EventTemplatePriority = 'low' | 'normal' | 'high' | 'critical' | string;
export type EventTemplateSendMode = 'instant' | 'delay' | 'delayed' | string;

export interface EventTemplate {
  template_id: string;
  template_name: string;
  description: string | null;
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
  rule: EventTemplateDetailRule;
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

export interface ListNotificationLogsParams {
  event_type?: string;
  start_date?: string;
  end_date?: string;
  group_by_batch?: boolean;
  page?: number;
  page_size?: number;
}

export interface NotificationLog {
  trace_id: string | null;
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
  items: NotificationLog[];
}

export interface PreviewEventTemplatePayload {
  subtitle: string;
  content_html: string;
}

export interface PreviewEventTemplateResponse {
  html: string;
  layout_name: string;
  subtitle: string;
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

export const listNotificationLogs = async (
  params: ListNotificationLogsParams,
): Promise<ListNotificationLogsResponse> => {
  const response = await api.get<ListNotificationLogsResponse>('/v1/admin/logs', {
    params,
  });
  return response.data;
};

export const previewEventTemplate = async (
  payload: PreviewEventTemplatePayload,
): Promise<string> => {
  const response = await api.post<PreviewEventTemplateResponse>(
    '/v1/admin/base-layouts/file/altos_modern/preview2',
    payload,
  );
  return response.data.html;
};
