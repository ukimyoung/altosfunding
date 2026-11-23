import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { ChallengeProduct } from "../../types/product";
import { SCHEDULE_STATUS, ASSIGNMENT_METHOD, ACCOUNT_RANGE_HINTS } from "../../constants/status";
import { useListRulesetsQuery } from "../../queries/rulesets";
import { formatRulesetLimit } from "../../utils/rulesetFormat";

// '추천' 선택은 'MOST POPULAR' 체크박스로 합침 (2026-11-16)
// const RECOMMEND_OPTIONS = [
//   { value: "N", label: "비추천 (기본)" },
//   { value: "Y", label: "추천" },
// ] as const;

const FUNDED_ISSUE_METHOD_OPTIONS = [
  { value: "AUTO", label: "자동 발급" },
  { value: "MANUAL", label: "수동 발급" },
] as const;

interface ChallengeProductModalProps {
  product: ChallengeProduct | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: ChallengeProduct) => void;
  onNavigate?: (navId: string) => void;
  dark: boolean;
}

export function ChallengeProductModal({ product, isOpen, onClose, onSave, onNavigate, dark }: ChallengeProductModalProps) {
  const [activeTab, setActiveTab] = useState<"basic" | "schedule">("basic");
  const [discountError, setDiscountError] = useState("");
  const { data: rulesetsData } = useListRulesetsQuery({ page: 1, size: 100 }, isOpen);
  const rulesets = rulesetsData?.items ?? [];
  const [formData, setFormData] = useState<ChallengeProduct>(
    product || {
      id: `ch-${Date.now()}`,
      amount: null,
      tier: "STARTER",
      leverage: null,
      balance: null,
      tradingPeriod: null,
      passConditionType: "상대평가",
      passConditionValue: 0,
      maxDrawdown: null,
      marginCall: "",
      stopOut: "",
      drawdownMethod: "미설정",
      retryPolicy: "미설정",
      ruleset: "",
      rulesetName: "",
      mostPopular: false,
      status: "ACTIVE",
      productName: "",
      mtsGroupId: "",
      capital: null,
      accountRangeStart: null,
      accountRangeEnd: null,
      profitTarget: "N/A",
      dailyDrawdown: "N/A",
      creationDelayHours: null,
      fundedIssueMethod: "AUTO",
      challengeNameTemplate: "",
      seasonLabel: "",
      scheduleStatus: "ACTIVE",
      groupSize: 0,
      assignmentMethod: "RANDOM",
      intervalDays: 0,
      durationDays: 0,
      maxOccurrences: 0,
      startTime: "",
      endTime: "",
      excludeHoliday: false,
      totalGenerated: 0,
      lastGeneratedDate: "",
    }
  );

  useEffect(() => {
    if (!isOpen) return;
    setFormData(product ?? {
      id: `ch-${Date.now()}`,
      amount: null,
      tier: "STARTER",
      leverage: null,
      balance: null,
      tradingPeriod: null,
      passConditionType: "",
      passConditionValue: 0,
      maxDrawdown: null,
      marginCall: "",
      stopOut: "",
      drawdownMethod: "",
      retryPolicy: "",
      ruleset: "",
      rulesetName: "",
      mostPopular: false,
      status: "ACTIVE",
      productName: "",
      mtsGroupId: "",
      capital: null,
      accountRangeStart: null,
      accountRangeEnd: null,
      profitTarget: "",
      dailyDrawdown: "",
      creationDelayHours: null,
      fundedIssueMethod: "AUTO",
      challengeNameTemplate: "",
      seasonLabel: "",
      scheduleStatus: "ACTIVE",
      groupSize: 0,
      assignmentMethod: "",
      intervalDays: 0,
      durationDays: 0,
      maxOccurrences: 0,
      startTime: "",
      endTime: "",
      excludeHoliday: false,
      totalGenerated: 0,
      lastGeneratedDate: "",
    });
    setActiveTab("basic");
    setDiscountError("");
  }, [isOpen, product]);

  if (!isOpen) return null;

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

  const fundedIssueMethod = formData.fundedIssueMethod ?? "AUTO";
  const isAutoIssue = fundedIssueMethod === "AUTO";

  const handleSubmit = () => {
    if (formData.discountAmount != null && formData.amount != null && formData.discountAmount > formData.amount) {
      setDiscountError("할인가격은 원가격보다 클 수 없습니다.");
      return;
    }
    onSave(formData);
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
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: t.text }}>
              {product ? "챌린지 상품 수정" : "챌린지 상품 추가"}
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

        {/* Tabs */}
        <div style={{
          display: "flex", gap: 24, padding: "0 24px",
          borderBottom: `1px solid ${t.border}`,
        }}>
          {[
            { key: "basic" as const, label: "기본 설정" },
            // { key: "schedule" as const, label: "자동 생성 스케줄" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "12px 0", border: "none", background: "none",
                fontSize: 13, fontWeight: 500, cursor: "pointer",
                color: activeTab === tab.key ? t.accent : t.textSec,
                borderBottom: activeTab === tab.key ? `2px solid ${t.accent}` : "2px solid transparent",
                transition: "all 0.2s",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {activeTab === "basic" && (
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
                      label="원가격"
                      type="number"
                      value={formData.amount == null ? "" : String(formData.amount)}
                      onChange={(v) => setFormData({ ...formData, amount: v === "" ? null : Number(v) })}
                      suffix="$"
                      t={t}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <InputField
                        label="할인가격"
                        type="number"
                        value={formData.discountAmount == null ? "" : String(formData.discountAmount)}
                        onChange={(v) => {
                          setDiscountError("");
                          setFormData({ ...formData, discountAmount: v === "" ? null : Number(v) });
                        }}
                        suffix="$"
                        placeholder="-"
                        hint={discountError ? undefined : "비우면 할인 없이 원가격으로 판매합니다"}
                        t={t}
                      />
                      {discountError && (
                        <div style={{ fontSize: 11, color: "#DC2626", marginTop: 4 }}>{discountError}</div>
                      )}
                    </div>
                    {/* '추천' 선택은 아래 'MOST POPULAR' 체크박스로 합침 (2026-11-16)
                    <SelectField
                      label="추천"
                      options={RECOMMEND_OPTIONS}
                      value={formData.mostPopular ? "Y" : "N"}
                      onChange={(v) => setFormData({ ...formData, mostPopular: v === "Y" })}
                      t={t}
                    />
                    */}
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
                </div>
              </div>

              {/* Funded Issue Method Section */}
              <div style={{
                padding: 16, borderRadius: 8, background: t.accentBg,
                border: `1px solid ${t.border}`,
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 12 }}>
                  펀디드 계좌 발급 방법 선택
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
                  {FUNDED_ISSUE_METHOD_OPTIONS.map((opt) => (
                    <label key={opt.value} style={{
                      display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
                    }}>
                      <input
                        type="radio"
                        name="fundedIssueMethod"
                        checked={fundedIssueMethod === opt.value}
                        onChange={() => setFormData({ ...formData, fundedIssueMethod: opt.value })}
                        style={{ accentColor: t.accent }}
                      />
                      <span style={{ fontSize: 13, color: t.text }}>{opt.label}</span>
                    </label>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: t.textHint, marginTop: 8 }}>
                  {fundedIssueMethod === "AUTO"
                    ? "챌린지 합격 시 아래 설정한 시점에 펀디드 계좌를 자동으로 발급합니다."
                    : "챌린지 합격 후 관리자가 직접 펀디드 계좌를 발급합니다."}
                </div>
              </div>

              {/* Auto-Creation Timing Section (수동 발급이면 비활성) */}
              <div style={{
                padding: 16, borderRadius: 8, background: t.accentBg,
                border: `1px solid ${t.border}`,
                opacity: isAutoIssue ? 1 : 0.45,
              }}
                aria-disabled={!isAutoIssue}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 12 }}>
                  챌린지 종료 후 펀디드 계좌 자동 생성 시점
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <label style={{
                      fontSize: 12, fontWeight: 500, color: t.textSec,
                    }}>
                      생성 시작 시간
                    </label>
                    <span style={{ fontSize: 11, color: t.textHint }}>
                      챌린지 종료 후 N시간 이후 자동 생성
                    </span>
                  </div>
                  <div style={{ position: "relative", maxWidth: 200 }}>
                    <input
                      type="number"
                      min="0"
                      max="240"
                      value={formData.creationDelayHours ?? ""}
                      onChange={(e) => setFormData({ ...formData, creationDelayHours: e.target.value === "" ? null : Number(e.target.value) })}
                      placeholder="48"
                      disabled={!isAutoIssue}
                      style={{
                        cursor: isAutoIssue ? "text" : "not-allowed",
                        width: "100%", height: 36, padding: "0 64px 0 12px",
                        borderRadius: 8, border: `1px solid ${t.border}`,
                        background: t.surface2, color: t.text, fontSize: 13,
                      }}
                    />
                    <span style={{
                      position: "absolute", right: 12, top: "50%",
                      transform: "translateY(-50%)", fontSize: 13,
                      color: t.textHint, pointerEvents: "none",
                    }}>
                      시간 후
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: t.textHint, marginTop: 6 }}>
                    예: 48 입력 시 챌린지 종료 시점으로부터 48시간 후에 MT4 펀디드 계좌 자동 생성
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
                      체크 시 이 상품에 'MOST POPULAR' 뱃지가 랜딩페이지 Account Size와 Start New Challenge 카드에 표시됩니다.
                    </div>
                  </div>
                </label>
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
          )}

          {activeTab === "schedule" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <InputField
                label="챌린지명 생성 템플릿"
                value={formData.challengeNameTemplate}
                onChange={(v) => setFormData({ ...formData, challengeNameTemplate: v })}
                t={t}
              />

              <InputField
                label="시즌 라벨 (season_id)"
                value={formData.seasonLabel}
                onChange={(v) => setFormData({ ...formData, seasonLabel: v })}
                t={t}
              />

              <RadioGroup
                label="상태 (status)"
                options={SCHEDULE_STATUS}
                value={formData.scheduleStatus}
                onChange={(v) => setFormData({ ...formData, scheduleStatus: v })}
                t={t}
              />

              <InputField
                label="세션당 인원수"
                type="number"
                value={String(formData.groupSize)}
                onChange={(v) => setFormData({ ...formData, groupSize: Number(v) })}
                suffix="명"
                t={t}
              />

              <RadioGroup
                label="배정 방식 (assignment_method)"
                options={ASSIGNMENT_METHOD}
                value={formData.assignmentMethod}
                onChange={(v) => setFormData({ ...formData, assignmentMethod: v })}
                t={t}
              />

              <InputField
                label="생성 주기"
                type="number"
                value={String(formData.intervalDays)}
                onChange={(v) => setFormData({ ...formData, intervalDays: Number(v) })}
                suffix="일"
                hint="매 N일마다 새 세션을 자동 생성합니다"
                t={t}
              />

              <InputField
                label="세션 기간"
                type="number"
                value={String(formData.durationDays)}
                onChange={(v) => setFormData({ ...formData, durationDays: Number(v) })}
                suffix="일"
                hint="각 세션의 유효 기간입니다"
                t={t}
              />

              <InputField
                label="최대 반복 횟수"
                type="number"
                value={String(formData.maxOccurrences)}
                onChange={(v) => setFormData({ ...formData, maxOccurrences: Number(v) })}
                t={t}
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <InputField
                  label="시작 시각"
                  value={formData.startTime}
                  onChange={(v) => setFormData({ ...formData, startTime: v })}
                  placeholder="09:00 AM"
                  t={t}
                />
                <InputField
                  label="종료 시각"
                  value={formData.endTime}
                  onChange={(v) => setFormData({ ...formData, endTime: v })}
                  placeholder="05:00 PM"
                  t={t}
                />
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={formData.excludeHoliday}
                  onChange={(e) => setFormData({ ...formData, excludeHoliday: e.target.checked })}
                />
                <span style={{ fontSize: 13, color: t.text }}>공휴일 제외</span>
              </label>

              {/* Read-only info */}
              <div style={{
                padding: 16, borderRadius: 8, background: t.surface2,
                border: `1px solid ${t.border}`,
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.textSec, marginBottom: 12 }}>
                  생성 통계 (읽기 전용)
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: t.textSec }}>누적 생성 횟수</span>
                    <span style={{ fontSize: 12, color: t.text, fontWeight: 600 }}>{formData.totalGenerated}회</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: t.textSec }}>마지막 생성일</span>
                    <span style={{ fontSize: 12, color: t.text, fontWeight: 600 }}>
                      {formData.lastGeneratedDate || "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
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

// Helper Components
interface InputFieldProps {
  label: string;
  required?: boolean;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  suffix?: string;
  hint?: string;
  placeholder?: string;
  t: any;
}

function InputField({ label, required, type = "text", value, onChange, suffix, hint, placeholder, t }: InputFieldProps) {
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
      {hint && (
        <div style={{ fontSize: 11, color: t.textHint, marginTop: 4 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

interface RadioGroupProps {
  label: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  t: any;
}

function RadioGroup({ label, options, value, onChange, t }: RadioGroupProps) {
  return (
    <div>
      <label style={{
        display: "block", fontSize: 12, fontWeight: 500,
        color: t.textSec, marginBottom: 8,
      }}>
        {label}
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {options.map((opt) => (
          <label key={opt.value} style={{
            display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
          }}>
            <input
              type="radio"
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
            />
            <span style={{ fontSize: 13, color: t.text }}>{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  t: any;
}

function SelectField({ label, options, value, onChange, t }: SelectFieldProps) {
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
        style={{
          width: "100%", height: 36, padding: "0 12px", borderRadius: 8,
          border: `1px solid ${t.border}`, background: t.surface2,
          color: t.text, fontSize: 13, cursor: "pointer",
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
