import api from './axios';

export type MarketingPopupLocation = 'BEFORE_LOGIN' | 'AFTER_LOGIN';

export type MarketingPopup = {
  id: number;
  title: string;
  image_url: string;
  landing_url: string;
  exposure_location: MarketingPopupLocation;
  status: 'PUBLISHED' | string;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export const getActiveMarketingPopups = async (location: MarketingPopupLocation) => {
  const response = await api.get<MarketingPopup[]>('/v1/marketing-popups/active', {
    params: { location },
  });

  return response.data;
};
