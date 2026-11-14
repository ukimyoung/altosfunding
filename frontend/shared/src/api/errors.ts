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
