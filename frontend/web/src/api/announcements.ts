import api from './axios';

export type AnnouncementItem = {
  id: number;
  category_id?: number | null;
  title: string;
  category: string;
  status: string;
  is_pinned: boolean;
  content: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  author_name?: string | null;
  previous_id?: number | null;
  previous_title?: string | null;
  next_id?: number | null;
  next_title?: string | null;
};

export type ListAnnouncementsParams = {
  keyword?: string;
  page?: number;
  size?: number;
};

export type AnnouncementsResponse = {
  items: AnnouncementItem[];
  total: number;
  page: number;
  size: number;
  pages: number;
};

export type AnnouncementCategory = {
  id: number;
  name: string;
  sort_order: number;
  announcement_count: number;
  locale: string;
  locales?: Record<string, { name?: string | null }>;
};

export const getAnnouncements = async (params?: ListAnnouncementsParams) => {
  const response = await api.get<AnnouncementsResponse>('/v1/announcements', {
    params,
  });

  return response.data;
};

export const getAnnouncementCategories = async () => {
  const response = await api.get<AnnouncementCategory[]>('/v1/announcements/categories');

  return response.data;
};

export const getAnnouncement = async (id: number) => {
  const response = await api.get<AnnouncementItem>(`/v1/announcements/${id}`);

  return response.data;
};
