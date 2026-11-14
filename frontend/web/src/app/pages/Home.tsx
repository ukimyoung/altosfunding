import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { AlphaHero } from '../components/landing/AlphaHero';
import { AlphaHowItWorks } from '../components/landing/AlphaHowItWorks';
import { AlphaFeatures } from '../components/landing/AlphaFeatures';
import { AlphaAccountSizes } from '../components/landing/AlphaAccountSizes';
import { AlphaTestimonials } from '../components/landing/AlphaTestimonials';
import { AlphaFAQ } from '../components/landing/AlphaFAQ';
import { BannerPopup } from '../components/shared/BannerPopup';

export function Home() {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) {
      return;
    }

    const targetId = location.hash.slice(1);

    requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }, [location.hash]);

  return (
    <>
      <BannerPopup exposureLocation="BEFORE_LOGIN" />
      <AlphaHero />
      <AlphaHowItWorks />
      <AlphaFeatures />
      <AlphaAccountSizes />
      <AlphaTestimonials />
      <AlphaFAQ />
    </>
  );
}
