import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useListRulesetsQuery } from '../../queries/rulesets';

export interface LiveDemoProduct {
  id: string;
  productName: string;
  amount: number | null;
  mtsGroupId: string;
  capital: number | null;
  leverage: number | null;
  tradingPeriod: number | null;
  marginCall: number | null;
  stopOut: number | null;
  accountRangeStart: number | null;
  accountRangeEnd: number | null;
  ruleset: string;
  rulesetName: string;
  status: 'ACTIVE' | 'SUSPENDED';
}

interface LiveDemoProductModalProps {
  type: 'live' | 'demo';
  product: LiveDemoProduct | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: LiveDemoProduct) => void;
  onNavigate?: (navId: string) => void;
  dark: boolean;
}

const DEFAULTS: Omit<LiveDemoProduct, 'id'> = {
  productName: '',
  amount: null,
  mtsGroupId: '',
  capital: null,
  leverage: null,
  tradingPeriod: null,
  marginCall: null,
  stopOut: null,
  accountRangeStart: null,
  accountRangeEnd: null,
  ruleset: '',
  rulesetName: '',
  status: 'ACTIVE',
};

export function LiveDemoProductModal({
  type,
  product,
  isOpen,
  onClose,
  onSave,
  onNavigate,
  dark,
}: LiveDemoProductModalProps) {
  const { data: rulesetsData } = useListRulesetsQuery({ page: 1, size: 100 }, isOpen);
  const rulesets = rulesetsData?.items ?? [];
  const [form, setForm] = useState<LiveDemoProduct>({
    id: `${type}-${Date.now()}`,
    ...DEFAULTS,
  });
  useEffect(() => {
    if (!isOpen) return;
    setForm(product ?? { id: `${type}-${Date.now()}`, ...DEFAULTS });
  }, [isOpen, product, type]);

  if (!isOpen) return null;

  const t = {
    surface: dark ? '#0F1829' : '#ffffff',
    surface2: dark ? '#1A2035' : '#F4F5F7',
    border: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)',
    text: dark ? '#E8EAF0' : '#1A1A1A',
    textSec: dark ? '#8B8FA8' : '#4A4A58',
    textHint: dark ? '#5A6080' : '#A0A0AA',
    accent: '#7C6AF7',
  };

  const typeLabel = type === 'live' ? '라이브' : '데모';
  const selectedRuleset = rulesets.find((rs) => rs.id === form.ruleset);
  const set = (patch: Partial<LiveDemoProduct>) => setForm((current) => ({ ...current, ...patch }));

  const handleSubmit = () => {
    onSave(form);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          background: t.surface,
          borderRadius: 12,
          width: 640,
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: `1px solid ${t.border}`,
        }}
      >
        <div
          style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${t.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 600, color: t.text }}>
            {product ? `${typeLabel} 상품 수정` : `${typeLabel} 상품 추가`}
          </span>
          <button
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: 'none',
              background: t.surface2,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: t.textSec,
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <section>
              <SectionTitle label="기본 설정" t={t} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <TwoCol>
                  <Field label="상품 명" t={t}>
                    <Input value={form.productName} onChange={(value) => set({ productName: value })} t={t} />
                  </Field>
                  <Field label="금액" t={t}>
                    <Input
                      type="number"
                      value={form.amount == null ? '' : String(form.amount)}
                      onChange={(value) => set({ amount: value === '' ? null : Number(value) })}
                      suffix="$"
                      t={t}
                    />
                  </Field>
                </TwoCol>

                <TwoCol>
                  <Field label="MTS 그룹 ID" t={t}>
                    <Input value={form.mtsGroupId} onChange={(value) => set({ mtsGroupId: value })} t={t} />
                  </Field>
                  <Field label="캐피탈 (Capital)" t={t}>
                    <Input
                      type="number"
                      value={form.capital == null ? '' : String(form.capital)}
                      onChange={(value) => set({ capital: value === '' ? null : Number(value) })}
                      suffix="$"
                      t={t}
                    />
                  </Field>
                </TwoCol>

                <TwoCol>
                  <Field label="레버리지" t={t}>
                    <Input
                      type="number"
                      value={form.leverage == null ? '' : String(form.leverage)}
                      onChange={(value) => set({ leverage: value === '' ? null : Number(value) })}
                      suffix="x"
                      placeholder="-"
                      t={t}
                    />
                  </Field>
                  <Field label="Trading 기간" t={t}>
                    <Input
                      type="number"
                      value={form.tradingPeriod == null ? '' : String(form.tradingPeriod)}
                      onChange={(value) => set({ tradingPeriod: value === '' ? null : Number(value) })}
                      suffix="영업일"
                      placeholder="-"
                      t={t}
                    />
                  </Field>
                </TwoCol>

                <TwoCol>
                  <Field label="마진콜" t={t}>
                    <Input
                      type="number"
                      value={form.marginCall == null ? '' : String(form.marginCall)}
                      onChange={(value) => set({ marginCall: value === '' ? null : Number(value) })}
                      suffix="%"
                      t={t}
                    />
                  </Field>
                  <Field label="Stop Out" t={t}>
                    <Input
                      type="number"
                      value={form.stopOut == null ? '' : String(form.stopOut)}
                      onChange={(value) => set({ stopOut: value === '' ? null : Number(value) })}
                      suffix="%"
                      t={t}
                    />
                  </Field>
                </TwoCol>
              </div>
            </section>

            <section>
              <SectionTitle label="계좌 번호 레인지" t={t} />
              <p style={{ fontSize: 12, color: t.textSec, margin: '0 0 12px' }}>
                해당 상품으로 생성되는 MT5 계좌 번호 범위를 지정합니다.
              </p>
              <TwoCol>
                <Field label="시작 번호" t={t}>
                  <Input
                    type="number"
                    value={form.accountRangeStart == null ? '' : String(form.accountRangeStart)}
                    onChange={(value) => set({ accountRangeStart: value === '' ? null : Number(value) })}
                    t={t}
                  />
                </Field>
                <Field label="종료 번호" t={t}>
                  <Input
                    type="number"
                    value={form.accountRangeEnd == null ? '' : String(form.accountRangeEnd)}
                    onChange={(value) => set({ accountRangeEnd: value === '' ? null : Number(value) })}
                    t={t}
                  />
                </Field>
              </TwoCol>
            </section>

            <section>
              <SectionTitle label="룰셋 선택" t={t} />
              <div style={{ fontSize: 12, color: t.textHint, marginBottom: 8 }}>
                손실 한도·Stop Out·Retry 등 운영 규칙
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <select
                  value={form.ruleset}
                  onChange={(event) => {
                    const rulesetId = event.target.value;
                    set({
                      ruleset: rulesetId,
                      rulesetName: rulesets.find((ruleset) => ruleset.id === rulesetId)?.name ?? '',
                    });
                  }}
                  style={{
                    flex: 1,
                    height: 36,
                    padding: '0 12px',
                    borderRadius: 8,
                    border: `1px solid ${t.border}`,
                    background: t.surface2,
                    color: form.ruleset ? t.text : t.textHint,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  <option value="">룰셋을 선택하세요</option>
                  {form.ruleset && !rulesets.some((ruleset) => ruleset.id === form.ruleset) && (
                    <option value={form.ruleset}>{form.rulesetName || form.ruleset}</option>
                  )}
                  {rulesets.map((ruleset) => (
                    <option key={ruleset.id} value={ruleset.id}>
                      {ruleset.name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigate?.('ruleset-management');
                  }}
                  style={{
                    height: 36,
                    padding: '0 12px',
                    borderRadius: 8,
                    border: `1px solid ${t.border}`,
                    background: t.surface2,
                    color: t.text,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    whiteSpace: 'nowrap',
                  }}
                >
                  룰셋 관리 →
                </button>
              </div>

              {selectedRuleset && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 8,
                    background: t.surface2,
                    border: `1px solid ${t.border}`,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 4 }}>
                    {selectedRuleset?.name || form.rulesetName || form.ruleset}
                  </div>
                  <div style={{ fontSize: 11, color: t.textSec }}>
                    {[
                      `일일 손실 ${selectedRuleset.daily_loss_limit_pct}%`,
                      `최대 손실 ${selectedRuleset.max_dd_normal_pct}%`,
                      selectedRuleset.profit_target_pct != null && `수익 목표 ${selectedRuleset.profit_target_pct}%`,
                      `최소 거래일 ${selectedRuleset.min_trading_days}일`,
                      `미활동 ${selectedRuleset.inactivity_days}일`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>

        <div
          style={{
            padding: '16px 24px',
            borderTop: `1px solid ${t.border}`,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12,
          }}
        >
          <button
            onClick={onClose}
            style={{
              height: 36,
              padding: '0 16px',
              borderRadius: 8,
              border: 'none',
              background: t.surface2,
              color: t.text,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            style={{
              height: 36,
              padding: '0 16px',
              borderRadius: 8,
              border: 'none',
              background: t.accent,
              color: '#fff',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ label, t }: { label: string; t: { text: string } }) {
  return <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 12 }}>{label}</div>;
}

function TwoCol({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>{children}</div>;
}

function Field({
  label,
  t,
  children,
}: {
  label: string;
  t: { textSec: string };
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: t.textSec }}>{label}</label>
      {children}
    </div>
  );
}

interface InputProps {
  type?: string;
  value: string;
  onChange: (value: string) => void;
  suffix?: string;
  placeholder?: string;
  t: { surface2: string; border: string; text: string; textHint: string };
}

function Input({ type = 'text', value, onChange, suffix, placeholder, t }: InputProps) {
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        style={{
          width: '100%',
          height: 36,
          padding: suffix ? '0 36px 0 12px' : '0 12px',
          borderRadius: 8,
          border: `1px solid ${t.border}`,
          background: t.surface2,
          color: t.text,
          fontSize: 13,
          boxSizing: 'border-box',
        }}
      />
      {suffix && (
        <span
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 13,
            color: t.textHint,
            pointerEvents: 'none',
          }}
        >
          {suffix}
        </span>
      )}
    </div>
  );
}
