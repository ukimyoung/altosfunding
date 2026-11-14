import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAnnouncementCategory,
  createAnnouncement,
  deleteAnnouncementCategory,
  deleteAnnouncement,
  getAnnouncement,
  listAllAnnouncements,
  listAnnouncementCategories,
  listAnnouncements,
  reorderAnnouncements,
  reorderAnnouncementCategories,
  updateAnnouncementCategory,
  updateAnnouncement,
} from '@/api/announcement';
import type {
  CreateAnnouncementCategoryRequest,
  CreateAnnouncementRequest,
  ListAnnouncementsParams,
  ReorderAnnouncementsRequest,
  ReorderAnnouncementCategoriesRequest,
  UpdateAnnouncementCategoryRequest,
  UpdateAnnouncementRequest,
} from '@/api/announcement';

export const announcementsQueryKeys = {
  all: ['admin', 'announcements'] as const,
  listRoot: () => [...announcementsQueryKeys.all, 'list'] as const,
  list: (params: ListAnnouncementsParams) =>
    [...announcementsQueryKeys.listRoot(), params] as const,
  detail: (announcementId: string) =>
    [...announcementsQueryKeys.all, 'detail', announcementId] as const,
  categories: () => [...announcementsQueryKeys.all, 'categories'] as const,
};

export function useListAnnouncementsQuery(params: ListAnnouncementsParams = {}) {
  return useQuery({
    queryKey: announcementsQueryKeys.list(params),
    queryFn: () => listAnnouncements(params),
  });
}

export function useListAllAnnouncementsMutation() {
  return useMutation({
    mutationFn: (params: Omit<ListAnnouncementsParams, 'page' | 'size'> = {}) =>
      listAllAnnouncements(params),
  });
}

export function useAnnouncementQuery(announcementId: string | null, enabled = true) {
  return useQuery({
    queryKey: announcementsQueryKeys.detail(announcementId ?? ''),
    queryFn: () => getAnnouncement(announcementId ?? ''),
    enabled: enabled && Boolean(announcementId),
  });
}

export function useListAnnouncementCategoriesQuery() {
  return useQuery({
    queryKey: announcementsQueryKeys.categories(),
    queryFn: listAnnouncementCategories,
  });
}

export function useCreateAnnouncementMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateAnnouncementRequest) => createAnnouncement(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: announcementsQueryKeys.listRoot() });
      void queryClient.invalidateQueries({ queryKey: announcementsQueryKeys.categories() });
    },
  });
}

const invalidateAnnouncementCategories = (queryClient: ReturnType<typeof useQueryClient>) => {
  void queryClient.invalidateQueries({ queryKey: announcementsQueryKeys.categories() });
  void queryClient.invalidateQueries({ queryKey: announcementsQueryKeys.listRoot() });
};

export function useCreateAnnouncementCategoryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateAnnouncementCategoryRequest) =>
      createAnnouncementCategory(payload),
    onSuccess: () => {
      invalidateAnnouncementCategories(queryClient);
    },
  });
}

export function useUpdateAnnouncementCategoryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      categoryId,
      payload,
    }: {
      categoryId: string;
      payload: UpdateAnnouncementCategoryRequest;
    }) => updateAnnouncementCategory(categoryId, payload),
    onSuccess: () => {
      invalidateAnnouncementCategories(queryClient);
    },
  });
}

export function useDeleteAnnouncementCategoryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (categoryId: string) => deleteAnnouncementCategory(categoryId),
    onSuccess: () => {
      invalidateAnnouncementCategories(queryClient);
    },
  });
}

export function useReorderAnnouncementCategoriesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ReorderAnnouncementCategoriesRequest) =>
      reorderAnnouncementCategories(payload),
    onSuccess: () => {
      invalidateAnnouncementCategories(queryClient);
    },
  });
}

export function useReorderAnnouncementsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ReorderAnnouncementsRequest) => reorderAnnouncements(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: announcementsQueryKeys.listRoot() });
    },
  });
}

export function useUpdateAnnouncementMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      announcementId,
      payload,
    }: {
      announcementId: string;
      payload: UpdateAnnouncementRequest;
    }) => updateAnnouncement(announcementId, payload),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: announcementsQueryKeys.listRoot() });
      void queryClient.invalidateQueries({ queryKey: announcementsQueryKeys.categories() });
      void queryClient.invalidateQueries({
        queryKey: announcementsQueryKeys.detail(variables.announcementId),
      });
    },
  });
}

export function useDeleteAnnouncementMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (announcementId: string) => deleteAnnouncement(announcementId),
    onSuccess: (_, announcementId) => {
      void queryClient.invalidateQueries({ queryKey: announcementsQueryKeys.listRoot() });
      void queryClient.invalidateQueries({ queryKey: announcementsQueryKeys.categories() });
      void queryClient.removeQueries({
        queryKey: announcementsQueryKeys.detail(announcementId),
      });
    },
  });
}
