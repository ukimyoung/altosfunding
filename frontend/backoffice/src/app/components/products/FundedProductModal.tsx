import { useEffect, useState, useRef } from "react";
import { X } from "lucide-react";
import type { FundedProduct } from "../../types/product";
import { ACCOUNT_RANGE_HINTS } from "../../constants/status";
import { useListRulesetsQuery } from "../../queries/rulesets";
import { useListCatalogProductsQuery } from "../../queries/catalogProducts";
import { formatRulesetLimit } from "../../utils/rulesetFormat";

interface FundedProductModalProps {
  product: FundedProduct | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: FundedProduct) => void;
  onNavigate?: (navId: string) => void;
  dark: boolean;
}

export function FundedProductModal({ product, isOpen, onClose, onSave, onNavigate, dark }: FundedProductModalProps) {
  const timeInputRef = useRef<HTMLInputElement>(null);
  const [isTimePickerActive, setIsTimePickerActive] = useState(false);
  const { data: rulesetsData } = useListRulesetsQuery({ page: 1, size: 100 }, isOpen);
  const rulesets = rulesetsData?.items ?? [];
  // 연관 챌린지 상품 선택지. 다른 펀디드 상품에 이미 연결된 챌린지 상품은 고를 수 없다.
  const { data: challengeProductsData } = useListCatalogProductsQuery({ tier_type: "CHALLENGE", page: 1, size: 100 });
  const { data: fundedProductsData } = useListCatalogProductsQuery({ tier_type: "FUNDED", page: 1, size: 100 });

  const [formData, setFormData] = useState<FundedProduct>(
    product || {
      id: `fd-${Date.now()}`,
      amount: null,
      tier: "STARTER",
      leverage: null,
      balance: null,
      tradingPeriod: null,
      profitTarget: "N/A",
      dailyDrawdown: "N/A",
      maxDrawdown: null,
      maxDrawdownVip: null,
      marginCall: "",
      minTradingDays: null,
      stopOut: "",
      ruleset: "",
      rulesetName: "",
      mostPopular: false,
      status: "ACTIVE",
      productName: "",
      mtsGroupId: "",
      capital: null,
      accountRangeStart: null,
      accountRangeEnd: null,
      creationDelayHours: null,
    }
  );

  useEffect(() => {
    if (!isOpen) return;
    setFormData(product ?? {
      id: `fd-${Date.now()}`,
      amount: null,
      tier: "STARTER",
      leverage: null,
      balance: null,
      tradingPeriod: null,
      profitTarget: "",
      dailyDrawdown: "",
      maxDrawdown: null,
      maxDrawdownVip: null,
      marginCall: "",
      minTradingDays: null,
      stopOut: "",
      ruleset: "",
      rulesetName: "",
      mostPopular: false,
      status: "ACTIVE",
      productName: "",
      mtsGroupId: "",
      capital: null,
      accountRangeStart: null,
      accountRangeEnd: null,
      creationDelayHours: null,
    });
  }, [isOpen, product]);

  if (!isOpen) return null;

  const linkedBy = new Map(
    (fundedProductsData?.items ?? [])
      .filter((p) => p.related_id && p.product_id !== product?.id)
      .map((p) => [p.related_id as string, p.product_id]),
  );
  const challengeOptions = [
    { value: "", label: "연결 안 함" },
    ...(challengeProductsData?.items ?? []).map((p) => {
      const linked = linkedBy.get(p.product_id);
      return {
        value: p.product_id,
        label: `${p.product_id} · ${p.name ?? ""}${p.is_active ? "" : " (비활성)"}${linked ? ` (연결됨: ${linked})` : ""}`,
        disabled: Boolean(linked),
      };
    }),
  ];
  // 목록에 없는 값(예: 100개 넘는 경우)도 현재 값은 보이게 한다.
  if (formData.relatedChallengeId && !challengeOptions.some((o) => o.value === formData.relatedChallengeId)) {
    challengeOptions.push({ value: formData.relatedChallengeId, label: formData.relatedChallengeId, disabled: false });
  }

  const t = {
    surface: dark ? "#0F1829" : "#ffffff",
    surface2: dark ? "#1A2035" : "#F4F5F7",
    surface3: dark ? "#232C44" : "#E8EAF0",
    border: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.09)",
    border2: dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.14)",
    text: dark ? "#E8EAF0" : "#1A1A1A",
    textSec: dark ? "#8B8FA8" : "#4A4A58",
    textHint: dark ? "#5A6080" : "#A0A0AA",
    accent: "#7C6AF7",
    accentBg: "rgba(124,106,247,0.12)",
  };

  const formatTimeDisplay = (time24: string) => {
    if (!time24) return "";
    const [hours, minutes] = time24.split(":");
    const hour = parseInt(hours, 10);
    const period = hour < 12 ? "오전" : "오후";
    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${period} ${hour12.toString().padStart(2, "0")}:${minutes}`;
  };

  const handleClockClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (timeInputRef.current) {
      try {
        timeInputRef.current.showPicker();
      } catch (error) {
        // Fallback for cross-origin iframe contexts
        timeInputRef.current.focus();
      }
    }
  };

  const handleTimeWrapperClick = () => {
    if (timeInputRef.current) {
      try {
        timeInputRef.current.showPicker();
      } catch (error) {
        timeInputRef.current.focus();
      }
    }
  };

  const handleSubmit = () => {
    onSave(formData);
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: t.surface, borderRadius: 12, width: 560,
        maxHeight: "90vh", overflow: "hidden", display: "flex",
        flexDirection: "column", border: `1px solid ${t.border}`,
      }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          padding: "20px 24px", borderBottom: `1px solid ${t.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: t.text }}>
              {product ? "펀디드 상품 수정" : "펀디드 상품 추가"}
            </span>
          </div>
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
            {/* 기본 설정 Section */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 12 }}>
                기본 설정
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <InputField
                    label="상품 명"
                    value={formData.productName}
                    onChange={(v) => setFormData({ ...formData, productName: v })}
                    t={t}
                  />
                  <InputField
                    label="금액"
                    type="number"
                    value={formData.amount == null ? "" : String(formData.amount)}
                    onChange={(v) => setFormData({ ...formData, amount: v === "" ? null : Number(v) })}
                    suffix="$"
                    t={t}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <InputField
                    label="MTS 그룹 ID"
                    value={formData.mtsGroupId}
                    onChange={(v) => setFormData({ ...formData, mtsGroupId: v })}
                    t={t}
                  />
                  <InputField
                    label="캐피탈 (Capital)"
                    type="number"
                    value={formData.capital == null ? "" : String(formData.capital)}
                    onChange={(v) => setFormData({ ...formData, capital: v === "" ? null : Number(v) })}
                    suffix="$"
                    t={t}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <InputField
                    label="레버리지"
                    type="number"
                    value={formData.leverage == null ? "" : String(formData.leverage)}
                    onChange={(v) => setFormData({ ...formData, leverage: v === "" ? null : Number(v) })}
                    suffix="x"
                    placeholder="-"
                    t={t}
                  />
                  <InputField
                    label="Trading 기간"
                    type="number"
                    value={formData.tradingPeriod == null ? "" : String(formData.tradingPeriod)}
                    onChange={(v) => setFormData({ ...formData, tradingPeriod: v === "" ? null : Number(v) })}
                    suffix="영업일"
                    placeholder="-"
                    t={t}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <InputField
                    label="마진콜"
                    value={formData.marginCall || ""}
                    onChange={(v) => setFormData({ ...formData, marginCall: v })}
                    suffix="%"
                    t={t}
                  />
                  <InputField
                    label="Stop Out"
                    value={formData.stopOut}
                    onChange={(v) => setFormData({ ...formData, stopOut: v })}
                    suffix="%"
                    t={t}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <InputField
                    label="최소거래일"
                    type="number"
                    value={formData.minTradingDays == null ? "" : String(formData.minTradingDays)}
                    onChange={(v) => setFormData({ ...formData, minTradingDays: v === "" ? null : Math.max(0, Math.floor(Number(v))) })}
                    suffix="일"
                    placeholder="-"
                    t={t}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <SelectField
                    label="연관 챌린지 상품"
                    options={challengeOptions}
                    value={formData.relatedChallengeId ?? ""}
                    onChange={(v) => setFormData({ ...formData, relatedChallengeId: v })}
                    t={t}
                  />
                </div>
              </div>
            </div>

            {/* Account Range Section */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 8 }}>
                계좌 번호 레인지
              </div>
              <div style={{ fontSize: 12, color: t.textSec, marginBottom: 12 }}>
                해당 상품으로 생성되는 MT5 계좌 번호 범위를 지정합니다.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <InputField
                  label="시작 번호"
                  type="number"
                  value={formData.accountRangeStart == null ? "" : String(formData.accountRangeStart)}
                  onChange={(v) => setFormData({ ...formData, accountRangeStart: v === "" ? null : Number(v) })}
                  t={t}
                />
                <InputField
                  label="종료 번호"
                  type="number"
                  value={formData.accountRangeEnd == null ? "" : String(formData.accountRangeEnd)}
                  onChange={(v) => setFormData({ ...formData, accountRangeEnd: v === "" ? null : Number(v) })}
                  t={t}
                />
              </div>
              <div style={{ fontSize: 11, color: t.textHint, marginTop: 8 }}>
                ※ 레인지 참고: $100 → {ACCOUNT_RANGE_HINTS[100]} / $300 → {ACCOUNT_RANGE_HINTS[300]} / $500 → {ACCOUNT_RANGE_HINTS[500]}
              </div>
            </div>

            {/* 룰셋 선택 Section */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 12 }}>
                룰셋 선택
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: t.textSec }}>
                  적용 룰셋
                </span>
                <span style={{ fontSize: 11, fontWeight: 400, color: t.textHint, marginLeft: 4 }}>
                  손실 한도·Stop Out·Retry 등 운영 규칙
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <select
                    value={formData.ruleset || ""}
                    onChange={(e) => {
                      const rulesetId = e.target.value;
                      setFormData({
                        ...formData,
                        ruleset: rulesetId,
                        rulesetName: rulesets.find((rs) => rs.id === rulesetId)?.name ?? "",
                      });
                    }}
                    style={{
                      width: "100%", height: 36, padding: "0 12px", borderRadius: 8,
                      border: `1px solid ${t.border}`, background: t.surface2,
                      color: formData.ruleset ? t.text : t.textHint, fontSize: 13, cursor: "pointer",
                    }}
                  >
                    <option value="" style={{ color: t.textHint }}>룰셋을 선택하세요</option>
                    {formData.ruleset && !rulesets.some((rs) => rs.id === formData.ruleset) && (
                      <option value={formData.ruleset} style={{ color: t.text }}>
                        {formData.rulesetName || formData.ruleset}
                      </option>
                    )}
                    {rulesets.map((rs) => (
                      <option key={rs.id} value={rs.id} style={{ color: t.text }}>
                        {rs.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (onNavigate) {
                      onClose();
                      onNavigate("ruleset-management");
                    } else {
                      alert("룰셋 관리는 사이드바의 '챌린지 관리 > 상품 템플릿 > 룰셋 관리'에서 접근할 수 있습니다.");
                    }
                  }}
                  style={{
                    height: 36, padding: "0 12px", borderRadius: 8,
                    border: `1px solid ${t.border}`, background: t.surface2,
                    color: t.text, cursor: "pointer", fontSize: 13, fontWeight: 500,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    whiteSpace: "nowrap",
                  }}
                >
                  룰셋 관리 →
                </button>
              </div>

              {/* Preview Box */}
              {formData.ruleset && (() => {
                const selectedRuleset = rulesets.find(rs => rs.id === formData.ruleset);
                if (!selectedRuleset) return null;

                const previewItems = [
                  `일일 손실 ${formatRulesetLimit(selectedRuleset.daily_loss_limit_amt, selectedRuleset.daily_loss_limit_pct)}`,
                  `최대 손실 ${formatRulesetLimit(selectedRuleset.max_dd_normal_amt, selectedRuleset.max_dd_normal_pct)}`,
                  (selectedRuleset.profit_target_amt != null || selectedRuleset.profit_target_pct != null) && `수익 목표 ${formatRulesetLimit(selectedRuleset.profit_target_amt, selectedRuleset.profit_target_pct)}`,
                  `최소 거래일 ${selectedRuleset.min_trading_days}일`,
                  `미활동 ${selectedRuleset.inactivity_days}일`,
                ].filter(Boolean).join(" · ");

                return (
                  <div style={{
                    marginTop: 12, padding: 12, borderRadius: 8,
                    background: t.surface2, border: `1px solid ${t.border}`,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 4 }}>
                      {selectedRuleset.name || formData.rulesetName || formData.ruleset}
                    </div>
                    <div style={{ fontSize: 11, color: t.textSec }}>
                      {previewItems}
                    </div>
                  </div>
                );
              })()}
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
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper Component
interface InputFieldProps {
  label: string;
  required?: boolean;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  suffix?: string;
  placeholder?: string;
  t: any;
}

function InputField({ label, required, type = "text", value, onChange, suffix, placeholder, t }: InputFieldProps) {
  return (
    <div>
      {label && (
        <label style={{
          display: "block", fontSize: 12, fontWeight: 500,
          color: t.textSec, marginBottom: 6,
        }}>
          {label} {required && <span style={{ color: "#DC2626" }}>*</span>}
        </label>
      )}
      <div style={{ position: "relative" }}>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: "100%", height: 36, padding: suffix ? "0 32px 0 12px" : "0 12px",
            borderRadius: 8, border: `1px solid ${t.border}`,
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
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  options: readonly { value: string; label: string; disabled?: boolean }[];
  value: string;
  onChange: (value: string) => void;
  t: any;
}

function SelectField({ label, options, value, onChange, t }: SelectFieldProps) {
  return (
    <div>
      {label && (
        <label style={{
          display: "block", fontSize: 12, fontWeight: 500,
          color: t.textSec, marginBottom: 6,
        }}>
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%", height: 36, padding: "0 12px", borderRadius: 8,
          border: `1px solid ${t.border}`, background: t.surface2,
          color: t.text, fontSize: 13, cursor: "pointer",
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
