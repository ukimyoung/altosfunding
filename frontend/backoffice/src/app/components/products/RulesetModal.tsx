import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type {
  RulesetDetailResponse,
  RulesetDrawdownMethod,
  RulesetRetryPolicy,
  UpsertRulesetPayload,
} from "@/api/ruleset";

interface RulesetModalProps {
  ruleset: RulesetDetailResponse | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: UpsertRulesetPayload) => void;
  dark: boolean;
}

interface RulesetFormData {
  id: string;
  name: string;
  dailyLoss: string;
  maxLoss: string;
  profitTarget: string;
  minTradingDays: string;
  inactivityDays: string;
  maxTradingContracts: string;
  consistency: string;
  drawdownMethod: RulesetDrawdownMethod;
  retryPolicy: string;
  normalEvalMethod: string;
  normalEvalValue: string;
  vipEvalMethod: string;
  vipEvalValue: string;
  mostPopular: boolean;
  applyScope: string;
}

const emptyFormData: RulesetFormData = {
  id: "",
  name: "",
  dailyLoss: "",
  maxLoss: "",
  profitTarget: "",
  minTradingDays: "",
  inactivityDays: "",
  maxTradingContracts: "",
  consistency: "",
  drawdownMethod: "STATIC",
  retryPolicy: "미설정",
  normalEvalMethod: "상대평가",
  normalEvalValue: "",
  vipEvalMethod: "절대평가",
  vipEvalValue: "",
  mostPopular: false,
  applyScope: "new-only",
};

const evalMethodFromApi = (value: string) => (value === "ABSOLUTE" ? "절대평가" : "상대평가");
const evalMethodToApi = (value: string) => (value === "절대평가" ? "ABSOLUTE" : "RELATIVE");
const retryPolicyFromApi = (value: string) => {
  if (value === "ONCE") return "1회 허용";
  if (value === "UNLIMITED") return "무제한";
  if (value === "FORBIDDEN") return "불가";
  return "미설정";
};
const retryPolicyToApi = (value: string): RulesetRetryPolicy => {
  if (value === "1회 허용") return "ONCE";
  if (value === "무제한") return "UNLIMITED";
  if (value === "불가") return "FORBIDDEN";
  return "NONE";
};

const toFormData = (ruleset: RulesetDetailResponse | null): RulesetFormData => {
  if (!ruleset) {
    return emptyFormData;
  }

  const normalEvalMethod = evalMethodFromApi(ruleset.pass_condition_type);
  const vipEvalMethod = evalMethodFromApi(ruleset.pass_condition_vip_type);

  return {
    id: ruleset.id,
    name: ruleset.name,
    // 손실·수익 조건은 금액($). 예전 비율(%) 값은 화면에 쓰지 않는다.
    // dailyLoss: String(ruleset.daily_loss_limit_pct ?? ""),
    // maxLoss: String(ruleset.max_dd_normal_pct ?? ""),
    // profitTarget: String(ruleset.profit_target_pct ?? ""),
    dailyLoss: String(ruleset.daily_loss_limit_amt ?? ""),
    maxLoss: String(ruleset.max_dd_normal_amt ?? ""),
    profitTarget: String(ruleset.profit_target_amt ?? ""),
    minTradingDays: String(ruleset.min_trading_days ?? ""),
    inactivityDays: String(ruleset.inactivity_days ?? ""),
    maxTradingContracts: String(ruleset.max_trading_contracts ?? ""),
    consistency: String(ruleset.consistency_pct ?? ""),
    drawdownMethod: ruleset.dd_calc_method || "STATIC",
    retryPolicy: retryPolicyFromApi(ruleset.retry_policy),
    normalEvalMethod,
    normalEvalValue: String(
      normalEvalMethod === "절대평가"
        ? ruleset.pass_condition_amt ?? ""
        : ruleset.pass_condition_pct ?? "",
    ),
    vipEvalMethod,
    vipEvalValue: String(
      vipEvalMethod === "절대평가"
        ? ruleset.pass_condition_vip_amt ?? ""
        : ruleset.pass_condition_vip_pct ?? "",
    ),
    mostPopular: Boolean(ruleset.is_most_popular),
    applyScope: ruleset.apply_scope === "NEW" ? "new-only" : ruleset.apply_scope || "new-only",
  };
};

const toNumber = (value: string) => Number(value || 0);
const hasValue = (value: string) => value.trim() !== "";
// 비워 두면 null(설정 안 함)로 보낸다.
const toNullableNumber = (value: string) => (hasValue(value) ? Number(value) : null);

export function RulesetModal({ ruleset, isOpen, onClose, onSave, dark }: RulesetModalProps) {
  const [formData, setFormData] = useState<RulesetFormData>(emptyFormData);

  useEffect(() => {
    if (isOpen) {
      setFormData(toFormData(ruleset));
    }
  }, [isOpen, ruleset]);

  if (!isOpen) return null;

  const t = {
    surface: dark ? "#0F1829" : "#ffffff",
    surface2: dark ? "#1A2035" : "#F4F5F7",
    surface3: dark ? "#232C44" : "#E8EAF0",
    border: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.09)",
    text: dark ? "#E8EAF0" : "#1A1A1A",
    textSec: dark ? "#8B8FA8" : "#4A4A58",
    textHint: dark ? "#5A6080" : "#A0A0AA",
    accent: "#7C6AF7",
    accentBg: "rgba(124,106,247,0.12)",
  };

  const inactivityError = hasValue(formData.inactivityDays) && Number(formData.inactivityDays) > 30;

  const handleSubmit = () => {
    if (inactivityError) return;
    const normalEvalType = evalMethodToApi(formData.normalEvalMethod);
    const vipEvalType = evalMethodToApi(formData.vipEvalMethod);

    onSave({
      id: formData.id || undefined,
      name: formData.name,
      // daily_loss_limit_pct: toNumber(formData.dailyLoss),
      // max_dd_normal_pct: toNumber(formData.maxLoss),
      // profit_target_pct: toNumber(formData.profitTarget),
      daily_loss_limit_amt: toNullableNumber(formData.dailyLoss),
      max_dd_normal_amt: toNullableNumber(formData.maxLoss),
      profit_target_amt: toNullableNumber(formData.profitTarget),
      min_trading_days: toNumber(formData.minTradingDays),
      inactivity_days: toNumber(formData.inactivityDays),
      max_trading_contracts: toNullableNumber(formData.maxTradingContracts),
      consistency_pct: toNullableNumber(formData.consistency),
      dd_calc_method: formData.drawdownMethod,
      retry_policy: retryPolicyToApi(formData.retryPolicy),
      pass_condition_type: normalEvalType,
      ...(normalEvalType === "RELATIVE" && hasValue(formData.normalEvalValue)
        ? { pass_condition_pct: toNumber(formData.normalEvalValue) }
        : {}),
      ...(normalEvalType === "ABSOLUTE" && hasValue(formData.normalEvalValue)
        ? { pass_condition_amt: toNumber(formData.normalEvalValue) }
        : {}),
      pass_condition_vip_type: vipEvalType,
      ...(vipEvalType === "RELATIVE" && hasValue(formData.vipEvalValue)
        ? { pass_condition_vip_pct: toNumber(formData.vipEvalValue) }
        : {}),
      ...(vipEvalType === "ABSOLUTE" && hasValue(formData.vipEvalValue)
        ? { pass_condition_vip_amt: toNumber(formData.vipEvalValue) }
        : {}),
      is_most_popular: formData.mostPopular,
      apply_scope: formData.applyScope === "new-only" ? "NEW" : formData.applyScope,
    });
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: t.surface, borderRadius: 12, width: 640,
        maxHeight: "90vh", overflow: "hidden", display: "flex",
        flexDirection: "column", border: `1px solid ${t.border}`,
      }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          padding: "20px 24px", borderBottom: `1px solid ${t.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: t.text }}>
            {ruleset ? "룰셋 편집" : "룰셋 추가"}
          </span>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 6, border: "none",
            background: t.surface2, cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "center", color: t.textSec,
          }}>
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* 룰셋 명 - NO header above */}
            <InputField
              label="룰셋 명"
              value={formData.name}
              onChange={(v) => setFormData({ ...formData, name: v })}
              t={t}
            />

            {/* 손실 / 수익 조건 */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: t.accent, marginBottom: 12 }}>
                손실 / 수익 조건
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <InputField
                    label="일일 손실 한도 (Daily Loss Limit)"
                    type="number"
                    value={formData.dailyLoss}
                    onChange={(v) => setFormData({ ...formData, dailyLoss: v })}
                    suffix="$"
                    t={t}
                  />
                  <InputField
                    label="최대 손실 한도 (Max Drawdown)"
                    type="number"
                    value={formData.maxLoss}
                    onChange={(v) => setFormData({ ...formData, maxLoss: v })}
                    suffix="$"
                    t={t}
                  />
                </div>
                <InputField
                  label="수익 목표 (Profit Target)"
                  type="number"
                  value={formData.profitTarget}
                  onChange={(v) => setFormData({ ...formData, profitTarget: v })}
                  suffix="$"
                  t={t}
                />
              </div>
            </div>

            {/* 거래 활동 조건 */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: t.accent, marginBottom: 12 }}>
                거래 활동 조건
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <InputField
                  label="최소 거래일 (Min Trading Day)"
                  type="number"
                  value={formData.minTradingDays}
                  onChange={(v) => setFormData({ ...formData, minTradingDays: v })}
                  suffix="일"
                  hint="통과 인정에 필요한 최소 거래일"
                  t={t}
                />
                <InputField
                  label="미활동 일수 (Inactivity Days)"
                  type="number"
                  value={formData.inactivityDays}
                  onChange={(v) => setFormData({ ...formData, inactivityDays: v })}
                  suffix="일"
                  hint="통과 미활동 일수는 30일을 초과할 수 없습니다"
                  error={inactivityError}
                  t={t}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <InputField
                  label="최대 거래 계약수 (Max Trading Contracts)"
                  type="number"
                  value={formData.maxTradingContracts}
                  onChange={(v) => setFormData({ ...formData, maxTradingContracts: v })}
                  placeholder="1"
                  t={t}
                />
                <InputField
                  label="일관성 (Consistency)"
                  type="number"
                  value={formData.consistency}
                  onChange={(v) => setFormData({ ...formData, consistency: v })}
                  placeholder="40"
                  suffix="%"
                  t={t}
                />
              </div>
              </div>
            </div>

            {/* 기타 운영 조건 */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: t.accent, marginBottom: 12 }}>
                기타 운영 조건
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <SelectField
                  label="Drawdown 기준 방식"
                  options={[
                    { value: "STATIC", label: "Static" },
                    { value: "EOD", label: "EOD" },
                    { value: "INTRADAY", label: "Intraday" },
                  ]}
                  value={formData.drawdownMethod}
                  onChange={(v) => setFormData({
                    ...formData,
                    drawdownMethod: v as RulesetDrawdownMethod,
                  })}
                  t={t}
                />
                <SelectField
                  label="재시도 (Retry) 정책"
                  options={[
                    { value: "미설정", label: "미설정" },
                    { value: "1회 허용", label: "1회 허용" },
                    { value: "무제한", label: "무제한" },
                    { value: "불가", label: "불가" },
                  ]}
                  value={formData.retryPolicy}
                  onChange={(v) => setFormData({ ...formData, retryPolicy: v })}
                  t={t}
                />
              </div>
            </div>

            {/* 패스 조건 (통과 기준) */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: t.accent, marginBottom: 12 }}>
                패스 조건 (통과 기준)
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* 일반 */}
                <div style={{
                  padding: 16, borderRadius: 8, background: t.surface2,
                  border: `1px solid ${t.border}`,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 12 }}>
                    일반
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <SelectField
                      label="평가 방식"
                      options={[
                        { value: "상대평가", label: "상대평가" },
                        { value: "절대평가", label: "절대평가" },
                      ]}
                      value={formData.normalEvalMethod}
                      onChange={(v) => setFormData({ ...formData, normalEvalMethod: v })}
                      t={t}
                    />
                    <InputField
                      label={formData.normalEvalMethod === "상대평가" ? "상위 N%" : "수익 금액"}
                      type="number"
                      value={formData.normalEvalValue}
                      onChange={(v) => setFormData({ ...formData, normalEvalValue: v })}
                      suffix={formData.normalEvalMethod === "상대평가" ? "%" : "$"}
                      t={t}
                    />
                  </div>
                  <div style={{ fontSize: 11, color: t.textHint, marginTop: 8 }}>
                    일반 회원은 상위 10% 이내 진입 시 통과 (상대평가)
                  </div>
                </div>

                {/* VIP */}
                <div style={{
                  padding: 16, borderRadius: 8, background: t.surface2,
                  border: `1px solid ${t.border}`,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 12 }}>
                    VIP
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <SelectField
                      label="평가 방식"
                      options={[
                        { value: "절대평가", label: "절대평가" },
                        { value: "상대평가", label: "상대평가" },
                      ]}
                      value={formData.vipEvalMethod}
                      onChange={(v) => setFormData({ ...formData, vipEvalMethod: v })}
                      t={t}
                    />
                    <InputField
                      label={formData.vipEvalMethod === "절대평가" ? "목표 수익 금액" : "상위 N%"}
                      type="number"
                      value={formData.vipEvalValue}
                      onChange={(v) => setFormData({ ...formData, vipEvalValue: v })}
                      suffix={formData.vipEvalMethod === "절대평가" ? "$" : "%"}
                      t={t}
                    />
                  </div>
                  <div style={{ fontSize: 11, color: t.textHint, marginTop: 8 }}>
                    VIP 회원은 목표 수익 금액 달성 시 통과 (절대평가)
                  </div>
                </div>
              </div>
            </div>

            {/* MOST POPULAR */}
            <div style={{
              padding: 16, borderRadius: 8, background: t.accentBg,
              border: `1px solid ${t.border}`,
            }}>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={formData.mostPopular}
                  onChange={(e) => setFormData({ ...formData, mostPopular: e.target.checked })}
                  style={{ marginTop: 2 }}
                />
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
                      MOST POPULAR
                    </span>
                    <span style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "2px 8px",
                      borderRadius: 9999,
                      fontSize: 10,
                      fontWeight: 600,
                      background: t.accent,
                      color: "#fff",
                    }}>
                      MOST POPULAR
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: t.textSec }}>
                    체크 시 이 룰셋이 적용된 상품에 'MOST POPULAR' 뱃지가 랜딩페이지에 표시됩니다.
                  </div>
                </div>
              </label>
            </div>

            {/* 적용 범위 */}
            <div>
              <SelectField
                label="적용 범위"
                options={[
                  { value: "new-only", label: "신규 계좌에만 적용" },
                ]}
                value={formData.applyScope}
                onChange={(v) => setFormData({ ...formData, applyScope: v })}
                disabled
                t={t}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 24px", borderTop: `1px solid ${t.border}`,
          display: "flex", justifyContent: "flex-end", gap: 12,
        }}>
          <button onClick={onClose} style={{
            height: 36, padding: "0 16px", borderRadius: 8, border: "none",
            background: t.surface2, color: t.text, fontSize: 13, fontWeight: 500,
            cursor: "pointer",
          }}>
            취소
          </button>
          <button onClick={handleSubmit} style={{
            height: 36, padding: "0 16px", borderRadius: 8, border: "none",
            background: t.accent, color: "#fff", fontSize: 13, fontWeight: 500,
            cursor: "pointer",
          }}>
            {ruleset ? "변경 저장" : "룰셋 추가"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper Components
interface InputFieldProps {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  suffix?: string;
  hint?: string;
  placeholder?: string;
  error?: boolean;
  t: any;
}

function InputField({ label, type = "text", value, onChange, suffix, hint, placeholder, error, t }: InputFieldProps) {
  return (
    <div>
      <label style={{
        display: "block", fontSize: 12, fontWeight: 500,
        color: t.textSec, marginBottom: 6,
      }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: "100%", height: 36, padding: suffix ? "0 32px 0 12px" : "0 12px",
            borderRadius: 8, border: `1px solid ${error ? "#DC2626" : t.border}`,
            background: t.surface2, color: t.text, fontSize: 13,
          }}
        />
        {suffix && (
          <span style={{
            position: "absolute", right: 12, top: "50%",
            transform: "translateY(-50%)", fontSize: 13,
            color: t.textHint, pointerEvents: "none",
          }}>
            {suffix}
          </span>
        )}
      </div>
      {hint && (
        <div style={{ fontSize: 11, color: error ? "#DC2626" : t.textHint, marginTop: 4 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  t: any;
}

function SelectField({ label, options, value, onChange, disabled, t }: SelectFieldProps) {
  return (
    <div>
      <label style={{
        display: "block", fontSize: 12, fontWeight: 500,
        color: t.textSec, marginBottom: 6,
      }}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          width: "100%", height: 36, padding: "0 12px", borderRadius: 8,
          border: `1px solid ${t.border}`, background: t.surface2,
          color: t.text, fontSize: 13, cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
