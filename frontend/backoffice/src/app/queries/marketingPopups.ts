import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createMarketingPopup,
  deleteMarketingPopup,
  listMarketingPopups,
  reorderMarketingPopups,
  updateMarketingPopup,
} from '@/api/marketingPopup';
import type {
  AdminMarketingPopup,
  AdminMarketingPopupExposureLocation,
  CreateMarketingPopupRequest,
  ReorderMarketingPopupItem,
  UpdateMarketingPopupRequest,
} from '@/api/marketingPopup';
import type { DisplayLocation, PopupBanner } from '@/app/types/marketingPopup';

export const marketingPopupQueryKeys = {
  all: ['admin', 'marketing-popups'] as const,
  list: () => [...marketingPopupQueryKeys.all, 'list'] as const,
};

function normalizeLocations(
  location: AdminMarketingPopupExposureLocation,
): DisplayLocation[] {
  if (location === 'BEFORE_LOGIN') return ['before_login'];
  if (location === 'AFTER_LOGIN') return ['after_login'];
  return ['before_login', 'after_login'];
}

function normalizeMarketingPopup(popup: AdminMarketingPopup): PopupBanner {
  return {
    id: String(popup.id),
    title: popup.title,
    imageUrl: popup.image_url,
    landingUrl: popup.landing_url ?? '',
    locations: normalizeLocations(popup.exposure_location),
    status: popup.status === 'PUBLISHED' ? 'active' : 'inactive',
  };
}

export function useMarketingPopupsQuery() {
  return useQuery({
    queryKey: marketingPopupQueryKeys.list(),
    queryFn: async () => {
      const popups = await listMarketingPopups();

      return [...popups]
        .sort((a, b) => a.display_order - b.display_order)
        .map(normalizeMarketingPopup);
    },
  });
}

export function useCreateMarketingPopupMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateMarketingPopupRequest) => createMarketingPopup(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: marketingPopupQueryKeys.list() });
    },
  });
}

export function useUpdateMarketingPopupMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      popupId,
      payload,
    }: {
      popupId: string;
      payload: UpdateMarketingPopupRequest;
    }) => updateMarketingPopup(popupId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: marketingPopupQueryKeys.list() });
    },
  });
}

export function useReorderMarketingPopupsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ReorderMarketingPopupItem[]) => reorderMarketingPopups(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: marketingPopupQueryKeys.list() });
    },
  });
}

export function useDeleteMarketingPopupMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (popupId: string) => deleteMarketingPopup(popupId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: marketingPopupQueryKeys.list() });
    },
  });
}
