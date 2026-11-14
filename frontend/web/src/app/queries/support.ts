import { useMutation, useQuery } from '@tanstack/react-query';
import {
  getContentLanguages,
  getFAQCategories,
  getFAQs,
  submitContact,
  type ContactRequest,
  type GetFAQParams,
} from '@/api/support';
import type { Locale } from '@/app/i18n/translations';

export const supportQueryKeys = {
  all: ['support'] as const,
  contentLanguages: () => [...supportQueryKeys.all, 'content-languages'] as const,
  faqCategories: (locale?: Locale) => [...supportQueryKeys.all, 'faq-categories', locale] as const,
  faqs: (params?: GetFAQParams, locale?: Locale) =>
    [...supportQueryKeys.all, 'faqs', params, locale] as const,
};

export function useSubmitContactMutation() {
  return useMutation({
    mutationFn: (payload: ContactRequest) => submitContact(payload),
  });
}

export function useContentLanguagesQuery() {
  return useQuery({
    queryKey: supportQueryKeys.contentLanguages(),
    queryFn: getContentLanguages,
    retry: false,
  });
}

export function useFAQCategoriesQuery(locale?: Locale) {
  return useQuery({
    queryKey: supportQueryKeys.faqCategories(locale),
    queryFn: getFAQCategories,
    retry: false,
  });
}

export function useFAQsQuery(params?: GetFAQParams, locale?: Locale) {
  return useQuery({
    queryKey: supportQueryKeys.faqs(params, locale),
    queryFn: () => getFAQs(params),
    retry: false,
  });
}
