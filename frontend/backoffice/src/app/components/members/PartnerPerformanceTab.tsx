import { useState } from 'react';
import type { PartnerCouponStats, PartnerStatsResponse } from '../../../api/user';
import type { tok } from '../../theme/tokens';
import { formatKstDateTimeParts } from '../../utils/utils';
import { UsageDrawer } from '../coupons/CouponManagement';

type Theme = ReturnType<typeof tok>;

const formatRate = (rate: number) =>
  `${(rate * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
const formatMoney = (value: number) =>
  `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export function PartnerPerformanceTab({ data, isLoading, isError, t }: { data?: PartnerStatsResponse; isLoading: boolean; isError: boolean; t: Theme }) {
  const [selectedPerfRow, setSelectedPerfRow] = useState<PartnerCouponStats | null>(null);
  const rows = data?.coupons ?? [];

  return <>
    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
      <colgroup><col style={{ width: '16%' }} /><col style={{ width: '13%' }} /><col style={{ width: '10%' }} /><col style={{ width: '11%' }} /><col style={{ width: '10%' }} /><col style={{ width: '14%' }} /><col style={{ width: '13%' }} /><col style={{ width: '13%' }} /></colgroup>
      <thead><tr style={{ background: t.surface2, height: 40, borderBottom: `1px solid ${t.border}` }}>{['쿠폰 코드', '발행일', '할인', '커미션율', '사용 건수', '기여 매출', '할인 총액', '커미션 지급액'].map(h => <th key={h} style={{ padding: '0 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: t.textHint, letterSpacing: '0.05em', fontFamily: "'DM Sans','Noto Sans KR',sans-serif", whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
      <tbody>
        {rows.map((row, i) => <tr key={row.coupon_id} style={{ height: 52, borderBottom: i < rows.length - 1 ? `1px solid ${t.border}` : 'none' }}>
          <td style={{ padding: '0 12px' }}><span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", fontWeight: 700, color: t.text }}>{row.code}</span></td>
          <td style={{ padding: '0 12px' }}><span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: t.textSec }}>{formatKstDateTimeParts(row.created_at).date}</span></td>
          <td style={{ padding: '0 12px' }}><span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: t.text }}>{formatRate(row.discount_rate)}</span></td>
          <td style={{ padding: '0 12px' }}><span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: '#7C6AF7', fontWeight: 600 }}>{formatRate(row.commission_rate)}</span></td>
          <td style={{ padding: '0 12px' }}>{row.usage_count > 0 ? <button onClick={() => setSelectedPerfRow(row)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 11, fontFamily: "'DM Mono',monospace", color: t.accent, textDecoration: 'underline', fontWeight: 600 }}>{row.usage_count}건</button> : <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: t.textHint }}>0건</span>}</td>
          <td style={{ padding: '0 12px' }}><span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: row.total_final_amount > 0 ? t.text : t.textHint }}>{row.total_final_amount > 0 ? formatMoney(row.total_final_amount) : '—'}</span></td>
          <td style={{ padding: '0 12px' }}><span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: row.total_discount_amount > 0 ? '#DC2626' : t.textHint }}>{row.total_discount_amount > 0 ? `-${formatMoney(row.total_discount_amount)}` : '—'}</span></td>
          <td style={{ padding: '0 12px' }}><span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: row.total_commission_amount > 0 ? '#16A34A' : t.textHint, fontWeight: row.total_commission_amount > 0 ? 600 : 400 }}>{row.total_commission_amount > 0 ? formatMoney(row.total_commission_amount) : '—'}</span></td>
        </tr>)}
        {(isLoading || isError || rows.length === 0) && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: t.textHint, fontSize: 12 }}>{isLoading ? '파트너 실적을 불러오는 중입니다.' : isError ? '파트너 실적을 불러오지 못했습니다.' : '파트너 실적이 없습니다.'}</td></tr>}
      </tbody>
    </table>
    <div style={{ padding: '10px 16px', borderTop: `1px solid ${t.border}`, display: 'flex', justifyContent: 'flex-end' }}><span style={{ fontSize: 11, color: t.textHint, fontFamily: "'Noto Sans KR',sans-serif" }}>총 {data?.total ?? 0}건</span></div>
    {selectedPerfRow && <UsageDrawer key={selectedPerfRow.coupon_id} coupon={{ id: String(selectedPerfRow.coupon_id), code: selectedPerfRow.code, name: selectedPerfRow.name, maxUses: selectedPerfRow.max_uses }} t={t} onClose={() => setSelectedPerfRow(null)} headerMode="usage-only" />}
  </>;
}
