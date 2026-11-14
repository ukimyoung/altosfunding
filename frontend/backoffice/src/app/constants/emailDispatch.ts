import type { DispatchVariable } from '../types/emailDispatch';

export const DISPATCH_VARIABLES: DispatchVariable[] = [
  { label: '회원명', token: '{{user_name}}' },
  { label: '계좌번호', token: '{{account_no}}' },
  { label: '금액', token: '{{amount}}' },
  { label: '챌린지명', token: '{{challenge_name}}' },
  { label: '티어', token: '{{tier}}' },
  { label: '수익', token: '{{profit}}' },
  { label: '날짜', token: '{{date}}' },
];

export const DISPATCH_LEVEL_OPTIONS = ['전체', 'Starter', 'Professional', 'Elite'];

export const DISPATCH_COUNTRY_OPTIONS = [
  '전체',
  '미국 (United States)',
  '캐나다 (Canada)',
  '영국 (United Kingdom)',
  '호주 (Australia)',
  '독일 (Germany)',
  '프랑스 (France)',
  '스페인 (Spain)',
  '이탈리아 (Italy)',
  '네덜란드 (Netherlands)',
  '대한민국 (South Korea)',
  '기타 (Other)',
];

export const DISPATCH_TOTAL_USERS = 1240;
export const DISPATCH_SEARCH_PAGE_SIZE = 10;
