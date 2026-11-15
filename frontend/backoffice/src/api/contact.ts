import api from './axios';

// 카테고리 code. '카테고리 관리'에서 추가할 수 있다 (기본: billing, technical, account, verification, trading, payout, general).
export type ContactCategory = string;

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

// ── 카테고리 관리 ────────────────────────────────────────────

export interface ContactCategoryLocale {
  name: string;
}

export interface AdminContactCategory {
  id: string;
  code: string;
  name: string;
  sort_order: number;
  contact_count: number;
  locales: Record<string, ContactCategoryLocale>;
}

interface ServerContactCategory {
  id: string | number;
  code: string;
  name?: string | null;
  sort_order?: number | null;
  contact_count?: number | null;
  locales?: Record<string, Partial<ContactCategoryLocale> | null> | null;
}

export interface SaveContactCategoryRequest {
  name?: string;
  locales?: Record<string, ContactCategoryLocale>;
}

const normalizeContactCategory = (category: ServerContactCategory): AdminContactCategory => {
  const locales = Object.fromEntries(
    Object.entries(category.locales ?? {}).map(([code, locale]) => [code, { name: locale?.name ?? '' }]),
  );

  return {
    id: String(category.id),
    code: category.code,
    name: category.name ?? locales.en?.name ?? category.code,
    sort_order: category.sort_order ?? 0,
    contact_count: category.contact_count ?? 0,
    locales,
  };
};

export const listContactCategories = async (): Promise<AdminContactCategory[]> => {
  const response = await api.get<ServerContactCategory[]>('/v1/admin/contacts/categories');

  return response.data.map(normalizeContactCategory);
};

export const createContactCategory = async (
  payload: SaveContactCategoryRequest,
): Promise<AdminContactCategory> => {
  const response = await api.post<ServerContactCategory>('/v1/admin/contacts/categories', payload);

  return normalizeContactCategory(response.data);
};

export const updateContactCategory = async (
  categoryId: string,
  payload: SaveContactCategoryRequest,
): Promise<AdminContactCategory> => {
  const response = await api.put<ServerContactCategory>(
    `/v1/admin/contacts/categories/${categoryId}`,
    payload,
  );

  return normalizeContactCategory(response.data);
};

export const deleteContactCategory = async (categoryId: string): Promise<void> => {
  await api.delete(`/v1/admin/contacts/categories/${categoryId}`);
};

export const reorderContactCategories = async (orderedIds: number[]): Promise<void> => {
  await api.put('/v1/admin/contacts/categories/reorder', { ordered_ids: orderedIds });
};
