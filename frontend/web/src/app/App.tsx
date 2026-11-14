import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';
import { router } from './routes';
import { LocaleProvider, useLocale } from './i18n/LocaleContext';
import { queryClient } from './query/queryClient';

function AppRoutes() {
  const { locale } = useLocale();
  const recaptchaKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY ?? '';

  return (
    <GoogleReCaptchaProvider reCaptchaKey={recaptchaKey} language={locale}>
      <RouterProvider router={router} />
    </GoogleReCaptchaProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <AppRoutes />
      </LocaleProvider>
    </QueryClientProvider>
  );
}
