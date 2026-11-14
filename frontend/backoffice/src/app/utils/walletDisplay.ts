export type BadgeColor = { bg: string; color: string; border: string };

const statusBadgeByDisplayStatus: Record<string, BadgeColor> = {
  Pending: {
    bg: 'rgba(217,119,6,0.1)',
    color: '#D97706',
    border: 'rgba(217,119,6,0.2)',
  },
  Completed: {
    bg: 'rgba(22,163,74,0.1)',
    color: '#16A34A',
    border: 'rgba(22,163,74,0.2)',
  },
  Failed: {
    bg: 'rgba(220,38,38,0.1)',
    color: '#DC2626',
    border: 'rgba(220,38,38,0.2)',
  },
};

const fallbackStatusBadge: BadgeColor = {
  bg: 'rgba(255,255,255,0.08)',
  color: '#8B8FA8',
  border: 'rgba(255,255,255,0.08)',
};

export const getWalletStatusBadge = (displayStatus: string): BadgeColor =>
  statusBadgeByDisplayStatus[displayStatus] ?? fallbackStatusBadge;
