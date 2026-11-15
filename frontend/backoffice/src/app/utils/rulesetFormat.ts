// 룰셋 손실·수익 조건 표시. 금액($)이 있으면 금액을, 없으면 예전 비율(%)을 보여 준다.
export const formatRulesetLimit = (
  amount: number | null | undefined,
  pct: number | null | undefined,
): string => {
  if (typeof amount === 'number') return `$${amount.toLocaleString('en-US')}`;
  if (typeof pct === 'number') return `${pct}%`;
  return '-';
};
