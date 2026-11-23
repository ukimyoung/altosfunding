// 리더보드 테이블, 통계 카드 타입
export type EvaluationResult = 'PASSED' | 'FAILED';

export interface RankEntry {
  id: string;
  rank: number;
  accountNumber: string;
  platform: 'MT4' | 'MT5';
  accountStatus: string;
  productName: string;
  profitRate: number;
  profit: number;
  /** '확인하기' 마지막 판정 (판정 전이면 null) */
  evaluationResult: EvaluationResult | null;
  evaluatedAt: string | null;
  /** 펀디드 계좌 발급 방법 (상품 설정) */
  fundedIssueMethod: 'AUTO' | 'MANUAL';
  /** 이 계좌로 만든 펀디드 계좌 (없으면 null) */
  fundedAccountId: string | null;
  fundedMt4Login: number | null;
  fundedProvisionStatus: string | null;
  fundedStartAt: string | null;
}

export interface VipEntry extends RankEntry {
  profitTarget: number | null;
}

export interface LeaderboardStats {
  totalParticipants: number;
  normalPromotionCandidates: number;
  vipAchievers: number;
  eliminated: number;
}

export type LeaderboardStatus = 'ACTIVE' | 'CLOSED';
