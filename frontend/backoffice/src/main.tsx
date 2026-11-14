import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';
import { router } from './app/routes';
import { queryClient } from './app/query/queryClient';
import './styles/index.css';

const app = (
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
  </QueryClientProvider>
);

const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

createRoot(document.getElementById('root')!).render(
  recaptchaSiteKey ? (
    <GoogleReCaptchaProvider
      reCaptchaKey={recaptchaSiteKey}
      scriptProps={{ async: true, defer: true, appendTo: 'head' }}
    >
      {app}
    </GoogleReCaptchaProvider>
  ) : (
    app
  ),
);
