export interface DownloadPlatformTranslations {
  // Page header (section box)
  pageTitle: string;
  pageSubtitle: string;

  // Hero banner
  bannerBadge: string;
  bannerTitlePre: string;       // "Trade with " (EN) | "" (KO — name comes first)
  bannerTitleHighlight: string; // "MetaTrader 4" — always blue
  bannerTitlePost: string;      // "" (EN) | "와 함께하는 거래" (KO)
  bannerDescription: string;

  // Feature checkmarks
  featureFreeDownload: string;
  featureAllDevices: string;
  featureSupport: string;

  // Device tabs
  tabDesktop: string;
  tabMobile: string;

  // Desktop platform cards
  windowsName: string;
  windowsDesc: string;
  macosName: string;
  macosDesc: string;
  downloadBtn: string;

  // Mobile platform cards
  androidName: string;
  androidDesc: string;
  googlePlayBtn: string;
  iosName: string;
  iosDesc: string;
  appStoreBtn: string;
}
