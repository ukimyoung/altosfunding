import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { MarketingPopupLocation } from '@/api/marketingPopups';
import { useActiveMarketingPopupsQuery } from '@/app/queries/marketingPopups';
import { getNextBrowserMidnight } from '@/app/utils/date';
import { useLocale } from '@/app/i18n/LocaleContext';

const getPopupStorageKey = (location: MarketingPopupLocation) =>
  `altos:marketing-popup:hidden-until:${location}`;

const shouldHidePopup = (location: MarketingPopupLocation) => {
  try {
    const storageKey = getPopupStorageKey(location);
    const storedValue = window.localStorage.getItem(storageKey);

    if (!storedValue) return false;

    const hiddenUntil = JSON.parse(storedValue) as { expiresAt?: unknown };

    if (typeof hiddenUntil.expiresAt === 'number' && Date.now() < hiddenUntil.expiresAt) {
      return true;
    }

    window.localStorage.removeItem(storageKey);
  } catch {
    // If storage is unavailable or corrupted, show the popup normally.
  }

  return false;
};

export function BannerPopup({ exposureLocation }: { exposureLocation: MarketingPopupLocation }) {
  const { T } = useLocale();
  const text = T.marketingPopup;
  const [isOpen, setIsOpen] = useState(() => !shouldHidePopup(exposureLocation));
  const [currentIndex, setCurrentIndex] = useState(0);
  const { data } = useActiveMarketingPopupsQuery(exposureLocation);
  const banners = [...(data ?? [])]
    .sort((a, b) => a.display_order - b.display_order);

  useEffect(() => {
    if (!isOpen || banners.length === 0) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [banners.length, isOpen]);

  useEffect(() => {
    setCurrentIndex(0);
  }, [exposureLocation]);

  if (!isOpen || banners.length === 0) return null;
  const displayedIndex = Math.min(currentIndex, banners.length - 1);
  const currentBanner = banners[displayedIndex];
  const close = () => setIsOpen(false);
  const hideForToday = () => {
    try {
      window.localStorage.setItem(
        getPopupStorageKey(exposureLocation),
        JSON.stringify(getNextBrowserMidnight()),
      );
    } catch {
      // Closing still works when localStorage is unavailable.
    }

    close();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="이벤트 배너">
      <div className="w-full max-w-[410px] overflow-hidden rounded-2xl border border-white/15 bg-[#0f0f17] shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
        <div className="relative overflow-hidden bg-[#090910]">
          <img src={currentBanner.image_url} alt="" className="aspect-[4/5] w-full object-cover" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black via-black/70 to-transparent" />
          <button
            type="button"
            onClick={close}
            className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75"
            aria-label="배너 닫기"
          >
            <X size={21} />
          </button>
          <div className="absolute inset-x-0 bottom-0 z-10 px-3 pb-11 text-left">
            <div className="relative px-2 py-3">
              <div className="pointer-events-none absolute -inset-x-2 -inset-y-1 bg-black/30 blur-xl" />
              <h2 className="relative max-w-full whitespace-normal break-words text-[22px] font-bold leading-[1.3] text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] [overflow-wrap:anywhere] sm:text-[26px]">
                {currentBanner.title}
              </h2>
              <a
                href={currentBanner.landing_url}
                className="relative mt-5 inline-block text-sm font-semibold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] transition-colors hover:text-white/75"
              >
                {text.viewDetails} →
              </a>
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-4 z-10 flex justify-center gap-2" aria-label="배너 페이지">
            {banners.map((banner, index) => <button key={banner.id} type="button" onClick={() => setCurrentIndex(index)} className={`h-1.5 rounded-full transition-all ${index === displayedIndex ? 'w-7 bg-white' : 'w-1.5 bg-white/30'}`} aria-label={`${index + 1}번째 배너 보기`} aria-current={index === displayedIndex ? 'true' : undefined} />)}
          </div>
          {banners.length > 1 && <>
            <button type="button" onClick={() => setCurrentIndex((displayedIndex - 1 + banners.length) % banners.length)} className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75" aria-label="이전 배너"><ChevronLeft size={22} /></button>
            <button type="button" onClick={() => setCurrentIndex((displayedIndex + 1) % banners.length)} className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75" aria-label="다음 배너"><ChevronRight size={22} /></button>
          </>}
        </div>
        <div className="flex h-14 items-center justify-between border-t border-white/10 px-5">
          <button type="button" onClick={hideForToday} className="text-sm font-medium text-gray-300 transition-colors hover:text-white">{text.doNotShowAgainToday}</button>
          <button type="button" onClick={close} className="text-sm font-semibold text-white transition-colors hover:text-[#00ff94]">{text.close}</button>
        </div>
      </div>
    </div>
  );
}
