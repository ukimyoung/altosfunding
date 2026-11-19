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
