import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { clearAccessToken, getAccessToken, setAccessToken } from '../app/utils/auth/tokenStore';

interface RefreshTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type?: string;
}

const api = axios.create({
  baseURL: '/api', // Vite 개발 서버 프록시를 타기 위해 상대 경로를 사용한다.
  withCredentials: true, // refresh token 쿠키를 함께 주고받기 위해 필요하다.
});

// 한국 타임존 고정
const APP_TIMEZONE = 'Asia/Seoul';

let refreshPromise: Promise<string> | null = null;

const requestTokenRefresh = async (): Promise<string> => {
  if (!refreshPromise) {
    refreshPromise = axios
      .post<RefreshTokenResponse>('/api/v1/auth/refresh', {}, { withCredentials: true })
      .then((response) => {
        const { access_token } = response.data;
        setAccessToken(access_token);
        return access_token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

// 요청 인터셉터: 메모리에 저장된 access token이 있으면 Authorization 헤더에 붙인다.
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const accessToken = getAccessToken();

    if (accessToken && config.headers) {
      config.headers.set('Authorization', `Bearer ${accessToken}`);
    }

    if (config.headers) {
      config.headers.set('X-Timezone', APP_TIMEZONE);
    }

    return config;
  },
  (error: AxiosError) => Promise.reject(error),
);

// 응답 인터셉터: 401 발생 시 refresh token 쿠키로 access token 재발급을 시도한다.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (!error.config) {
      return Promise.reject(error);
    }

    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const requestUrl = originalRequest.url ?? '';

    if (requestUrl.includes('/v1/auth/refresh')) {
      clearAccessToken();
      window.location.assign('/login');
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const access_token = await requestTokenRefresh();
        originalRequest.headers?.set('Authorization', `Bearer ${access_token}`);

        return api(originalRequest);
      } catch (refreshError) {
        clearAccessToken();
        window.location.assign('/login');
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
