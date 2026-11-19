import type { RankEntry, VipEntry } from '../../types/leaderboard';
import { getLeaderboardTierConfig, toLeaderboardTierLabel } from '../../constants/leaderboard';
import { formatSignedPercent, formatSignedUsdMoney } from '../../utils/utils';

type LeaderboardRankTableVariant = 'normal' | 'vip';
type LeaderboardRankTableEntry = RankEntry | VipEntry;

interface LeaderboardRankTableProps<T extends LeaderboardRankTableEntry> {
  dark: boolean;
  variant: LeaderboardRankTableVariant;
  data: T[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
  isClosed?: boolean;
}

export function LeaderboardRankTable<T extends LeaderboardRankTableEntry>({
  dark,
  variant,
  data,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  isClosed = false,
}: LeaderboardRankTableProps<T>) {
  const t = {
    surface: dark ? '#0F1829' : '#ffffff',
    surface2: dark ? '#1A2035' : '#F4F5F7',
    border: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)',
    text: dark ? '#E8EAF0' : '#1A1A1A',
    textSec: dark ? '#8B8FA8' : '#4A4A58',
  };

  const getRankMedal = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return null;
  };

  const selectableEntries = data.filter(
    (entry) => entry.approvalStatus !== 'approved' && entry.approvalStatus !== 'failed',
  );
  const allSelected =
    selectableEntries.length > 0 &&
    selectableEntries.every((entry) => selectedIds.includes(entry.id));
  const hideCheckbox = variant === 'normal' && isClosed;

  return (
    <div
      style={{
        background: t.surface,
        borderRadius: 12,
        border: `1px solid ${t.border}`,
        overflow: 'hidden',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: t.surface2, borderBottom: `1px solid ${t.border}` }}>
            {!hideCheckbox && (
              <th style={{ padding: '12px 16px', width: 40 }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleAll}
                  style={{ cursor: 'pointer', width: 16, height: 16 }}
                />
              </th>
            )}
            {['순위', '계좌번호 (챌린지)', '상품', '수익률', '수익금', '달성 여부', '결과'].map(
              (label) => (
                <th
                  key={label}
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontSize: 11,
                    fontWeight: 600,
                    color: t.textSec,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {data.map((entry) => {
            const tierCfg = getLeaderboardTierConfig(entry.productName);
            const isChecked = selectedIds.includes(entry.id);
            const medal = getRankMedal(entry.rank);
            const isApproved = entry.approvalStatus === 'approved';
            const isFailed = entry.approvalStatus === 'failed';
            const isDisabled = isApproved || isFailed || isClosed;
            const isNormalVariant = variant === 'normal';
            const isAchieved = entry.isPassed;
            const performanceColor =
              entry.profit > 0 ? '#16A34A' : entry.profit < 0 ? '#DC2626' : t.textSec;
            const rowBg =
              isChecked || isApproved
                ? isNormalVariant
                  ? dark
                    ? 'rgba(59,109,17,0.12)'
                    : 'rgba(59,109,17,0.06)'
                  : dark
                    ? 'rgba(217,119,6,0.12)'
                    : 'rgba(217,119,6,0.06)'
                : isFailed
                  ? dark
                    ? 'rgba(220,38,38,0.1)'
                    : 'rgba(220,38,38,0.04)'
                  : 'transparent';

            return (
              <tr
                key={entry.id}
                style={{
                  borderBottom: `1px solid ${t.border}`,
                  background: rowBg,
                }}
              >
                {!hideCheckbox && (
                  <td style={{ padding: '16px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isDisabled}
                      onChange={() => onToggleSelect(entry.id)}
                      style={{
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        width: 16,
                        height: 16,
                        opacity: isDisabled ? 0.5 : 1,
                      }}
                    />
                  </td>
                )}

                <td
                  style={{
                    padding: '16px',
                    fontSize: 14,
                    fontWeight: 600,
                    color: t.text,
                  }}
                >
                  {medal ? <span style={{ fontSize: 20 }}>{medal}</span> : `${entry.rank}위`}
                </td>

                <td
                  style={{
                    padding: '16px',
                    fontSize: 13,
                    color: t.text,
                    fontFamily: "'DM Mono', monospace",
                    fontWeight: 500,
                  }}
                >
                  {entry.accountNumber}
                </td>

                <td style={{ padding: '16px' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '4px 10px',
                      borderRadius: 9999,
                      fontSize: 11,
                      fontWeight: 600,
                      background: tierCfg.bg,
                      color: tierCfg.color,
                      border: `1px solid ${tierCfg.border}`,
                    }}
                  >
                    {toLeaderboardTierLabel(entry.productName)}
                  </span>
                </td>

                <td
                  style={{
                    padding: '16px',
                    fontSize: 14,
                    fontWeight: 600,
                    color: performanceColor,
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  {formatSignedPercent(entry.profitRate)}
                </td>

                <td
                  style={{
                    padding: '16px',
                    fontSize: 14,
                    fontWeight: 600,
                    color: performanceColor,
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  {formatSignedUsdMoney(entry.profit)}
                </td>

                <td style={{ padding: '16px' }}>
                  {isAchieved ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 10px',
                        borderRadius: 9999,
                        fontSize: 11,
                        fontWeight: 600,
                        background: isNormalVariant ? 'rgba(22,163,74,0.1)' : 'rgba(217,119,6,0.1)',
                        color: isNormalVariant ? '#16A34A' : '#D97706',
                        border: isNormalVariant
                          ? '1px solid rgba(22,163,74,0.2)'
                          : '1px solid rgba(217,119,6,0.2)',
                      }}
                    >
                      {isNormalVariant ? '● 달성' : '★ 달성'}
                    </span>
                  ) : (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '4px 10px',
                        borderRadius: 9999,
                        fontSize: 11,
                        fontWeight: 600,
                        background: 'rgba(113,113,122,0.1)',
                        color: '#71717A',
                        border: '1px solid rgba(113,113,122,0.2)',
                      }}
                    >
                      미달성
                    </span>
                  )}
                </td>

                <td style={{ padding: '16px' }}>
                  {isApproved && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 10px',
                        borderRadius: 9999,
                        fontSize: 11,
                        fontWeight: 600,
                        background: isNormalVariant ? 'rgba(22,163,74,0.1)' : 'rgba(217,119,6,0.1)',
                        color: isNormalVariant ? '#16A34A' : '#D97706',
                        border: isNormalVariant
                          ? '1px solid rgba(22,163,74,0.2)'
                          : '1px solid rgba(217,119,6,0.2)',
                      }}
                    >
                      {isNormalVariant ? '● 통과' : '★ 통과'}
                    </span>
                  )}
                  {isFailed && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 10px',
                        borderRadius: 9999,
                        fontSize: 11,
                        fontWeight: 600,
                        background: 'rgba(220,38,38,0.1)',
                        color: '#DC2626',
                        border: '1px solid rgba(220,38,38,0.2)',
                      }}
                    >
                      ✕ 불합격
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
