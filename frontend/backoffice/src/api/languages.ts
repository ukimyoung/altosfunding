import api from './axios';

export interface AdminLanguage {
  code: string;
  name_en: string;
  name_native: string;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface LanguageListResponse {
  items: AdminLanguage[];
  total: number;
}

export interface CreateLanguageRequest {
  code: string;
  name_en: string;
  name_native: string;
  is_active?: boolean;
  sort_order?: number;
}

export interface UpdateLanguageRequest {
  name_en?: string;
  name_native?: string;
  is_active?: boolean;
  sort_order?: number;
}

interface ServerLanguage {
  code: string;
  name_en?: string | null;
  name_native?: string | null;
  is_default?: boolean | null;
  is_active?: boolean | null;
  sort_order?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface ServerLanguageListResponse {
  items?: ServerLanguage[] | null;
  total?: number | null;
}

const normalizeLanguage = (language: ServerLanguage): AdminLanguage => ({
  code: language.code,
  name_en: language.name_en ?? language.code.toUpperCase(),
  name_native: language.name_native ?? language.name_en ?? language.code.toUpperCase(),
  is_default: language.is_default ?? language.code === 'en',
  is_active: language.is_active ?? false,
  sort_order: language.sort_order ?? 99,
  created_at: language.created_at ?? null,
  updated_at: language.updated_at ?? null,
});

const normalizeLanguageList = (response: ServerLanguageListResponse): LanguageListResponse => {
  const items = (response.items ?? []).map((language) => normalizeLanguage(language));

  return {
    items,
    total: response.total ?? items.length,
  };
};

export const listLanguages = async (): Promise<LanguageListResponse> => {
  const response = await api.get<ServerLanguageListResponse>('/v1/admin/languages');

  return normalizeLanguageList(response.data);
};

export const listActiveLanguages = async (): Promise<LanguageListResponse> => {
  const response = await api.get<ServerLanguageListResponse>('/v1/admin/languages/active');

  return normalizeLanguageList(response.data);
};

export const createLanguage = async (payload: CreateLanguageRequest): Promise<AdminLanguage> => {
  const response = await api.post<ServerLanguage>('/v1/admin/languages', payload);

  return normalizeLanguage(response.data);
};

export const updateLanguage = async (
  code: string,
  payload: UpdateLanguageRequest,
): Promise<AdminLanguage> => {
  const response = await api.patch<ServerLanguage>(`/v1/admin/languages/${code}`, payload);

  return normalizeLanguage(response.data);
};
