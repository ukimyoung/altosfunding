import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createFaqCategory,
  createFaqItem,
  deleteFaqCategory,
  deleteFaqItem,
  getFaqItem,
  listAllFaqItems,
  listFaqCategories,
  listFaqItems,
  reorderFaqCategories,
  reorderFaqItems,
  updateFaqCategory,
  updateFaqItem,
} from '@/api/faq';
import type {
  CreateFaqCategoryRequest,
  ListFaqItemsParams,
  ReorderFaqCategoriesRequest,
  ReorderFaqItemsRequest,
  UpsertFaqItemRequest,
  UpdateFaqCategoryRequest,
} from '@/api/faq';

export const faqQueryKeys = {
  all: ['admin', 'faq'] as const,
  categories: () => [...faqQueryKeys.all, 'categories'] as const,
  itemsRoot: () => [...faqQueryKeys.all, 'items'] as const,
  items: (params: ListFaqItemsParams) => [...faqQueryKeys.itemsRoot(), params] as const,
  detail: (faqId: string) => [...faqQueryKeys.itemsRoot(), 'detail', faqId] as const,
};

const invalidateFaqItems = (queryClient: ReturnType<typeof useQueryClient>) => {
  void queryClient.invalidateQueries({ queryKey: faqQueryKeys.itemsRoot() });
};

const invalidateFaqCategories = (queryClient: ReturnType<typeof useQueryClient>) => {
  void queryClient.invalidateQueries({ queryKey: faqQueryKeys.categories() });
};

export function useListFaqCategoriesQuery() {
  return useQuery({
    queryKey: faqQueryKeys.categories(),
    queryFn: listFaqCategories,
  });
}

export function useListFaqItemsQuery(params: ListFaqItemsParams = {}) {
  return useQuery({
    queryKey: faqQueryKeys.items(params),
    queryFn: () => listFaqItems(params),
    placeholderData: keepPreviousData,
  });
}

export function useFaqItemQuery(faqId: string | null, enabled = true) {
  return useQuery({
    queryKey: faqQueryKeys.detail(faqId ?? ''),
    queryFn: () => getFaqItem(faqId ?? ''),
    enabled: enabled && Boolean(faqId),
  });
}

export function useListAllFaqItemsMutation() {
  return useMutation({
    mutationFn: listAllFaqItems,
  });
}

export function useCreateFaqCategoryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateFaqCategoryRequest) => createFaqCategory(payload),
    onSuccess: () => {
      invalidateFaqCategories(queryClient);
    },
  });
}

export function useCreateFaqItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpsertFaqItemRequest) => createFaqItem(payload),
    onSuccess: () => {
      invalidateFaqItems(queryClient);
      invalidateFaqCategories(queryClient);
    },
  });
}

export function useUpdateFaqItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ faqId, payload }: { faqId: string; payload: UpsertFaqItemRequest }) =>
      updateFaqItem(faqId, payload),
    onSuccess: (item, { faqId }) => {
      queryClient.setQueryData(faqQueryKeys.detail(faqId), item);
      invalidateFaqItems(queryClient);
      invalidateFaqCategories(queryClient);
    },
  });
}

export function useDeleteFaqItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (faqId: string) => deleteFaqItem(faqId),
    onSuccess: (_data, faqId) => {
      queryClient.removeQueries({ queryKey: faqQueryKeys.detail(faqId) });
      invalidateFaqItems(queryClient);
      invalidateFaqCategories(queryClient);
    },
  });
}

export function useReorderFaqItemsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ReorderFaqItemsRequest) => reorderFaqItems(payload),
    onSuccess: () => {
      invalidateFaqItems(queryClient);
    },
  });
}

export function useReorderFaqCategoriesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ReorderFaqCategoriesRequest) => reorderFaqCategories(payload),
    onSuccess: () => {
      invalidateFaqCategories(queryClient);
    },
  });
}

export function useUpdateFaqCategoryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      categoryId,
      payload,
    }: {
      categoryId: string;
      payload: UpdateFaqCategoryRequest;
    }) => updateFaqCategory(categoryId, payload),
    onSuccess: () => {
      invalidateFaqCategories(queryClient);
      invalidateFaqItems(queryClient);
    },
  });
}

export function useDeleteFaqCategoryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (categoryId: string) => deleteFaqCategory(categoryId),
    onSuccess: () => {
      invalidateFaqCategories(queryClient);
      invalidateFaqItems(queryClient);
    },
  });
}
