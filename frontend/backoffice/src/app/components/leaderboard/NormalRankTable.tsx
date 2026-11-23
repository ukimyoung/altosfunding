import type { RankEntry } from '../../types/leaderboard';
import { LeaderboardRankTable } from './LeaderboardRankTable';

interface NormalRankTableProps {
  dark: boolean;
  data: RankEntry[];
  evaluatingId: string | null;
  onEvaluate: (id: string) => void;
  /** '펀디드 계좌 발급' 진행 중인 계좌 */
  issuingId: string | null;
  onIssueFunded: (entry: RankEntry) => void;
}

export function NormalRankTable(props: NormalRankTableProps) {
  return <LeaderboardRankTable {...props} variant="normal" />;
}
