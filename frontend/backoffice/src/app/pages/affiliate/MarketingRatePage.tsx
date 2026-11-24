// 운영 관리 > 마케팅 비율 관리 — IB 커미션 예산(결제 금액 × 마케팅 비율) 설정·변경 이력.
// Core: GET/POST /api/v1/admin/affiliate/marketing-policy
import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Check, History, Percent } from 'lucide-react';
import { useAppShell } from '../../layouts/AppShell';
import { Toast } from '../../components/shared/Toast';
import {
  apiErrorMessage,
  createMarketingPolicy,
  formatKst,
  getMarketingPolicy,
  kstLocalToIso,
  pct,
} from '../../../api/affiliate';
import type { MarketingOverview } from '../../../api/affiliate';

type ToastType = 'success' | 'warning';

export function MarketingRatePage() {
  const { dark } = useAppShell();
  const [overview, setOverview] = useState<MarketingOverview | null>(null);
  const [rate, setRate] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const showToast = useCallback((message: string, type: ToastType = 'success') => setToast({ message, type }), []);

  useEffect(() => {
    getMarketingPolicy()
      .then(setOverview)
      .catch((error) => showToast(apiErrorMessage(error, '마케팅 비율을 불러오지 못했습니다.'), 'warning'));
  }, [showToast]);

  const t = {
    surface: dark ? '#0F1829' : '#ffffff',
    surface2: dark ? '#1A2035' : '#F4F5F7',
    border: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)',
    border2: dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)',
    text: dark ? '#E8EAF0' : '#1A1A1A',
    textSec: dark ? '#8B8FA8' : '#4A4A58',
    textHint: dark ? '#5A6080' : '#A0A0AA',
    pageBg: dark ? '#0A0F1E' : '#F4F5F7',
    accent: '#7C6AF7',
    accentBg: dark ? 'rgba(124,106,247,0.12)' : 'rgba(124,106,247,0.08)',
  };
  const card = { background: t.surface, borderRadius: 14, border: `1px solid ${t.border}`, padding: '20px 24px' };
  const field = {
    width: '100%', height: 38, padding: '0 12px', borderRadius: 8, border: `1px solid ${t.border2}`,
    background: t.surface2, color: t.text, fontSize: 13, boxSizing: 'border-box' as const, outline: 'none',
  };
  const label = { fontSize: 12, fontWeight: 500, color: t.textSec, marginBottom: 6 };

  const rateValue = Number(rate);
  const validate = () => {
    if (rate.trim() === '' || !Number.isFinite(rateValue) || rateValue < 0 || rateValue > 100) return '마케팅 비율을 0~100 사이로 입력하세요.';
    if (!reason.trim()) return '변경 사유를 입력하세요.';
    return null;
  };

  const handleSubmit = () => {
    const error = validate();
    if (error) {
      showToast(error, 'warning');
      return;
    }
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    setSaving(true);
    createMarketingPolicy({ rate: rateValue, effective_from: kstLocalToIso(effectiveFrom), reason: reason.trim() })
      .then((res) => {
        setOverview(res);
        setRate('');
        setEffectiveFrom('');
        setReason('');
        showToast(effectiveFrom ? '마케팅 비율 변경이 예약되었습니다.' : '마케팅 비율이 변경되었습니다.', 'success');
      })
      .catch((error) => showToast(apiErrorMessage(error, '마케팅 비율 저장에 실패했습니다.'), 'warning'))
      .finally(() => {
        setSaving(false);
        setConfirmOpen(false);
      });
  };

  const current = overview?.current;
  const now = Date.now();
  const th = { padding: '10px 12px', textAlign: 'left' as const, fontSize: 11, fontWeight: 600, color: t.textSec, borderBottom: `1px solid ${t.border}`, whiteSpace: 'nowrap' as const };
  const td = { padding: '11px 12px', fontSize: 12, color: t.text, borderBottom: `1px solid ${t.border}`, verticalAlign: 'top' as const };

  return (
    <div style={{ padding: 32, background: t.pageBg, minHeight: 'calc(100vh - 52px)' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: t.text, margin: 0, marginBottom: 8 }}>마케팅 비율 관리</h1>
        <p style={{ fontSize: 13, color: t.textSec, margin: 0 }}>
          챌린지 티켓 결제 금액 중 IB 커미션 예산으로 쓰는 비율을 설정합니다. 예산 중 지급되지 않은 금액은 회사에 귀속됩니다.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '460px 1fr', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: t.accentBg, color: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Percent size={17} /></div>
              <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>현재 적용 중인 마케팅 비율</div>
            </div>
            <div style={{ fontSize: 34, fontWeight: 700, color: t.accent, fontFamily: "'DM Mono',monospace" }}>{current ? pct(current.rate) : '-'}</div>
            <div style={{ fontSize: 12, color: t.textHint, marginTop: 8, lineHeight: 1.6 }}>
              {current ? <>v{current.version} · {formatKst(current.effective_from)} (GMT+9)부터 적용<br />예: $100 결제 → 커미션 예산 ${(current.rate).toLocaleString('en-US', { maximumFractionDigits: 4 })}</> : '설정된 비율이 없습니다.'}
            </div>
            {(overview?.scheduled.length ?? 0) > 0 && (
              <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 9, background: 'rgba(217,119,6,.08)', color: '#D97706', fontSize: 12, lineHeight: 1.6 }}>
                {overview!.scheduled.map((item) => (
                  <div key={item.id}>예약: {formatKst(item.effective_from)} (GMT+9)부터 {pct(item.rate)}</div>
                ))}
              </div>
            )}
          </div>

          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: t.accentBg, color: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CalendarClock size={17} /></div>
              <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>마케팅 비율 변경</div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={label}>비율 <span style={{ color: '#DC2626' }}>*</span></div>
              <div style={{ position: 'relative' }}>
                <input type="number" min={0} max={100} step={0.01} value={rate} onChange={(e) => setRate(e.target.value)} placeholder={current ? String(current.rate) : '20'} style={{ ...field, paddingRight: 34 }} />
                <span style={{ position: 'absolute', right: 12, top: 11, fontSize: 12, color: t.textHint }}>%</span>
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={label}>적용 시작 시각 (GMT+9)</div>
              <input type="datetime-local" step={60} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} style={field} />
              <div style={{ fontSize: 11, color: t.textHint, marginTop: 4 }}>비워 두면 저장 즉시 적용됩니다. 과거 시각은 지정할 수 없습니다.</div>
            </div>
            <div style={{ marginBottom: 18 }}>
              <div style={label}>사유 <span style={{ color: '#DC2626' }}>*</span></div>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="변경 사유를 입력하세요" style={{ ...field, height: 'auto', padding: '8px 12px', resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
            <div style={{ fontSize: 11, color: t.textHint, marginBottom: 14, lineHeight: 1.6 }}>
              레벨별 커미션 비율 중 가장 높은 값보다 낮게는 바꿀 수 없습니다. 이미 결제된 주문의 커미션은 다시 계산하지 않습니다.
            </div>
            <button type="button" onClick={handleSubmit} disabled={saving} style={{ width: '100%', height: 38, borderRadius: 8, border: 'none', background: t.accent, color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.65 : 1 }}>
              {saving ? '저장 중' : '변경 저장'}
            </button>
          </div>
        </div>

        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <History size={16} color={t.accent} />
            <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>변경 이력</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead>
                <tr>{['버전', '비율', '적용 시작 (GMT+9)', '사유', '변경자', '등록 (GMT+9)', '상태'].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {(overview?.history ?? []).map((item) => {
                  const scheduled = new Date(item.effective_from).getTime() > now;
                  const active = current?.id === item.id;
                  return (
                    <tr key={item.id}>
                      <td style={{ ...td, fontFamily: "'DM Mono',monospace" }}>v{item.version}</td>
                      <td style={{ ...td, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{pct(item.rate)}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{formatKst(item.effective_from)}</td>
                      <td style={{ ...td, color: t.textSec, maxWidth: 260 }}>{item.reason}</td>
                      <td style={{ ...td, color: t.textSec, whiteSpace: 'nowrap' }}>{item.actor_name ?? '시스템'}</td>
                      <td style={{ ...td, color: t.textSec, whiteSpace: 'nowrap' }}>{formatKst(item.created_at)}</td>
                      <td style={td}>
                        <span style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: active ? 'rgba(22,163,74,.1)' : scheduled ? 'rgba(217,119,6,.1)' : t.surface2, color: active ? '#16A34A' : scheduled ? '#D97706' : t.textHint }}>
                          {active ? '적용 중' : scheduled ? '예약' : '종료'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {overview && overview.history.length === 0 && (
                  <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: t.textHint, padding: 32 }}>변경 이력이 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {confirmOpen && (
        <div onClick={() => !saving && setConfirmOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 420, background: t.surface, borderRadius: 12, border: `1px solid ${t.border}`, padding: 24 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 8 }}>마케팅 비율 변경 확인</div>
            <div style={{ fontSize: 13, color: t.textSec, lineHeight: 1.7, marginBottom: 20 }}>
              {current ? `${pct(current.rate)} → ` : ''}<b style={{ color: t.text }}>{pct(rateValue)}</b>
              <br />적용 시작: {effectiveFrom ? `${effectiveFrom.replace('T', ' ')} (GMT+9)` : '저장 즉시'}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setConfirmOpen(false)} disabled={saving} style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: t.surface2, color: t.textSec, fontSize: 13, cursor: 'pointer' }}>취소</button>
              <button type="button" onClick={handleConfirm} disabled={saving} style={{ height: 36, padding: '0 18px', borderRadius: 8, border: 'none', background: t.accent, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Check size={14} /> 확인</button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} dark={dark} onDone={() => setToast(null)} />}
    </div>
  );
}
