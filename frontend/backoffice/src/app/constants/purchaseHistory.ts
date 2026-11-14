export type OrderStatusConfig = {
  label: string;
  bg: string;
  color: string;
  border: string;
};

export const PURCHASE_STATUS_FILTER = [
  { value: 'All', label: 'All' },
  { value: 'COMPLETED', label: '결제완료' },
  { value: 'PENDING', label: '결제대기' },
  { value: 'FAILED', label: '결제실패' },
  { value: 'REFUNDED', label: '환불' },
] as const;

export const normalizePurchaseStatus = (value: string) => {
  if (value === '결제완료') return 'COMPLETED';
  if (value === '결제대기') return 'PENDING';
  if (value === '결제실패') return 'FAILED';
  if (value === '환불') return 'REFUNDED';

  return value;
};

export const getPurchaseStatusConfig = (status: string): OrderStatusConfig => {
  const normalized = status.toUpperCase();

  return (
    {
      COMPLETED: {
        label: '결제완료',
        bg: 'rgba(22,163,74,0.1)',
        color: '#16A34A',
        border: 'rgba(22,163,74,0.2)',
      },
      PENDING: {
        label: '결제대기',
        bg: 'rgba(217,119,6,0.1)',
        color: '#D97706',
        border: 'rgba(217,119,6,0.2)',
      },
      FAILED: {
        label: '결제실패',
        bg: 'rgba(220,38,38,0.1)',
        color: '#DC2626',
        border: 'rgba(220,38,38,0.2)',
      },
      REFUNDED: {
        label: '환불',
        bg: 'rgba(107,114,128,0.12)',
        color: '#6B7280',
        border: 'rgba(107,114,128,0.2)',
      },
    }[normalized] ?? {
      label: status,
      bg: 'rgba(107,114,128,0.12)',
      color: '#6B7280',
      border: 'rgba(107,114,128,0.2)',
    }
  );
};
