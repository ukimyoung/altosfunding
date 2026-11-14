const GOOGLE_LOGIN_PATH = '/api/v1/auth/google/login';
const GOOGLE_AUTH_IN_PROGRESS_KEY = 'googleAuthInProgress';

export function navigateToGoogleAuth() {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

  if (!apiBaseUrl) {
    throw new Error('VITE_API_BASE_URL is not configured.');
  }

  const authUrl = new URL(GOOGLE_LOGIN_PATH, apiBaseUrl);

  authUrl.searchParams.set('prompt', 'select_account');
  authUrl.searchParams.set('state', `${window.location.origin}`);

  sessionStorage.setItem(GOOGLE_AUTH_IN_PROGRESS_KEY, 'true');
  window.location.assign(authUrl.toString());
}

export function consumeGoogleAuthInProgress() {
  const isInProgress = sessionStorage.getItem(GOOGLE_AUTH_IN_PROGRESS_KEY) === 'true';

  sessionStorage.removeItem(GOOGLE_AUTH_IN_PROGRESS_KEY);

  return isInProgress;
}

export function clearGoogleAuthInProgress() {
  sessionStorage.removeItem(GOOGLE_AUTH_IN_PROGRESS_KEY);
}
