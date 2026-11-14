// access token은 XSS 노출을 줄이기 위해 메모리에만 둔다.
// 새로고침하면 사라지고, 다음 API 호출의 401 응답에서 refresh token 쿠키로 다시 발급받는다.
let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

export const clearAccessToken = () => {
  accessToken = null;
};
