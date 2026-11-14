import { useQuery } from '@tanstack/react-query';
import {
  getAnnouncement,
  getAnnouncementCategories,
  getAnnouncements,
  type ListAnnouncementsParams,
} from '@/api/announcements';
import type { Locale } from '@/app/i18n/translations';

export const announcementsQueryKey = ['announcements'] as const;
export const announcementQueryKey = ['announcement'] as const;
export const announcementCategoriesQueryKey = ['announcement-categories'] as const;

export function useAnnouncementsQuery(params?: ListAnnouncementsParams, locale?: Locale) {
  return useQuery({
    queryKey: [...announcementsQueryKey, params, locale] as const,
    queryFn: () => getAnnouncements(params),
    retry: false,
  });
}

export function useAnnouncementQuery(id: number, locale?: Locale) {
  return useQuery({
    queryKey: [...announcementQueryKey, id, locale] as const,
    queryFn: () => getAnnouncement(id),
    enabled: Number.isFinite(id),
    retry: false,
  });
}

export function useAnnouncementCategoriesQuery(locale?: Locale) {
  return useQuery({
    queryKey: [...announcementCategoriesQueryKey, locale] as const,
    queryFn: getAnnouncementCategories,
    retry: false,
  });
}
