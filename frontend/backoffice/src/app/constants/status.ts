export type StatusColor = { bg: string; color: string; border: string };

export const ACCT_STATUS_MAP: Record<string, StatusColor> = {
  활성: { bg: 'rgba(22,163,74,0.1)', color: '#16A34A', border: 'rgba(22,163,74,0.2)' },
  진행중: { bg: 'rgba(37,99,235,0.1)', color: '#2563EB', border: 'rgba(37,99,235,0.2)' },
  대기: { bg: 'rgba(217,119,6,0.1)', color: '#D97706', border: 'rgba(217,119,6,0.2)' },
  종료: { bg: 'rgba(107,114,128,0.12)', color: '#6B7280', border: 'rgba(107,114,128,0.2)' },
  통과: { bg: 'rgba(16,185,129,0.12)', color: '#059669', border: 'rgba(16,185,129,0.2)' },
  실패: { bg: 'rgba(220,38,38,0.1)', color: '#DC2626', border: 'rgba(220,38,38,0.2)' },
  비활성: { bg: 'rgba(217,119,6,0.1)', color: '#D97706', border: 'rgba(217,119,6,0.2)' },
  영구정지: { bg: 'rgba(220,38,38,0.1)', color: '#DC2626', border: 'rgba(220,38,38,0.2)' },
  '보상금 출금중': {
    bg: 'rgba(124,106,247,0.1)',
    color: '#7C6AF7',
    border: 'rgba(124,106,247,0.2)',
  },
};

export const VIOL_STATUS_MAP: Record<string, StatusColor> = {
  비활성: { bg: 'rgba(217,119,6,0.1)', color: '#D97706', border: 'rgba(217,119,6,0.2)' },
  영구정지: { bg: 'rgba(220,38,38,0.1)', color: '#DC2626', border: 'rgba(220,38,38,0.2)' },
  실패: { bg: 'rgba(220,38,38,0.1)', color: '#DC2626', border: 'rgba(220,38,38,0.2)' },
};

export const TIER_CONFIG = {
  STARTER: {
    label: 'Starter',
    bg: 'rgba(22,163,74,0.1)',
    color: '#16A34A',
    border: 'rgba(22,163,74,0.2)',
  },
  PROFESSIONAL: {
    label: 'Professional',
    bg: 'rgba(124,106,247,0.12)',
    color: '#7C6AF7',
    border: 'rgba(124,106,247,0.2)',
  },
  ELITE: {
    label: 'Elite',
    bg: 'rgba(217,119,6,0.1)',
    color: '#D97706',
    border: 'rgba(217,119,6,0.2)',
  },
} as const;

export const PRODUCT_STATUS = {
  ACTIVE: {
    label: '사용중',
    bg: 'rgba(22,163,74,0.1)',
    color: '#16A34A',
    border: 'rgba(22,163,74,0.2)',
  },
  SUSPENDED: {
    label: '사용중지',
    bg: 'rgba(217,119,6,0.1)',
    color: '#D97706',
    border: 'rgba(217,119,6,0.2)',
  },
} as const;

export const PASS_CONDITION_TYPE = [
  { value: '상대평가', label: '상대평가' },
  { value: '절대평가', label: '절대평가' },
] as const;

export const DRAWDOWN_METHOD = [
  { value: '미설정', label: '미설정' },
  { value: 'Equity 기준', label: 'Equity 기준' },
  { value: 'Balance 기준', label: 'Balance 기준' },
] as const;

export const RETRY_POLICY = [
  { value: '미설정', label: '미설정' },
  { value: '1회 허용', label: '1회 허용' },
  { value: '무제한', label: '무제한' },
  { value: '불가', label: '불가' },
] as const;

export const SCHEDULE_STATUS = [
  { value: 'ACTIVE', label: 'ACTIVE' },
  { value: 'PAUSED', label: 'PAUSED' },
  { value: 'COMPLETED', label: 'COMPLETED' },
] as const;

export const ASSIGNMENT_METHOD = [
  { value: 'RANDOM', label: 'RANDOM' },
  { value: 'SEQUENTIAL', label: 'SEQUENTIAL' },
  { value: 'MANUAL', label: 'MANUAL' },
] as const;

export const ACCOUNT_RANGE_HINTS = {
  100: '522001 ~ 30000000',
  300: '30000001 ~ 60000000',
  500: '60000001 ~ 90000000',
} as const;

export const PLATFORM_FILTER = [
  { value: 'All', label: 'All' },
  { value: 'MT4', label: 'MT4' },
  { value: 'MT5', label: 'MT5' },
] as const;

export const LIVE_ACCOUNT_STATUS_FILTER = [
  { value: 'All', label: '관리: 전체' },
  { value: 'ACTIVE', label: '활성' },
  { value: 'IN_PROGRESS', label: '진행중' },
  { value: 'INACTIVE', label: '비활성' },
  { value: 'BANNED', label: '영구정지' },
] as const;

export const DEMO_CATEGORY_FILTER = [
  { value: 'All', label: 'All' },
  { value: '유저 데모', label: '유저 데모' },
  { value: '사내 테스트', label: '사내 테스트' },
] as const;

export const DEMO_ACCOUNT_STATUS_FILTER = [
  { value: 'All', label: '관리: 전체' },
  { value: 'ACTIVE', label: '활성' },
  // Core는 IN_PROGRESS를 쓰지 않는다
  // { value: 'IN_PROGRESS', label: '진행중' },
  { value: 'INACTIVE', label: '비활성' },
  { value: 'BANNED', label: '영구정지' },
] as const;

export const PRODUCT_TYPE_FILTER = [
  { value: 'All', label: 'All' },
  { value: '100', label: '$100 Starter' },
  { value: '300', label: '$300 Professional' },
  { value: '500', label: '$500 Elite' },
] as const;

export const PAYMENT_METHOD_FILTER = [
  { value: 'All', label: 'All' },
  { value: '카드', label: '카드' },
  { value: '암호화폐', label: '암호화폐' },
  { value: '기타', label: '기타' },
] as const;

export const PAYMENT_STATUS_FILTER = [
  { value: 'All', label: 'All' },
  { value: '결제완료', label: '결제완료' },
  { value: '결제대기', label: '결제대기' },
  { value: '환불', label: '환불' },
  { value: '결제실패', label: '결제실패' },
] as const;

export const TRANSFER_TYPE_FILTER = [
  { value: 'All', label: '거래 유형: All' },
  { value: 'External Wallet', label: 'External Wallet' },
  { value: 'Payout', label: 'Payout' },
  { value: 'Live Trading Account', label: 'Live Trading Account' },
  { value: 'Reward', label: 'Reward' },
] as const;

export const TRANSFER_STATUS_FILTER = [
  { value: 'All', label: '상태: All' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Failed', label: 'Failed' },
] as const;

export const REJECT_REASONS = [
  { value: 'TXID 불일치', label: 'TXID 불일치' },
  { value: '입금 금액 불일치', label: '입금 금액 불일치' },
  { value: '지갑 주소 오류', label: '지갑 주소 오류' },
  { value: '지원하지 않는 네트워크', label: '지원하지 않는 네트워크' },
  { value: 'KYC 미인증', label: 'KYC 미인증' },
  { value: '직접 입력', label: '직접 입력' },
] as const;
