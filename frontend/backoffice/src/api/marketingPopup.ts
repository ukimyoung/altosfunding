import api from './axios';

export type AdminMarketingPopupExposureLocation =
  | 'BEFORE_LOGIN'
  | 'AFTER_LOGIN'
  | 'ALL';

export type AdminMarketingPopupStatus = 'PUBLISHED' | 'DRAFT';

export interface AdminMarketingPopup {
  id: string | number;
  title: string;
  image_url: string;
  landing_url?: string | null;
  exposure_location: AdminMarketingPopupExposureLocation;
  status: AdminMarketingPopupStatus;
  display_order: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CreateMarketingPopupRequest {
  title: string;
  image: File;
  landing_url: string;
  exposure_location: AdminMarketingPopupExposureLocation;
  status: AdminMarketingPopupStatus;
  display_order: number;
}

export interface UpdateMarketingPopupRequest {
  title?: string;
  landing_url?: string;
  exposure_location?: AdminMarketingPopupExposureLocation;
  status?: AdminMarketingPopupStatus;
  display_order?: number;
}

export interface ReorderMarketingPopupItem {
  id: number;
  display_order: number;
}

export async function listMarketingPopups(): Promise<AdminMarketingPopup[]> {
  const response = await api.get<AdminMarketingPopup[]>('/v1/admin/marketing-popups');

  return response.data;
}

export async function createMarketingPopup(
  payload: CreateMarketingPopupRequest,
): Promise<AdminMarketingPopup> {
  const formData = new FormData();
  formData.append('title', payload.title);
  formData.append('image', payload.image);
  formData.append('landing_url', payload.landing_url);
  formData.append('exposure_location', payload.exposure_location);
  formData.append('status', payload.status);
  formData.append('display_order', String(payload.display_order));

  const response = await api.post<AdminMarketingPopup>('/v1/admin/marketing-popups', formData);
  return response.data;
}

export async function updateMarketingPopup(
  popupId: string,
  payload: UpdateMarketingPopupRequest,
): Promise<AdminMarketingPopup> {
  const response = await api.put<AdminMarketingPopup>(
    `/v1/admin/marketing-popups/${popupId}`,
    payload,
  );

  return response.data;
}

export async function reorderMarketingPopups(
  payload: ReorderMarketingPopupItem[],
): Promise<void> {
  await api.patch('/v1/admin/marketing-popups/reorder', payload);
}

export async function deleteMarketingPopup(popupId: string): Promise<void> {
  await api.delete(`/v1/admin/marketing-popups/${popupId}`);
}
