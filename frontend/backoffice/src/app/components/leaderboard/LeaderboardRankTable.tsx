import type { RankEntry, VipEntry } from '../../types/leaderboard';
import { getLeaderboardTierConfig, toLeaderboardTierLabel } from '../../constants/leaderboard';
import { formatKstDateTimeParts, formatSignedPercent, formatSignedUsdMoney } from '../../utils/utils';
import { fundedProvisionLabel } from '../accounts/AccountDetailDrawer';

type LeaderboardRankTableVariant = 'normal' | 'vip';
type LeaderboardRankTableEntry = RankEntry | VipEntry;

interface LeaderboardRankTableProps<T extends LeaderboardRankTableEntry> {
  dark: boolean;
  variant: LeaderboardRankTableVariant;
  data: T[];
  /** '확인하기' 진행 중인 계좌 */
  evaluatingId: string | null;
  onEvaluate: (id: string) => void;
  /** '펀디드 계좌 발급' 진행 중인 계좌 */
  issuingId: string | null;
  onIssueFunded: (entry: T) => void;
}

const PASS_BADGE = {
  PASSED: {
    label: '● 통과',
    bg: 'rgba(22,163,74,0.1)',
    color: '#16A34A',
    border: '1px solid rgba(22,163,74,0.2)',
  },
  FAILED: {
    label: '✕ 불통과',
    bg: 'rgba(220,38,38,0.1)',
    color: '#DC2626',
    border: '1px solid rgba(220,38,38,0.2)',
  },
  NONE: {
    label: '미확인',
    bg: 'rgba(113,113,122,0.1)',
    color: '#71717A',
    border: '1px solid rgba(113,113,122,0.2)',
  },
} as const;

export function LeaderboardRankTable<T extends LeaderboardRankTableEntry>({
  dark,
  data,
  evaluatingId,
  onEvaluate,
  issuingId,
  onIssueFunded,
}: LeaderboardRankTableProps<T>) {
  const t = {
    surface: dark ? '#0F1829' : '#ffffff',
    surface2: dark ? '#1A2035' : '#F4F5F7',
    border: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)',
    text: dark ? '#E8EAF0' : '#1A1A1A',
    textSec: dark ? '#8B8FA8' : '#4A4A58',
    textHint: dark ? '#5A6080' : '#A0A0AA',
    accent: '#7C6AF7',
  };

  const getRankMedal = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return null;
  };

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
            {/* 승격 대상 선택 체크박스는 '승격 대상 목록' 영역과 함께 제거 */}
            {['순위', '계좌번호 (챌린지)', '상품', '수익률', '수익금', '통과 여부', '결과', '펀디드계좌'].map(
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
          {data.length === 0 && (
            <tr>
              <td
                colSpan={8}
                style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: t.textSec }}
              >
                표시할 계좌가 없습니다
              </td>
            </tr>
          )}
          {data.map((entry) => {
            const tierCfg = getLeaderboardTierConfig(entry.productName);
            const medal = getRankMedal(entry.rank);
            const badge = PASS_BADGE[entry.evaluationResult ?? 'NONE'];
            const isEvaluating = evaluatingId === entry.id;
            const performanceColor =
              entry.profit > 0 ? '#16A34A' : entry.profit < 0 ? '#DC2626' : t.textSec;

            return (
              <tr key={entry.id} style={{ borderBottom: `1px solid ${t.border}` }}>
                <td style={{ padding: '16px', fontSize: 14, fontWeight: 600, color: t.text }}>
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
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 10px',
                      borderRadius: 9999,
                      fontSize: 11,
                      fontWeight: 600,
                      background: badge.bg,
                      color: badge.color,
                      border: badge.border,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {badge.label}
                  </span>
                </td>

                <td style={{ padding: '16px' }}>
                  <button
                    type="button"
                    onClick={() => onEvaluate(entry.id)}
                    disabled={evaluatingId !== null}
                    style={{
                      height: 30,
                      padding: '0 14px',
                      borderRadius: 6,
                      border: `1px solid ${t.accent}`,
                      background: 'transparent',
                      color: t.accent,
                      fontSize: 12,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      cursor: evaluatingId !== null ? 'not-allowed' : 'pointer',
                      opacity: evaluatingId !== null && !isEvaluating ? 0.5 : 1,
                    }}
                  >
                    {isEvaluating ? '확인 중...' : '확인하기'}
                  </button>
                </td>

                {/* 펀디드계좌: 발급된 계좌(번호·상태) / 합격했고 아직 없으면 '펀디드 계좌 발급' 버튼 / 그 외 - */}
                <td style={{ padding: '16px', whiteSpace: 'nowrap' }}>
                  {entry.fundedAccountId ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: t.text,
                          fontFamily: "'DM Mono', monospace",
                        }}
                      >
                        {entry.fundedMt4Login ?? '번호 할당 전'}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: entry.fundedProvisionStatus === 'DONE' ? '#16A34A' : '#D97706',
                        }}
                      >
                        {fundedProvisionLabel(entry.fundedProvisionStatus)}
                        {entry.fundedProvisionStatus !== 'DONE' && entry.fundedStartAt ? (
                          <span style={{ fontWeight: 400, color: t.textHint }}>
                            {' '}
                            · {formatKstDateTimeParts(entry.fundedStartAt).date}{' '}
                            {formatKstDateTimeParts(entry.fundedStartAt).time}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  ) : entry.accountStatus === 'PASSED' ? (
                    <button
                      type="button"
                      onClick={() => onIssueFunded(entry)}
                      disabled={issuingId !== null}
                      style={{
                        height: 30,
                        padding: '0 14px',
                        borderRadius: 6,
                        border: 'none',
                        background: t.accent,
                        color: '#ffffff',
                        fontSize: 12,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        cursor: issuingId !== null ? 'not-allowed' : 'pointer',
                        opacity: issuingId !== null && issuingId !== entry.id ? 0.5 : 1,
                      }}
                    >
                      {issuingId === entry.id ? '발급 중...' : '펀디드 계좌 발급'}
                    </button>
                  ) : (
                    <span style={{ fontSize: 13, color: t.textSec }}>-</span>
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
