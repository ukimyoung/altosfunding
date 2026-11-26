import axios from 'axios';

export function isUnauthorizedError(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 401;
}

// 백엔드 에러 응답의 message 필드를 우선 사용하고, 없으면 fallbackMessage를 돌려준다.
export function getApiErrorMessage(error: unknown, fallbackMessage: string) {
  if (
    axios.isAxiosError(error) &&
    error.response?.data &&
    typeof error.response.data === 'object' &&
    'message' in error.response.data &&
    typeof error.response.data.message === 'string'
  ) {
    return error.response.data.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallbackMessage;
}

function errorBody(error: unknown): Record<string, unknown> | undefined {
  if (axios.isAxiosError(error) && error.response?.data && typeof error.response.data === 'object') {
    return error.response.data as Record<string, unknown>;
  }
  return undefined;
}

// 백엔드 에러 응답의 error_code (최상위 또는 detail 안). 없으면 빈 문자열.
export function getApiErrorCode(error: unknown): string {
  const body = errorBody(error);
  if (!body) return '';
  if (typeof body.error_code === 'string') return body.error_code;
  const detail = body.detail;
  if (detail && typeof detail === 'object' && 'error_code' in detail) {
    const code = (detail as { error_code?: unknown }).error_code;
    if (typeof code === 'string') return code;
  }
  return '';
}

// 백엔드 에러 응답의 data (다음 화면에 쓸 값). 없으면 undefined.
export function getApiErrorData<T = Record<string, unknown>>(error: unknown): T | undefined {
  const body = errorBody(error);
  const data = body?.data;
  return data && typeof data === 'object' ? (data as T) : undefined;
}
