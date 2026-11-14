import api from './axios';

const MANUAL_SEND_BASE = '/v1/admin/notifications/manual-send';
const MANUAL_EMAIL_IMAGE_UPLOAD_ENDPOINT = '/v1/admin/files';
const MANUAL_EMAIL_IMAGE_STORAGE = 'local'; // 추후 s3 생각 해야함.
const MANUAL_EMAIL_IMAGE_REF_DOMAIN = 'manual_send';

export type ManualEmailTargetMode = 'filter_all' | 'manual_input' | 'csv_import';
export type ManualEmailGrade = 'ALL' | 'NORMAL' | 'VIP';
export type ManualEmailChallengeTypeCode = 'ALL' | '100' | '300' | '500' | string;
export type ManualEmailDraftStatus = 'draft' | 'sent' | 'expired';
export type ManualEmailJobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'partial_failed'
  | 'failed'
  | 'cancelled';

export interface ManualEmailFilter {
  email?: string;
  joined_from?: string;
  joined_to?: string;
  unsubscribed_from?: string;
  unsubscribed_to?: string;
  grade?: ManualEmailGrade;
  challenge_type_code?: ManualEmailChallengeTypeCode;
  marketing_preview?: boolean;
  newsletter_filter?: 'ALL' | 'SUBSCRIBED' | 'UNSUBSCRIBED' | string;
  page?: number;
  page_size?: number;
}

export interface ManualEmailLocaleContent {
  subject: string;
  html_content: string;
}

export interface ManualEmailDraftPayload {
  target_mode: ManualEmailTargetMode;
  filter?: ManualEmailFilter;
  manual_entries?: string[];
  import_id?: string;
  is_marketing?: boolean;
  is_urgent?: boolean;
  content_locales: Record<string, ManualEmailLocaleContent>;
  preview_locale?: string;
  sample_user_name?: string;
  send_at?: string | null;
}

export interface ManualEmailRecipientPreview {
  user_id: string | null;
  email: string;
  user_name: string | null;
  grade: ManualEmailGrade | string;
  auth_provider?: string | null;
  auth_provider_label?: string | null;
  account_count?: number;
  joined_at?: string | null;
  subscribed_newsletter: boolean;
  newsletter_unsubscribed_at?: string | null;
  eligible: boolean;
  skip_reason: string | null;
  skip_reason_label: string | null;
}

export interface ManualEmailRecipientSummary {
  total: number;
  eligible: number;
  skipped: number;
  items?: ManualEmailRecipientPreview[];
  preview?: ManualEmailRecipientPreview[];
  csv_rows: number | null;
}

export interface ManualEmailContentPreview {
  locale: string;
  subject_rendered: string;
  html_rendered: string;
}

export interface ManualEmailDraftResponse {
  draft_id: string;
  status: ManualEmailDraftStatus;
  target_mode: ManualEmailTargetMode;
  filter: ManualEmailFilter | null;
  manual_entries: string[] | null;
  import_id: string | null;
  is_marketing: boolean;
  is_urgent: boolean;
  content_locales: Record<string, ManualEmailLocaleContent>;
  preview_locale: string;
  sample_user_name: string;
  recipient_summary: ManualEmailRecipientSummary;
  content_preview: ManualEmailContentPreview;
  send_at: string | null;
  job_id: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface ManualEmailDraftListResponse {
  items: ManualEmailDraftResponse[];
}

export interface ManualEmailSearchResponse {
  total: number;
  eligible: number;
  subscribed_count: number;
  unsubscribed_count: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: ManualEmailRecipientPreview[];
  filters_applied: ManualEmailFilter;
}

export interface ManualEmailSendResponse {
  job_id: string;
  trace_id: string;
  recipient_count: number;
  skipped_count: number;
  scheduled_at: string | null;
  status: ManualEmailJobStatus;
}

export interface ManualEmailJobStatusResponse {
  job_id: string;
  status: ManualEmailJobStatus;
  recipient_total: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  started_at: string | null;
  completed_at: string | null;
  trace_id: string;
  target_mode: ManualEmailTargetMode;
  is_marketing: boolean;
  is_urgent: boolean;
  send_at: string | null;
}

interface ManualEmailImageUploadResponse {
  id: string;
  storage: 's3' | 'local';
  url: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  ref_domain: string | null;
  ref_id: string | null;
  created_at: string;
  created_by: string | null;
}

export const searchManualEmailRecipients = async (
  payload: ManualEmailFilter,
): Promise<ManualEmailSearchResponse> => {
  const endpoint = `${MANUAL_SEND_BASE}/recipients/search`;
  const response = await api.post<ManualEmailSearchResponse>(endpoint, payload);
  return response.data;
};

export const searchManualEmailUnsubscribedRecipients = async (
  payload: ManualEmailFilter,
): Promise<ManualEmailSearchResponse> => {
  const endpoint = `${MANUAL_SEND_BASE}/recipients/unsubscribed/search`;
  const response = await api.post<ManualEmailSearchResponse>(endpoint, payload);
  return response.data;
};

export const exportManualEmailRecipients = async (params: ManualEmailFilter): Promise<void> => {
  const endpoint = `${MANUAL_SEND_BASE}/recipients/export`;
  const response = await api.get<Blob>(endpoint, { params, responseType: 'blob' });
  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = '조건_검색_결과.csv';
  anchor.click();
  URL.revokeObjectURL(url);
};

export const createManualEmailDraft = async (
  payload: ManualEmailDraftPayload,
): Promise<ManualEmailDraftResponse> => {
  const endpoint = `${MANUAL_SEND_BASE}/drafts`;
  const response = await api.post<ManualEmailDraftResponse>(endpoint, payload);
  return response.data;
};

export const createManualEmailDraftWithCsv = async ({
  payload,
  file,
}: {
  payload: ManualEmailDraftPayload;
  file: File;
}): Promise<ManualEmailDraftResponse> => {
  const endpoint = `${MANUAL_SEND_BASE}/drafts`;
  const formData = new FormData();
  formData.append('payload', JSON.stringify(payload));
  formData.append('file', file);

  const response = await api.post<ManualEmailDraftResponse>(endpoint, formData);
  return response.data;
};

export const listManualEmailDrafts = async (): Promise<ManualEmailDraftListResponse> => {
  const endpoint = `${MANUAL_SEND_BASE}/drafts`;
  const response = await api.get<ManualEmailDraftListResponse>(endpoint);
  return response.data;
};

export const uploadManualEmailImage = async ({
  file,
  draftId,
}: {
  file: Blob | File;
  draftId?: string | null;
}): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post<ManualEmailImageUploadResponse>(
    MANUAL_EMAIL_IMAGE_UPLOAD_ENDPOINT,
    formData,
    {
      params: {
        storage: MANUAL_EMAIL_IMAGE_STORAGE,
        ref_domain: MANUAL_EMAIL_IMAGE_REF_DOMAIN,
        ...(draftId ? { ref_id: draftId } : {}),
      },
    },
  );
  const imageUrl = response.data.url;

  if (!imageUrl) {
    throw new Error('Manual email image upload response does not include a URL.');
  }

  return imageUrl;
};

export const updateManualEmailDraft = async ({
  draftId,
  payload,
}: {
  draftId: string;
  payload: Partial<ManualEmailDraftPayload>;
}): Promise<ManualEmailDraftResponse> => {
  const endpoint = `${MANUAL_SEND_BASE}/drafts/${draftId}`;
  const response = await api.patch<ManualEmailDraftResponse>(endpoint, payload);
  return response.data;
};

export const sendManualEmailDraft = async (draftId: string): Promise<ManualEmailSendResponse> => {
  const endpoint = `${MANUAL_SEND_BASE}/drafts/${draftId}/send`;
  const response = await api.post<ManualEmailSendResponse>(endpoint);
  return response.data;
};

export const getManualEmailJob = async (jobId: string): Promise<ManualEmailJobStatusResponse> => {
  const endpoint = `${MANUAL_SEND_BASE}/jobs/${jobId}`;
  const response = await api.get<ManualEmailJobStatusResponse>(endpoint);
  return response.data;
};
