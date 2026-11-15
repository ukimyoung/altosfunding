import api from './axios';

export interface DemoOptionsResponse {
  allowed_leverages: number[];
  allowed_capitals: number[];
  default_leverage: number;
  default_capital: number;
}

// 옵션 API를 아직 못 받았을 때 쓰는 값. 백엔드(Core) 기본값과 같다.
// 실제 선택지는 백오피스 '데모 계정 관리'에서 바꾼다.
export const DEMO_OPTIONS_FALLBACK: DemoOptionsResponse = {
  allowed_leverages: [100, 200, 500],
  allowed_capitals: [10000, 50000, 100000],
  default_leverage: 100,
  default_capital: 10000,
};

export interface CreateDemoAccountRequest {
  product_id: string;
  capital: number;
  leverage: number;
}

export interface CreateDemoAccountResponse {
  mt4_login: number;
  tier: string;
  status: string;
  capital: number;
  leverage_override: number;
  product_id: string;
  [key: string]: unknown;
}

export const getDemoOptions = async () => {
  const response = await api.get<DemoOptionsResponse>('/v1/demo/options');
  return response.data;
};

export const createDemoAccount = async (payload: CreateDemoAccountRequest) => {
  const response = await api.post<CreateDemoAccountResponse>('/v1/demo/accounts', payload);
  return response.data;
};
