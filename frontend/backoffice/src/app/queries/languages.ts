import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createLanguage,
  listActiveLanguages,
  listLanguages,
  updateLanguage,
} from '@/api/languages';
import type { CreateLanguageRequest, UpdateLanguageRequest } from '@/api/languages';

export const languagesQueryKeys = {
  all: ['admin', 'languages'] as const,
  registered: () => [...languagesQueryKeys.all, 'registered'] as const,
  active: () => [...languagesQueryKeys.all, 'active'] as const,
};

const invalidateLanguages = (queryClient: ReturnType<typeof useQueryClient>) => {
  void queryClient.invalidateQueries({ queryKey: languagesQueryKeys.all });
};

export function useListLanguagesQuery() {
  return useQuery({
    queryKey: languagesQueryKeys.registered(),
    queryFn: listLanguages,
  });
}

export function useListActiveLanguagesQuery(enabled = true) {
  return useQuery({
    queryKey: languagesQueryKeys.active(),
    queryFn: listActiveLanguages,
    enabled,
  });
}

export function useCreateLanguageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateLanguageRequest) => createLanguage(payload),
    onSuccess: () => {
      invalidateLanguages(queryClient);
    },
  });
}

export function useUpdateLanguageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ code, payload }: { code: string; payload: UpdateLanguageRequest }) =>
      updateLanguage(code, payload),
    onSuccess: () => {
      invalidateLanguages(queryClient);
    },
  });
}
