import type { VipEntry } from '../../types/leaderboard';
import { LeaderboardRankTable } from './LeaderboardRankTable';

interface VipRankTableProps {
  dark: boolean;
  data: VipEntry[];
  evaluatingId: string | null;
  onEvaluate: (id: string) => void;
}

export function VipRankTable(props: VipRankTableProps) {
  return <LeaderboardRankTable {...props} variant="vip" />;
}
