import api from './axios';

export type AnnouncementStatus = 'PUBLISHED' | 'CLOSED';
export type AnnouncementCategory = 'Rules' | 'Maintenance' | 'Policy' | 'Update';

export interface AdminAnnouncement {
  id: string;
  category_id: string;
  title: string;
  category: string;
  sort_order: number;
  category_sort_order: number;
  status: AnnouncementStatus | null;
  is_pinned: boolean;
  content: string;
  created_at: string | null;
  updated_at: string | null;
  author: string | null;
  locales: Record<string, AnnouncementLocale>;
}

export interface ListAnnouncementsResponse {
  items: AdminAnnouncement[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface AnnouncementLocale {
  title: string;
  content: string;
}

export interface AnnouncementCategoryLocale {
  name: string;
}

export interface AdminAnnouncementCategory {
  id: string;
  name: string;
  sort_order: number;
  announcement_count: number;
  locales: Record<string, AnnouncementCategoryLocale>;
}

interface ServerAnnouncement {
  id: string | number;
  category_id?: string | number | null;
  title?: string | null;
  category?: string | null;
  category_name?: string | null;
  sort_order?: number | null;
  category_sort_order?: number | null;
  status?: AnnouncementStatus | string | null;
  is_pinned?: boolean | null;
  content?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  created_by?: string | null;
  author_name?: string | null;
  locales?: Record<string, Partial<AnnouncementLocale> | null> | null;
}

interface ServerAnnouncementCategory {
  id: string | number;
  name?: string | null;
  sort_order?: number | null;
  announcement_count?: number | null;
  locales?: Record<string, Partial<AnnouncementCategoryLocale> | null> | null;
}

export interface ListAnnouncementsParams {
  category_id?: string | number;
  status?: AnnouncementStatus;
  keyword?: string;
  page?: number;
  size?: number;
}

export interface CreateAnnouncementRequest {
  category_id: number;
  status?: AnnouncementStatus;
  is_pinned?: boolean;
  title?: string;
  content?: string;
  locales?: Record<string, AnnouncementLocale>;
}

export type UpdateAnnouncementRequest = Partial<CreateAnnouncementRequest>;

export interface CreateAnnouncementCategoryRequest {
  name?: string;
  locales?: Record<string, AnnouncementCategoryLocale>;
}

export interface UpdateAnnouncementCategoryRequest {
  name: string;
  locales: Record<string, AnnouncementCategoryLocale>;
}

export interface ReorderAnnouncementCategoriesRequest {
  ordered_ids: number[];
}

export interface ReorderAnnouncementsRequest {
  ordered_ids: number[];
  scope: 'global' | 'category';
  category_id?: number;
}

const normalizeStatus = (status: ServerAnnouncement['status']): AnnouncementStatus | null => {
  if (status === 'PUBLISHED' || status === 'CLOSED') return status;
  return null;
};

const normalizeAnnouncement = (item: ServerAnnouncement): AdminAnnouncement => {
  const locales = Object.fromEntries(
    Object.entries(item.locales ?? {}).map(([code, locale]) => [
      code,
      {
        title: locale?.title ?? '',
        content: locale?.content ?? '',
      },
    ]),
  );
  const enLocale = locales.en;

  return {
    id: String(item.id),
    category_id: item.category_id == null ? '' : String(item.category_id),
    title: item.title ?? enLocale?.title ?? '',
    category: item.category_name ?? item.category ?? '',
    sort_order: item.sort_order ?? 0,
    category_sort_order: item.category_sort_order ?? 0,
    status: normalizeStatus(item.status),
    is_pinned: item.is_pinned ?? false,
    content: item.content ?? enLocale?.content ?? '',
    created_at: item.created_at ?? null,
    updated_at: item.updated_at ?? null,
    author: item.author_name ?? null,
    locales,
  };
};

const normalizeAnnouncementCategory = (
  category: ServerAnnouncementCategory,
): AdminAnnouncementCategory => {
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
    announcement_count: category.announcement_count ?? 0,
    locales,
  };
};

export const listAnnouncements = async (
  params: ListAnnouncementsParams = {},
): Promise<ListAnnouncementsResponse> => {
  const page = params.page ?? 1;
  const size = params.size ?? 20;
  const response = await api.get<{
    items?: ServerAnnouncement[] | null;
    total?: number | null;
    page?: number | null;
    size?: number | null;
    pages?: number | null;
  }>('/v1/admin/announcements', { params: { ...params, page, size } });
  const items = (response.data.items ?? []).map((item) => normalizeAnnouncement(item));

  return {
    items,
    total: response.data.total ?? items.length,
    page: response.data.page ?? page,
    size: response.data.size ?? size,
    pages: response.data.pages ?? Math.max(1, Math.ceil((response.data.total ?? items.length) / size)),
  };
};

export const listAllAnnouncements = async (
  params: Omit<ListAnnouncementsParams, 'page' | 'size'> = {},
): Promise<AdminAnnouncement[]> => {
  const pageSize = 100;
  const firstPage = await listAnnouncements({ ...params, page: 1, size: pageSize });
  const items = [...firstPage.items];

  for (let page = 2; page <= firstPage.pages; page += 1) {
    const response = await listAnnouncements({ ...params, page, size: pageSize });
    items.push(...response.items);
  }

  return items;
};

export const getAnnouncement = async (announcementId: string): Promise<AdminAnnouncement> => {
  const response = await api.get<ServerAnnouncement>(`/v1/admin/announcements/${announcementId}`);

  return normalizeAnnouncement(response.data);
};

export const listAnnouncementCategories = async (): Promise<AdminAnnouncementCategory[]> => {
  const response = await api.get<ServerAnnouncementCategory[]>('/v1/admin/announcements/categories');

  return response.data.map((category) => normalizeAnnouncementCategory(category));
};

export const createAnnouncementCategory = async (
  payload: CreateAnnouncementCategoryRequest,
): Promise<AdminAnnouncementCategory> => {
  const response = await api.post<ServerAnnouncementCategory>(
    '/v1/admin/announcements/categories',
    payload,
  );

  return normalizeAnnouncementCategory(response.data);
};

export const updateAnnouncementCategory = async (
  categoryId: string,
  payload: UpdateAnnouncementCategoryRequest,
): Promise<AdminAnnouncementCategory> => {
  const response = await api.put<ServerAnnouncementCategory>(
    `/v1/admin/announcements/categories/${categoryId}`,
    payload,
  );

  return normalizeAnnouncementCategory(response.data);
};

export const deleteAnnouncementCategory = async (categoryId: string): Promise<void> => {
  await api.delete(`/v1/admin/announcements/categories/${categoryId}`);
};

export const reorderAnnouncementCategories = async (
  payload: ReorderAnnouncementCategoriesRequest,
): Promise<void> => {
  await api.put('/v1/admin/announcements/categories/reorder', payload);
};

export const reorderAnnouncements = async (
  payload: ReorderAnnouncementsRequest,
): Promise<void> => {
  await api.put('/v1/admin/announcements/reorder', payload);
};

export const createAnnouncement = async (payload: CreateAnnouncementRequest): Promise<void> => {
  await api.post('/v1/admin/announcements', payload);
};

export const updateAnnouncement = async (
  announcementId: string,
  payload: UpdateAnnouncementRequest,
): Promise<void> => {
  await api.put(`/v1/admin/announcements/${announcementId}`, payload);
};

export const deleteAnnouncement = async (announcementId: string): Promise<void> => {
  await api.delete(`/v1/admin/announcements/${announcementId}`);
};
