import api from './axios';

export interface AdminFaqCategory {
  id: string;
  name: string;
  sort_order: number;
  faq_count: number;
  locales: Record<string, FaqCategoryLocale>;
}

export type AdminFaqStatus = 'PUBLISHED' | 'HIDDEN';

export interface AdminFaqItem {
  id: string;
  sort_order: number;
  question: string;
  category_id: string;
  category_name: string;
  status: AdminFaqStatus | null;
  created_at: string | null;
  updated_at: string | null;
  author: string | null;
  answer: string;
  locales: Record<string, FaqLocale>;
}

export interface FaqLocale {
  question: string;
  answer: string;
}

export interface FaqCategoryLocale {
  name: string;
}

export interface ListFaqItemsParams {
  category_id?: string | number;
  status?: AdminFaqStatus;
  q?: string;
  page?: number;
  size?: number;
}

export interface ListFaqItemsResponse {
  items: AdminFaqItem[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface UpsertFaqItemRequest {
  question?: string;
  answer?: string;
  category_id: number;
  status?: AdminFaqStatus;
  locales?: Record<string, FaqLocale>;
}

export interface ReorderFaqItemsRequest {
  ordered_ids: number[];
}

export interface ReorderFaqCategoriesRequest {
  ordered_ids: number[];
}

export interface CreateFaqCategoryRequest {
  name?: string;
  locales?: Record<string, FaqCategoryLocale>;
}

export type UpdateFaqCategoryRequest = Partial<CreateFaqCategoryRequest>;

interface ServerFaqCategory {
  id: string | number;
  name?: string | null;
  sort_order?: number | null;
  faq_count?: number | null;
  locales?: Record<string, Partial<FaqCategoryLocale> | null> | null;
}

interface ServerFaqItem {
  id: string | number;
  sort_order?: number | null;
  question?: string | null;
  category_id?: string | number | null;
  category_name?: string | null;
  status?: AdminFaqStatus | string | null;
  created_at?: string | null;
  updated_at?: string | null;
  author?: string | null;
  author_name?: string | null;
  created_by?: string | null;
  answer?: string | null;
  locales?: Record<string, Partial<FaqLocale> | null> | null;
}

interface ServerFaqItemsPage {
  items: ServerFaqItem[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

const normalizeFaqCategory = (category: ServerFaqCategory): AdminFaqCategory => {
  const locales = Object.fromEntries(
    Object.entries(category.locales ?? {}).map(([code, locale]) => [
      code,
      {
        name: locale?.name ?? '',
      },
    ]),
  );
  const enLocale = locales.en;

  return {
    id: String(category.id),
    name: category.name ?? enLocale?.name ?? '',
    sort_order: category.sort_order ?? 0,
    faq_count: category.faq_count ?? 0,
    locales,
  };
};

const normalizeFaqStatus = (status: ServerFaqItem['status']): AdminFaqStatus | null => {
  if (status === 'PUBLISHED' || status === 'HIDDEN') return status;
  return null;
};

const normalizeFaqItem = (item: ServerFaqItem): AdminFaqItem => {
  const locales = Object.fromEntries(
    Object.entries(item.locales ?? {}).map(([code, locale]) => [
      code,
      {
        question: locale?.question ?? '',
        answer: locale?.answer ?? '',
      },
    ]),
  );
  const enLocale = locales.en;

  return {
    id: String(item.id),
    sort_order: item.sort_order ?? 0,
    question: item.question ?? enLocale?.question ?? '',
    category_id: item.category_id == null ? '' : String(item.category_id),
    category_name: item.category_name ?? '',
    status: normalizeFaqStatus(item.status),
    created_at: item.created_at ?? null,
    updated_at: item.updated_at ?? null,
    author: item.author_name ?? item.author ?? item.created_by ?? null,
    answer: item.answer ?? enLocale?.answer ?? '',
    locales,
  };
};

export const listFaqCategories = async (): Promise<AdminFaqCategory[]> => {
  const response = await api.get<ServerFaqCategory[]>('/v1/admin/faq/categories');

  return response.data.map((category) => normalizeFaqCategory(category));
};

export const listFaqItems = async (
  params: ListFaqItemsParams = {},
): Promise<ListFaqItemsResponse> => {
  const response = await api.get<ServerFaqItemsPage>('/v1/admin/faq', {
    params,
  });

  return {
    items: response.data.items.map((item) => normalizeFaqItem(item)),
    total: response.data.total,
    page: response.data.page,
    size: response.data.size,
    pages: response.data.pages,
  };
};

export const listAllFaqItems = async (): Promise<AdminFaqItem[]> => {
  const pageSize = 100;
  const firstPage = await listFaqItems({ page: 1, size: pageSize });
  const items = [...firstPage.items];

  for (let page = 2; page <= firstPage.pages; page += 1) {
    const response = await listFaqItems({ page, size: pageSize });
    items.push(...response.items);
  }

  return items.sort((a, b) => a.sort_order - b.sort_order);
};

export const getFaqItem = async (faqId: string): Promise<AdminFaqItem> => {
  const response = await api.get<ServerFaqItem>(`/v1/admin/faq/${faqId}`);

  return normalizeFaqItem(response.data);
};

export const createFaqItem = async (payload: UpsertFaqItemRequest): Promise<AdminFaqItem> => {
  const response = await api.post<ServerFaqItem>('/v1/admin/faq', payload);

  return normalizeFaqItem(response.data);
};

export const updateFaqItem = async (
  faqId: string,
  payload: UpsertFaqItemRequest,
): Promise<AdminFaqItem> => {
  const response = await api.put<ServerFaqItem>(`/v1/admin/faq/${faqId}`, payload);

  return normalizeFaqItem(response.data);
};

export const deleteFaqItem = async (faqId: string): Promise<void> => {
  await api.delete(`/v1/admin/faq/${faqId}`);
};

export const reorderFaqItems = async (payload: ReorderFaqItemsRequest): Promise<void> => {
  await api.put('/v1/admin/faq/reorder', payload);
};

export const createFaqCategory = async (
  payload: CreateFaqCategoryRequest,
): Promise<AdminFaqCategory> => {
  const response = await api.post<ServerFaqCategory>('/v1/admin/faq/categories', payload);

  return normalizeFaqCategory(response.data);
};

export const updateFaqCategory = async (
  categoryId: string,
  payload: UpdateFaqCategoryRequest,
): Promise<AdminFaqCategory> => {
  const response = await api.put<ServerFaqCategory>(
    `/v1/admin/faq/categories/${categoryId}`,
    payload,
  );

  return normalizeFaqCategory(response.data);
};

export const deleteFaqCategory = async (categoryId: string): Promise<void> => {
  await api.delete(`/v1/admin/faq/categories/${categoryId}`);
};

export const reorderFaqCategories = async (
  payload: ReorderFaqCategoriesRequest,
): Promise<void> => {
  await api.put('/v1/admin/faq/categories/reorder', payload);
};
