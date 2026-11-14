// LandingLayout.tsx
import { Outlet } from 'react-router';
import { AlphaNavigation } from '../components/landing/AlphaNavigation';
import { AlphaFooter } from '../components/landing/AlphaFooter';

export function LandingLayout() {
  return (
    <>
      <AlphaNavigation />
      <Outlet />
      <AlphaFooter />
    </>
  );
}
