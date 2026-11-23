import type { VipEntry } from '../../types/leaderboard';
import { LeaderboardRankTable } from './LeaderboardRankTable';

interface VipRankTableProps {
  dark: boolean;
  data: VipEntry[];
  evaluatingId: string | null;
  onEvaluate: (id: string) => void;
  /** '펀디드 계좌 발급' 진행 중인 계좌 */
  issuingId: string | null;
  onIssueFunded: (entry: VipEntry) => void;
}

export function VipRankTable(props: VipRankTableProps) {
  return <LeaderboardRankTable {...props} variant="vip" />;
}
