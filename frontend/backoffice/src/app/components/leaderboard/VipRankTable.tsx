import type { VipEntry } from '../../types/leaderboard';
import { LeaderboardRankTable } from './LeaderboardRankTable';

interface VipRankTableProps {
  dark: boolean;
  data: VipEntry[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
}

export function VipRankTable(props: VipRankTableProps) {
  return <LeaderboardRankTable {...props} variant="vip" />;
}
