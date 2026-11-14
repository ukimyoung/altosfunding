import axios, { AxiosError, InternalAxiosRequestConfig, type AxiosRequestConfig } from 'axios';
import { clearAccessToken, getAccessToken, setAccessToken } from '../auth/tokenStore';

interface RefreshTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
}

/** 요청별로 줄 수 있는 추가 옵션 */
export type ApiRequestConfig = AxiosRequestConfig & {
  /** true면 토큰 재발급이 실패해도 로그인 페이지로 이동하지 않는다. */
  skipAuthRedirect?: boolean;
};

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean; skipAuthRedirect?: boolean };

export interface ApiClientOptions {
  /** API 요청 기준 경로. 기본값 '/api' (개발 서버는 Vite proxy, 운영은 같은 도메인의 리버스 프록시) */
  baseURL?: string;
  /** access token 재발급 경로 (baseURL 기준). 기본값 '/v1/auth/refresh' */
  refreshPath?: string;
  /** 인증이 끝내 실패했을 때 이동할 경로. 기본값 '/login' */
  loginPath?: string;
  /** X-Timezone 헤더 값. 없으면 헤더를 보내지 않는다. */
  getTimeZone?: () => string | undefined;
  /** Accept-Language 헤더 값. 없으면 헤더를 보내지 않는다. */
  getLocale?: () => string | undefined;
  /** 현재 페이지가 로그인·회원가입처럼 리다이렉트하면 안 되는 페이지인지 */
  isAuthPage?: () => boolean;
}

/**
 * 인증 처리가 들어간 axios 인스턴스를 만든다.
 * - 메모리의 access token을 Authorization 헤더에 붙인다.
 * - 401이 오면 refresh token 쿠키로 access token을 한 번만 재발급받아 원래 요청을 다시 보낸다.
 *   동시에 여러 요청이 401을 받아도 재발급 요청은 하나만 나간다.
 * - 재발급도 실패하면 토큰을 지우고 loginPath로 이동한다.
 */
export function createApiClient(options: ApiClientOptions = {}) {
  const {
    baseURL = '/api',
    refreshPath = '/v1/auth/refresh',
    loginPath = '/login',
    getTimeZone,
    getLocale,
    isAuthPage = () => false,
  } = options;

  const api = axios.create({
    baseURL,
    withCredentials: true, // refresh token 쿠키를 함께 주고받기 위해 필요하다.
  });

  let refreshPromise: Promise<string> | null = null;

  const requestTokenRefresh = (): Promise<string> => {
    if (!refreshPromise) {
      refreshPromise = axios
        .post<RefreshTokenResponse>(`${baseURL}${refreshPath}`, {}, { withCredentials: true })
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

  const redirectToLogin = () => {
    if (typeof window === 'undefined' || isAuthPage()) {
      return;
    }
    window.location.assign(loginPath);
  };

  api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const accessToken = getAccessToken();
      if (accessToken) {
        config.headers.set('Authorization', `Bearer ${accessToken}`);
      }

      const timeZone = getTimeZone?.();
      if (timeZone) {
        config.headers.set('X-Timezone', timeZone);
      }

      const locale = getLocale?.();
      if (locale) {
        config.headers.set('Accept-Language', locale);
      }

      return config;
    },
    (error: AxiosError) => Promise.reject(error),
  );

  api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as RetriableConfig | undefined;

      if (!originalRequest) {
        return Promise.reject(error);
      }

      // 재발급 요청 자체가 실패하면 무한 루프를 막기 위해 바로 로그아웃 처리한다.
      if (originalRequest.url?.includes(refreshPath)) {
        clearAccessToken();
        redirectToLogin();
        return Promise.reject(error);
      }

      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const accessToken = await requestTokenRefresh();
          originalRequest.headers.set('Authorization', `Bearer ${accessToken}`);
          return api(originalRequest);
        } catch (refreshError) {
          clearAccessToken();
          if (!originalRequest.skipAuthRedirect) {
            redirectToLogin();
          }
          return Promise.reject(refreshError);
        }
      }

      return Promise.reject(error);
    },
  );

  return api;
}
