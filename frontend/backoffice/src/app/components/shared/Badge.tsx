import type { Tok } from '../../theme/tokens';

// 테이블/상세 화면에서 상태, KYC, 사용자 타입을 작게 표시하는 공통 뱃지입니다.

export function Badge({
  label,
  bg,
  color,
  border,
}: {
  label: string;
  bg: string;
  color: string;
  border: string;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 9999,
        fontSize: 10,
        fontWeight: 600,
        background: bg,
        color,
        border: `1px solid ${border}`,
        fontFamily: "'DM Sans','Noto Sans KR',sans-serif",
        whiteSpace: 'nowrap',
        lineHeight: 1.6,
      }}
    >
      {label}
    </span>
  );
}

export function UserTypeBadge({ type, t }: { type: 'VIP' | 'Normal'; t: Tok }) {
  return type === 'VIP' ? (
    <Badge label="VIP" bg={t.accentBg} color={t.accent} border={t.accentBd} />
  ) : (
    <Badge label="일반" bg={t.surface2} color={t.textSec} border={t.border2} />
  );
}

export function KycBadge({ status, t }: { status: string; t: Tok }) {
  const m: Record<string, { label: string; bg: string; color: string; border: string }> = {
    APPROVED: {
      label: 'Approved',
      bg: 'rgba(22,163,74,0.1)',
      color: '#16A34A',
      border: 'rgba(22,163,74,0.2)',
    },
    Rejected: {
      label: 'Rejected',
      bg: 'rgba(220,38,38,0.1)',
      color: '#DC2626',
      border: 'rgba(220,38,38,0.2)',
    },
    Unverified: { label: 'Unverified', bg: t.surface2, color: t.textHint, border: t.border },
  };
  const s = m[status] ?? m['Unverified'];
  return <Badge label={s.label} bg={s.bg} color={s.color} border={s.border} />;
}

export function StatusBadge({ status, t }: { status: string; t: Tok }) {
  const m: Record<string, { label: string; bg: string; color: string; border: string }> = {
    Active: {
      label: '활성',
      bg: 'rgba(22,163,74,0.1)',
      color: '#16A34A',
      border: 'rgba(22,163,74,0.2)',
    },
    Inactive: {
      label: '비활성',
      bg: 'rgba(217,119,6,0.1)',
      color: '#D97706',
      border: 'rgba(217,119,6,0.2)',
    },
    Banned: {
      label: '영구정지',
      bg: 'rgba(220,38,38,0.1)',
      color: '#DC2626',
      border: 'rgba(220,38,38,0.2)',
    },
  };
  const s = m[status] ?? { label: status, bg: t.surface2, color: t.textHint, border: t.border };
  return <Badge label={s.label} bg={s.bg} color={s.color} border={s.border} />;
}
