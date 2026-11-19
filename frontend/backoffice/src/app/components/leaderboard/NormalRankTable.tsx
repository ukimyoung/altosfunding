import type { RankEntry } from '../../types/leaderboard';
import { LeaderboardRankTable } from './LeaderboardRankTable';

interface NormalRankTableProps {
  dark: boolean;
  data: RankEntry[];
  evaluatingId: string | null;
  onEvaluate: (id: string) => void;
}

export function NormalRankTable(props: NormalRankTableProps) {
  return <LeaderboardRankTable {...props} variant="normal" />;
}
