import type { RankEntry } from '../../types/leaderboard';
import { LeaderboardRankTable } from './LeaderboardRankTable';

interface NormalRankTableProps {
  dark: boolean;
  data: RankEntry[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
  isClosed: boolean;
}

export function NormalRankTable(props: NormalRankTableProps) {
  return <LeaderboardRankTable {...props} variant="normal" />;
}
