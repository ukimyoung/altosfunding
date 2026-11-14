import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getContact, listContacts, sendContactReply, updateContactDraft } from '@/api/contact';
import type {
  ListContactsParams,
  SendContactReplyRequest,
  UpdateContactDraftRequest,
} from '@/api/contact';

export const contactQueryKeys = {
  all: ['admin', 'contacts'] as const,
  lists: () => [...contactQueryKeys.all, 'list'] as const,
  list: (params: ListContactsParams) => [...contactQueryKeys.lists(), params] as const,
  detail: (contactId: number) => [...contactQueryKeys.all, 'detail', contactId] as const,
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
