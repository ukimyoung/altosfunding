import api from './axios';
import { clearAccessToken, setAccessToken } from '@/app/utils/auth/tokenStore';

export interface LoginRequest {
  email: string;
  password: string;
  recaptcha_token?: string;
}

export interface LoginResponse {
  access_token?: string;
  refresh_token?: string;
  token_type?: 'bearer' | string;
  user_id?: string;
  role?: string;
  is_new_user?: boolean;
  requires_2fa?: boolean;
}

export const login = async (payload: LoginRequest) => {
  const response = await api.post<LoginResponse>('/v1/auth/login', payload);
  const { access_token } = response.data;

  if (access_token) {
    setAccessToken(access_token);
  }

  return response.data;
};

export type TwoFactorLoginRequest = {
  code: string;
};

export const loginTwoFactor = async (payload: TwoFactorLoginRequest) => {
  const response = await api.post<LoginResponse>('/v1/auth/2fa/login', payload);
  const { access_token } = response.data;

  if (access_token) {
    setAccessToken(access_token);
  }

  return response.data;
};

export const logout = async () => {
  try {
    const response = await api.post('/v1/auth/logout');
    return response.data;
  } finally {
    clearAccessToken();
  }
};
