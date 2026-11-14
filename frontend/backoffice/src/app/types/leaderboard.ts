// 리더보드 테이블, 승인 패널, 통계 카드 타입
export interface RankEntry {
  id: string;
  rank: number;
  accountNumber: string;
  platform: 'MT4' | 'MT5';
  accountStatus: string;
  productName: string;
  profitRate: number;
  profit: number;
  isPassed: boolean;
  approvalStatus?: 'approved' | 'not-approved' | 'failed' | null;
}

export interface VipEntry {
  id: string;
  rank: number;
  accountNumber: string;
  platform: 'MT4' | 'MT5';
  accountStatus: string;
  productName: string;
  profitRate: number;
  profit: number;
  profitTarget: number | null;
  isPassed: boolean;
  approvalStatus?: 'approved' | 'not-approved' | 'failed' | null;
}

export interface LeaderboardStats {
  totalParticipants: number;
  normalPromotionCandidates: number;
  vipAchievers: number;
  eliminated: number;
}

export type LeaderboardStatus = 'ACTIVE' | 'CLOSED';
