import api from './axios';

// 회원가입 최종 요청 body 형태
export interface RegisterRequest {
  email: string;
  password: string;
  agree_to_terms: boolean;
  subscribe_newsletter: boolean;
  referral_code: string;
  auth_provider: 'LOCAL';
  first_name: string;
  last_name: string;
  country: string;
  city: string;
  state_province: string;
  address_line1: string;
  address_line2: string;
  zip_code: string;
  phone: string;
}

// Step1 화면에서 입력받는 값
export interface SignUpStep1Data {
  email: string;
  password: string;
  agreeToTerms: boolean;
  subscribeNewsletter: boolean;
}

// Step2 화면에서 입력받는 값
export interface SignUpStep2Data {
  firstName: string;
  lastName: string;
  country: string;
  address: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  phoneNumber: string;
  agreeToMarketing: boolean;
  confirmIdMatch: boolean;
}

// 화면에서 받은 step 데이터를 회원가입 payload로 합칠 때 사용하는 타입
export interface BuildRegisterPayloadParams {
  step1: SignUpStep1Data;
  step2: SignUpStep2Data;
  referralCode?: string;
}

// 이메일 인증코드 발송 요청 body
export interface SendVerificationEmailRequest {
  email: string;
  purpose: 'SIGNUP' | 'WITHDRAW_REQUEST';
  recaptcha_token?: string;
}

// 이메일 인증코드 확인 요청 body
export interface VerifyVerificationEmailRequest {
  email: string;
  code: string;
  purpose: 'SIGNUP' | 'WITHDRAW_REQUEST';
}

// Step1, Step2에서 받은 값을 백엔드 회원가입 스펙에 맞춰 변환한다.
// 현재 화면에 없는 필드는 빈 문자열로 보낸다.
export const buildRegisterPayload = ({
  step1,
  step2,
  referralCode = '',
}: BuildRegisterPayloadParams): RegisterRequest => ({
  email: step1.email,
  password: step1.password,
  agree_to_terms: step1.agreeToTerms,
  subscribe_newsletter: step1.subscribeNewsletter,
  referral_code: referralCode.trim(),
  auth_provider: 'LOCAL',
  first_name: step2.firstName,
  last_name: step2.lastName,
  country: step2.country,
  city: step2.city,
  state_province: step2.state,
  address_line1: step2.address,
  address_line2: step2.addressLine2,
  zip_code: step2.postalCode,
  phone: `${step2.phoneNumber}`.trim(),
});

export const sendVerificationEmail = async (payload: SendVerificationEmailRequest) => {
  const response = await api.post('/v1/auth/email/send-verification', payload);
  return response.data;
};

export const verifyVerificationEmail = async (payload: VerifyVerificationEmailRequest) => {
  const response = await api.post('/v1/auth/email/verify', payload);
  return response.data;
};

export const register = async (payload: RegisterRequest) => {
  const response = await api.post('/v1/auth/register', payload);
  return response.data;
};
