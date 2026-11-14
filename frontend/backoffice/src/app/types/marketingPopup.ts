export type DisplayLocation = "before_login" | "after_login";
export type PopupStatus = "active" | "inactive";

export interface PopupBanner {
  id: string;
  title: string;
  imageUrl: string;
  landingUrl: string;
  locations: DisplayLocation[];
  status: PopupStatus;
}

export type PopupBannerDraft = Omit<PopupBanner, "id">;

export interface PopupBannerSubmit extends PopupBannerDraft {
  imageFile: File | null;
}

export type MarketingPopupToastType = "success" | "warning";

export type MarketingPopupTheme = Record<string, string>;
