import { LeaderboardStats } from '../../types/leaderboard';

interface LeaderboardStatCardsProps {
  dark: boolean;
  stats: LeaderboardStats;
}

export function LeaderboardStatCards({ dark, stats }: LeaderboardStatCardsProps) {
  const t = {
    surface: dark ? '#0F1829' : '#ffffff',
    border: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)',
    text: dark ? '#E8EAF0' : '#1A1A1A',
    textSec: dark ? '#8B8FA8' : '#4A4A58',
  };

  const cards = [
    {
      label: '전체 참여자',
      value: `${stats.totalParticipants}명`,
      color: t.text,
      sub: null,
    },
    {
      label: '일반 승격 대상',
      value: `${stats.normalPromotionCandidates}명`,
      color: '#16A34A',
      sub: '상위 10% 이내',
    },
    {
      label: 'VIP 달성자',
      value: `${stats.vipAchievers}명`,
      color: '#D97706',
      sub: '수익 목표 달성',
    },
    {
      label: '탈락 / 위반',
      value: `${stats.eliminated}명`,
      color: '#DC2626',
      sub: null,
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16,
        padding: '24px 24px 16px',
      }}
    >
      {cards.map((card, idx) => (
        <div
          key={idx}
          style={{
            padding: '16px 20px',
            background: t.surface,
            borderRadius: 12,
            border: `1px solid ${t.border}`,
          }}
        >
          <div style={{ fontSize: 11, color: t.textSec, marginBottom: 8 }}>{card.label}</div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 600,
              color: card.color,
              marginBottom: card.sub ? 4 : 0,
            }}
          >
            {card.value}
          </div>
          {card.sub && <div style={{ fontSize: 11, color: t.textSec }}>{card.sub}</div>}
        </div>
      ))}
    </div>
  );
}
