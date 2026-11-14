import api from './axios';

export type ContactCategory =
  | 'billing'
  | 'technical'
  | 'account'
  | 'verification'
  | 'trading'
  | 'payout'
  | 'general';

export type ContactStatus = 'RECEIVED' | 'PROCESSING' | 'ANSWERED';

export interface ListContactsParams {
  q?: string | null;
  category?: ContactCategory | null;
  status?: ContactStatus | null;
  page?: number;
  size?: number;
}

export interface AdminContact {
  id: number;
  name: string;
  email: string;
  subject: string;
  category: ContactCategory;
  status: ContactStatus;
  created_at: string;
}

export interface AdminContactDetail extends AdminContact {
  message: string;
  reply_draft: string | null;
  reply_body: string | null;
  replied_at: string | null;
  replied_by: string | null;
  replied_by_name: string | null;
  user_id: string | null;
}

export interface UpdateContactDraftRequest {
  reply_draft: string;
}

export interface SendContactReplyRequest {
  reply_body: string;
}

export interface ListContactsResponse {
  items: AdminContact[];
  total: number;
  page: number;
  size: number;
  pages: number;
  unanswered_count?: number;
}

export const listContacts = async (
  params: ListContactsParams = {},
): Promise<ListContactsResponse> => {
  const page = params.page ?? 1;
  const size = params.size ?? 20;
  const response = await api.get<ListContactsResponse>('/v1/admin/contacts', {
    params: { ...params, page, size },
  });

  return response.data;
};

export const getContact = async (contactId: number): Promise<AdminContactDetail> => {
  const response = await api.get<AdminContactDetail>(`/v1/admin/contacts/${contactId}`);

  return response.data;
};

export const updateContactDraft = async (
  contactId: number,
  payload: UpdateContactDraftRequest,
): Promise<AdminContactDetail> => {
  const response = await api.patch<AdminContactDetail>(
    `/v1/admin/contacts/${contactId}/draft`,
    payload,
  );

  return response.data;
};

export const sendContactReply = async (
  contactId: number,
  payload: SendContactReplyRequest,
): Promise<AdminContactDetail> => {
  const response = await api.post<AdminContactDetail>(
    `/v1/admin/contacts/${contactId}/reply`,
    payload,
  );

  return response.data;
};
