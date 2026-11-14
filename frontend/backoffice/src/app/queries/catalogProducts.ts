import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createCatalogProduct,
  listCatalogProducts,
  updateCatalogProduct,
  updateCatalogProductStatus,
} from '@/api/catalogProduct';
import type {
  CreateCatalogProductRequest,
  ListCatalogProductsParams,
  UpdateCatalogProductRequest,
  UpdateCatalogProductStatusRequest,
} from '@/api/catalogProduct';
import { rulesetsQueryKeys } from './rulesets';

export const catalogProductsQueryKeys = {
  all: ['catalog', 'products'] as const,
  list: (params: ListCatalogProductsParams) =>
    [...catalogProductsQueryKeys.all, 'list', params] as const,
};

export function useListCatalogProductsQuery(params: ListCatalogProductsParams) {
  return useQuery({
    queryKey: catalogProductsQueryKeys.list(params),
    queryFn: () => listCatalogProducts(params),
    placeholderData: keepPreviousData,
  });
}

export function useUpdateCatalogProductStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      productId,
      payload,
    }: {
      productId: string;
      payload: UpdateCatalogProductStatusRequest;
    }) => updateCatalogProductStatus(productId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: catalogProductsQueryKeys.all });
    },
  });
}

export function useCreateCatalogProductMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateCatalogProductRequest) => createCatalogProduct(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: catalogProductsQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: rulesetsQueryKeys.listRulesetsRoot() });
    },
  });
}

export function useUpdateCatalogProductMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      productId,
      payload,
    }: {
      productId: string;
      payload: UpdateCatalogProductRequest;
    }) => updateCatalogProduct(productId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: catalogProductsQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: rulesetsQueryKeys.listRulesetsRoot() });
    },
  });
}
