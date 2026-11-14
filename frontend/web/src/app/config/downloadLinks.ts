export type DownloadPlatformCategory = 'desktop' | 'mobile';

export type DownloadPlatformLink = {
  id: 'windows' | 'macos' | 'android' | 'ios';
  name: string;
  description: string;
  category: DownloadPlatformCategory;
  actionLabel: string;
  href: string;
};

export const downloadPlatformLinks: DownloadPlatformLink[] = [
  {
    id: 'windows',
    name: 'Windows',
    description: 'For Windows 7 or later',
    category: 'desktop',
    actionLabel: 'Download',
    href: 'https://downloads.altosfunding.com/mt4/mexnlimited4setup.exe',
  },
  {
    id: 'macos',
    name: 'macOS',
    description: 'For macOS 10.13 or later',
    category: 'desktop',
    actionLabel: 'Download',
    href: 'https://download.terminal.free/cdn/web/metaquotes.software.corp/mt4/MetaTrader4.pkg.zip',
  },
  {
    id: 'android',
    name: 'Android',
    description: 'For Android 6.0 or later',
    category: 'mobile',
    actionLabel: 'Google Play',
    href: 'https://play.google.com/store/apps/details?id=net.metaquotes.metatrader4',
  },
  {
    id: 'ios',
    name: 'iOS',
    description: 'For iOS 13.0 or later',
    category: 'mobile',
    actionLabel: 'App Store',
    href: 'https://apps.apple.com/app/metatrader-4/id496212596',
  },
];
