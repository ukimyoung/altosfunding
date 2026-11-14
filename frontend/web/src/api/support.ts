import api from './axios';

export interface ContactRequest {
  name: string;
  email: string;
  category: string;
  subject: string;
  message: string;
  recaptcha_token: string;
}

export interface ContactResponse {
  ok?: boolean;
  message_key?: string;
  [key: string]: unknown;
}

export interface FAQCategory {
  id: number;
  name: string;
  sort_order: number;
  faq_count: number;
}

export interface FAQItem {
  id: number;
  category_id: number;
  category: string;
  question: string;
  answer: string;
  sort_order: number;
}

export interface GetFAQParams {
  category_id?: number | null;
  q?: string | null;
}

export interface ContentLanguage {
  code: string;
  name_en: string;
  name_native: string;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const submitContact = async (payload: ContactRequest) => {
  const response = await api.post<ContactResponse>('/v1/support/contact', payload);

  return response.data;
};

export const getFAQCategories = async () => {
  const response = await api.get<FAQCategory[]>('/v1/support/faq/categories');

  return response.data;
};

export const getContentLanguages = async () => {
  const response = await api.get<ContentLanguage[]>('/v1/support/content-languages');

  return response.data;
};

export const getFAQs = async (params?: GetFAQParams) => {
  const queryParams = {
    ...(params?.category_id != null ? { category_id: params.category_id } : {}),
    ...(params?.q ? { q: params.q } : {}),
  };

  const response = await api.get<FAQItem[]>('/v1/support/faq', {
    params: queryParams,
  });

  return response.data;
};
