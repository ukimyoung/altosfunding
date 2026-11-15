import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createContactCategory,
  deleteContactCategory,
  getContact,
  listContactCategories,
  listContacts,
  reorderContactCategories,
  sendContactReply,
  updateContactCategory,
  updateContactDraft,
} from '@/api/contact';
import type {
  ListContactsParams,
  SaveContactCategoryRequest,
  SendContactReplyRequest,
  UpdateContactDraftRequest,
} from '@/api/contact';

export const contactQueryKeys = {
  all: ['admin', 'contacts'] as const,
  lists: () => [...contactQueryKeys.all, 'list'] as const,
  list: (params: ListContactsParams) => [...contactQueryKeys.lists(), params] as const,
  detail: (contactId: number) => [...contactQueryKeys.all, 'detail', contactId] as const,
  categories: () => [...contactQueryKeys.all, 'categories'] as const,
};

export function useContactsQuery(params: ListContactsParams) {
  return useQuery({
    queryKey: contactQueryKeys.list(params),
    queryFn: () => listContacts(params),
    placeholderData: keepPreviousData,
  });
}

export function useContactQuery(contactId: number | null) {
  return useQuery({
    queryKey: contactQueryKeys.detail(contactId ?? 0),
    queryFn: () => getContact(contactId ?? 0),
    enabled: typeof contactId === 'number',
  });
}

export function useUpdateContactDraftMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      contactId,
      payload,
    }: {
      contactId: number;
      payload: UpdateContactDraftRequest;
    }) => updateContactDraft(contactId, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(contactQueryKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: contactQueryKeys.lists() });
    },
  });
}

export function useSendContactReplyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      contactId,
      payload,
    }: {
      contactId: number;
      payload: SendContactReplyRequest;
    }) => sendContactReply(contactId, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(contactQueryKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: contactQueryKeys.lists() });
    },
  });
}

export function useContactCategoriesQuery() {
  return useQuery({
    queryKey: contactQueryKeys.categories(),
    queryFn: listContactCategories,
  });
}

function useCategoryMutation<TVariables, TData>(mutationFn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contactQueryKeys.categories() });
    },
  });
}

export function useCreateContactCategoryMutation() {
  return useCategoryMutation((payload: SaveContactCategoryRequest) => createContactCategory(payload));
}

export function useUpdateContactCategoryMutation() {
  return useCategoryMutation(
    ({ categoryId, payload }: { categoryId: string; payload: SaveContactCategoryRequest }) =>
      updateContactCategory(categoryId, payload),
  );
}

export function useDeleteContactCategoryMutation() {
  return useCategoryMutation((categoryId: string) => deleteContactCategory(categoryId));
}

export function useReorderContactCategoriesMutation() {
  return useCategoryMutation((orderedIds: number[]) => reorderContactCategories(orderedIds));
}
