import api from './axios';

export type CatalogProductTierType = 'CHALLENGE' | 'FUNDED' | 'DEMO' | 'LIVE';

export interface CatalogProduct {
  product_id: string;
  name: string | null;
  description: string | null;
  capital: number | null;
  price_usdt: number | null;
  discount_price_usdt?: number | null;
  tier_type: CatalogProductTierType;
  is_active: boolean;
  is_most_popular?: boolean;
  mt4_group: string | null;
  mt4_login_pool_start: number | null;
  mt4_login_pool_end: number | null;
  margin_call_pct: number | null;
  stop_out_pct: number | null;
  ruleset_id: string | null;
  ruleset_name: string | null;
  /** 펀디드 상품에만: 연관 챌린지 상품 id (예: 1001) */
  related_id?: string | null;
  funding_start_delay_hours: number | null;
  leverage: number | null;
  duration_days: number | null;
}

export interface ListCatalogProductsParams {
  page?: number;
  size?: number;
  tier_type: CatalogProductTierType;
  /** true면 활성 상품만 */
  active_only?: boolean;
}

export interface ListCatalogProductsResponse {
  items: CatalogProduct[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface UpdateCatalogProductStatusRequest {
  is_active: boolean;
}

export interface CreateCatalogProductRequest {
  name?: string | null;
  price_usdt?: number | null;
  discount_price_usdt?: number | null;
  is_most_popular?: boolean | null;
  tier_type?: CatalogProductTierType | null;
  mt4_group?: string | null;
  capital?: number | null;
  leverage?: number | null;
  duration_days?: number | null;
  margin_call_pct?: number | null;
  stop_out_pct?: number | null;
  funding_start_delay_hours?: number | null;
  mt4_login_pool_start?: number | null;
  mt4_login_pool_end?: number | null;
  ruleset_id?: string | null;
  related_id?: string | null;
}

export type UpdateCatalogProductRequest = Omit<CreateCatalogProductRequest, 'tier_type'>;

const removeEmptyCatalogProductFields = <T extends CreateCatalogProductRequest>(
  payload: T,
): T =>
  Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== '' && value != null),
  ) as T;

const removeUndefinedCatalogProductFields = <T extends UpdateCatalogProductRequest>(
  payload: T,
): T =>
  Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  ) as T;

export const listCatalogProducts = async (
  params: ListCatalogProductsParams,
): Promise<ListCatalogProductsResponse> => {
  const page = params.page ?? 1;
  const size = params.size ?? 20;
  const response = await api.get<ListCatalogProductsResponse>('/v1/catalog/products', {
    params: {
      ...params,
      page,
      size,
    },
  });

  return response.data;
};

export const updateCatalogProductStatus = async (
  productId: string,
  payload: UpdateCatalogProductStatusRequest,
): Promise<void> => {
  await api.patch(`/v1/catalog/products/${productId}/status`, payload);
};

export const createCatalogProduct = async (
  payload: CreateCatalogProductRequest,
): Promise<void> => {
  const requestParams = removeEmptyCatalogProductFields(payload);

  await api.post('/v1/catalog/products', requestParams);
};

export const updateCatalogProduct = async (
  productId: string,
  payload: UpdateCatalogProductRequest,
): Promise<void> => {
  const requestParams = removeUndefinedCatalogProductFields(payload);

  await api.put(`/v1/catalog/products/${productId}`, requestParams);
};
