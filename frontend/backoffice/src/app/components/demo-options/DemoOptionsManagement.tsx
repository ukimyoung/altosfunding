import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useDemoOptionsConfigQuery, useUpdateDemoConfigMutation } from "../../queries/demoOptions";
import type { DemoConfigKey } from "../../../api/demoOptions";

interface DemoOptionsManagementProps {
  dark: boolean;
  onToast: (message: string, type?: "success" | "warning") => void;
}

type Theme = Record<string, string>;

// 사용자 웹 My Account > Create New Demo Account 팝업의 선택지 두 가지를 관리한다.
type OptionKind = "capital" | "leverage";

const KIND: Record<OptionKind, {
  title: string;
  description: string;
  listKey: DemoConfigKey;
  defaultKey: DemoConfigKey;
  unit: string;
  placeholder: string;
  helper: string;
  integerOnly: boolean;
  max: number;
  format: (value: number) => string;
}> = {
  capital: {
    title: "Initial Balance",
    description: "데모 계좌 생성 시 선택할 수 있는 초기 자본금 (USDT)",
    listKey: "allowed_capitals",
    defaultKey: "default_capital",
    unit: "USDT",
    placeholder: "예: 25000",
    helper: "사용자 화면에는 $25,000 형태로 표시됩니다.",
    integerOnly: false,
    max: 100_000_000,
    format: (value) => `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
  },
  leverage: {
    title: "Leverage",
    description: "데모 계좌 생성 시 선택할 수 있는 레버리지",
    listKey: "allowed_leverages",
    defaultKey: "default_leverage",
    unit: "배",
    placeholder: "예: 300",
    helper: "1:N 형식의 N 값을 입력합니다. 사용자 화면에는 1:300 형태로 표시됩니다.",
    integerOnly: true,
    max: 10_000,
    format: (value) => `1:${value}`,
  },
};

const MAX_OPTIONS = 20;
const FONT = "'Inter','DM Sans','Noto Sans KR',sans-serif";

function DefaultBadge() {
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 12, background: "rgba(22,163,74,0.1)", color: "#16A34A", border: "1px solid rgba(22,163,74,0.2)", whiteSpace: "nowrap" }}>
      기본값
    </span>
  );
}

// ─── 선택지 추가/수정 모달 ────────────────────────────────────────────────────

interface OptionModalProps {
  t: Theme;
  kind: OptionKind;
  editingValue: number | null;
  isDefault: boolean;
  values: number[];
  saving: boolean;
  onClose: () => void;
  onSave: (value: number, makeDefault: boolean) => void;
}

function OptionModal({ t, kind, editingValue, isDefault, values, saving, onClose, onSave }: OptionModalProps) {
  const conf = KIND[kind];
  const [input, setInput] = useState(editingValue != null ? String(editingValue) : "");
  const [makeDefault, setMakeDefault] = useState(isDefault);

  const inputStyle: React.CSSProperties = {
    height: 38, padding: "0 12px", borderRadius: 8,
    border: `1px solid ${t.border2}`, background: t.surface2,
    color: t.text, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box", fontFamily: FONT,
  };
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: t.textSec, marginBottom: 5, display: "block" };
  const helperStyle: React.CSSProperties = { fontSize: 11, color: t.textHint, marginTop: 4 };

  const parsed = Number(input);
  const preview = input.trim() && Number.isFinite(parsed) && parsed > 0 ? conf.format(parsed) : "—";

  function handleSave() {
    const value = Number(input.trim());
    if (!input.trim() || !Number.isFinite(value) || value <= 0) { alert("0보다 큰 숫자를 입력해주세요."); return; }
    if (conf.integerOnly && !Number.isInteger(value)) { alert("레버리지는 정수로 입력해주세요."); return; }
    if (!conf.integerOnly && Math.round(value * 100) !== value * 100) { alert("자본금은 소수점 둘째 자리까지 입력할 수 있습니다."); return; }
    if (value > conf.max) { alert(`${conf.max.toLocaleString()} 이하로 입력해주세요.`); return; }
    if (values.some((v) => v === value && v !== editingValue)) { alert("이미 등록된 값입니다."); return; }
    onSave(value, makeDefault);
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24 }}>
      <div style={{ width: 440, maxHeight: "90vh", background: t.surface, borderRadius: 16, border: `1px solid ${t.border2}`, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{conf.title} {editingValue != null ? "수정" : "추가"}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: t.textSec, display: "flex", alignItems: "center" }}><X size={18} /></button>
        </div>

        <div style={{ padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>{kind === "capital" ? "초기 자본금 *" : "레버리지 *"}</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {kind === "leverage" && <span style={{ fontSize: 14, fontWeight: 600, color: t.textSec }}>1 :</span>}
              <input
                type="number" min="1" step={conf.integerOnly ? 1 : "any"} autoFocus
                value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleSave(); }}
                placeholder={conf.placeholder} style={{ ...inputStyle, width: 200 }}
              />
              {kind === "capital" && <span style={{ fontSize: 14, fontWeight: 600, color: t.textSec }}>{conf.unit}</span>}
            </div>
            <p style={helperStyle}>{conf.helper}</p>
          </div>

          <div>
            <label style={labelStyle}>사용자 화면 표시</label>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.text, fontFamily: "'DM Mono',monospace" }}>{preview}</div>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: isDefault ? "not-allowed" : "pointer", fontSize: 13, color: t.text }}>
            <input
              type="checkbox" checked={makeDefault} disabled={isDefault}
              onChange={e => setMakeDefault(e.target.checked)}
              style={{ accentColor: "#7C6AF7", width: 15, height: 15 }}
            />
            팝업을 열 때 이 값을 기본으로 선택
          </label>
        </div>

        <div style={{ padding: "14px 24px", borderTop: `1px solid ${t.border}`, display: "flex", justifyContent: "flex-end", gap: 8, flexShrink: 0 }}>
          <button onClick={onClose} style={{ height: 38, padding: "0 20px", borderRadius: 8, border: `1px solid ${t.border2}`, background: "transparent", color: t.textSec, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: FONT }}>취소</button>
          <button onClick={handleSave} disabled={saving} style={{ height: 38, padding: "0 24px", borderRadius: 8, border: "none", background: "#7C6AF7", color: "#fff", fontSize: 13, fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1, fontFamily: FONT }}>{saving ? "저장 중..." : "저장"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── 선택지 목록 카드 ─────────────────────────────────────────────────────────

interface OptionTableProps {
  t: Theme;
  kind: OptionKind;
  values: number[];
  defaultValue: number;
  loading: boolean;
  error: boolean;
  busy: boolean;
  onAdd: () => void;
  onEdit: (value: number) => void;
  onDelete: (value: number) => void;
  onMakeDefault: (value: number) => void;
}

function OptionTable({ t, kind, values, defaultValue, loading, error, busy, onAdd, onEdit, onDelete, onMakeDefault }: OptionTableProps) {
  const conf = KIND[kind];
  const thStyle: React.CSSProperties = {
    padding: "10px 14px", fontSize: 11, fontWeight: 700, color: t.textSec,
    textAlign: "left", whiteSpace: "nowrap", background: t.surface3,
    borderBottom: `1px solid ${t.border2}`, letterSpacing: "0.05em",
  };
  const tdStyle: React.CSSProperties = {
    padding: "12px 14px", fontSize: 13, color: t.text, borderBottom: `1px solid ${t.border}`, verticalAlign: "middle",
  };
  const linkBtn = (color: string): React.CSSProperties => ({
    background: "none", border: "none", cursor: busy ? "default" : "pointer", fontSize: 13, color, padding: 0, fontFamily: FONT, fontWeight: 500, opacity: busy ? 0.5 : 1,
  });

  return (
    <div style={{ background: t.surface, border: `1px solid ${t.border2}`, borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{conf.title}</span>
          <div style={{ fontSize: 11, color: t.textHint, marginTop: 2 }}>{conf.description}</div>
        </div>
        <button
          onClick={onAdd}
          disabled={busy || values.length >= MAX_OPTIONS}
          title={values.length >= MAX_OPTIONS ? `선택지는 ${MAX_OPTIONS}개까지 등록할 수 있습니다.` : ""}
          style={{
            height: 36, padding: "0 16px", borderRadius: 8, border: "none", background: "#7C6AF7",
            color: "#fff", fontSize: 13, fontWeight: 600, cursor: busy ? "default" : "pointer", flexShrink: 0,
            display: "flex", alignItems: "center", gap: 6, fontFamily: FONT,
            opacity: busy || values.length >= MAX_OPTIONS ? 0.5 : 1,
          }}
        >
          <Plus size={14} /> 선택지 추가
        </button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <colgroup>
            <col style={{ width: "12%" }} />
            <col style={{ width: "34%" }} />
            <col style={{ width: "24%" }} />
            <col style={{ width: "30%" }} />
          </colgroup>
          <thead>
            <tr>
              <th style={thStyle}>No.</th>
              <th style={thStyle}>{kind === "capital" ? "초기 자본금" : "레버리지"}</th>
              <th style={thStyle}>기본값</th>
              <th style={thStyle}>관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ ...tdStyle, textAlign: "center", color: t.textHint, padding: "40px 14px" }}>선택지를 불러오는 중입니다.</td></tr>
            ) : error ? (
              <tr><td colSpan={4} style={{ ...tdStyle, textAlign: "center", color: "#DC2626", padding: "40px 14px" }}>선택지를 불러오지 못했습니다.</td></tr>
            ) : values.map((value, index) => {
              const isDefault = value === defaultValue;
              return (
                <tr key={value} style={{ transition: "background 0.1s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = t.surface2)}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ ...tdStyle, color: t.textSec, fontFamily: "'DM Mono',monospace" }}>{index + 1}</td>
                  <td style={tdStyle}>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, fontSize: 13 }}>{conf.format(value)}</span>
                  </td>
                  <td style={tdStyle}>
                    {isDefault ? <DefaultBadge /> : (
                      <button onClick={() => !busy && onMakeDefault(value)} style={linkBtn(t.textSec)}>기본값으로 지정</button>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={() => !busy && onEdit(value)} style={linkBtn("#7C6AF7")}>수정</button>
                      <button onClick={() => !busy && onDelete(value)} style={linkBtn("#DC2626")}>삭제</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function DemoOptionsManagement({ dark, onToast }: DemoOptionsManagementProps) {
  const t: Theme = {
    surface:  dark ? "#0F1829" : "#ffffff",
    surface2: dark ? "#1A2035" : "#F4F5F7",
    surface3: dark ? "#232C44" : "#E8EAF0",
    border:   dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.09)",
    border2:  dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.14)",
    text:     dark ? "#E8EAF0" : "#1A1A1A",
    textSec:  dark ? "#8B8FA8" : "#4A4A58",
    textHint: dark ? "#5A6080" : "#A0A0AA",
    pageBg:   dark ? "#0A0F1E" : "#F4F5F7",
    accent:   "#7C6AF7",
    accentBg: "rgba(124,106,247,0.12)",
    accentBd: "rgba(124,106,247,0.2)",
  };

  const configQuery = useDemoOptionsConfigQuery();
  const updateMutation = useUpdateDemoConfigMutation();
  const [modal, setModal] = useState<{ kind: OptionKind; editingValue: number | null } | null>(null);

  const config = configQuery.data;
  const lists: Record<OptionKind, number[]> = {
    capital: config?.allowedCapitals ?? [],
    leverage: config?.allowedLeverages ?? [],
  };
  const defaults: Record<OptionKind, number> = {
    capital: config?.defaultCapital ?? 0,
    leverage: config?.defaultLeverage ?? 0,
  };

  // 목록은 항상 오름차순으로 저장해 사용자 팝업에도 같은 순서로 보이게 한다.
  async function save(kind: OptionKind, nextValues: number[] | null, nextDefault: number | null, message: string) {
    const conf = KIND[kind];
    const changes: { key: DemoConfigKey; value: number | number[] }[] = [];
    if (nextValues) changes.push({ key: conf.listKey, value: [...nextValues].sort((a, b) => a - b) });
    if (nextDefault != null && nextDefault !== defaults[kind]) changes.push({ key: conf.defaultKey, value: nextDefault });
    if (changes.length === 0) return true;
    try {
      await updateMutation.mutateAsync(changes);
      onToast(message, "success");
      return true;
    } catch {
      onToast("저장에 실패했습니다. 잠시 후 다시 시도해주세요.", "warning");
      return false;
    }
  }

  async function handleModalSave(value: number, makeDefault: boolean) {
    if (!modal) return;
    const { kind, editingValue } = modal;
    const values = lists[kind];
    const wasDefault = editingValue != null && editingValue === defaults[kind];
    const nextValues = editingValue != null ? values.map(v => (v === editingValue ? value : v)) : [...values, value];
    // 기본값을 수정하면 바뀐 값이 계속 기본값이 된다.
    const nextDefault = makeDefault || wasDefault ? value : null;
    const ok = await save(kind, nextValues, nextDefault, editingValue != null ? "선택지가 수정되었습니다." : "선택지가 추가되었습니다.");
    if (ok) setModal(null);
  }

  function handleDelete(kind: OptionKind, value: number) {
    const values = lists[kind];
    if (values.length <= 1) { alert("선택지는 최소 1개 이상 있어야 합니다."); return; }
    if (value === defaults[kind]) { alert("기본값은 삭제할 수 없습니다. 다른 값을 기본값으로 지정한 뒤 삭제해주세요."); return; }
    if (!window.confirm(`${KIND[kind].format(value)} 선택지를 삭제하시겠습니까?\n이미 생성된 데모 계좌에는 영향이 없습니다.`)) return;
    void save(kind, values.filter(v => v !== value), null, "선택지가 삭제되었습니다.");
  }

  function handleMakeDefault(kind: OptionKind, value: number) {
    void save(kind, null, value, `기본값이 ${KIND[kind].format(value)}(으)로 변경되었습니다.`);
  }

  const busy = updateMutation.isPending || configQuery.isFetching;

  return (
    <div style={{ padding: "24px 28px 48px", fontFamily: FONT, minHeight: "100vh", background: t.pageBg }}>

      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text, margin: 0 }}>데모 계정 관리</h1>
        <p style={{ fontSize: 13, color: t.textSec, marginTop: 4, marginBottom: 0 }}>
          사용자 웹 My Account의 'Create New Demo Account' 팝업에서 선택할 수 있는 Initial Balance와 Leverage를 관리합니다.
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Initial Balance 선택지", value: config ? `${lists.capital.length}` : "—", suffix: config ? "개" : "", caption: `최대 ${MAX_OPTIONS}개` },
          { label: "기본 Initial Balance", value: config ? KIND.capital.format(defaults.capital) : "—", suffix: "", caption: "팝업을 열 때 선택된 값" },
          { label: "Leverage 선택지", value: config ? `${lists.leverage.length}` : "—", suffix: config ? "개" : "", caption: `최대 ${MAX_OPTIONS}개` },
          { label: "기본 Leverage", value: config ? KIND.leverage.format(defaults.leverage) : "—", suffix: "", caption: "팝업을 열 때 선택된 값" },
        ].map(card => (
          <div key={card.label} style={{ background: t.surface, border: `1px solid ${t.border2}`, borderRadius: 12, padding: "16px 20px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: t.textSec, marginBottom: 8, letterSpacing: "0.04em" }}>{card.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: t.text, letterSpacing: "-0.5px" }}>
              {card.value}
              {card.suffix && <span style={{ fontSize: 14, fontWeight: 500, color: t.textSec, marginLeft: 3 }}>{card.suffix}</span>}
            </div>
            <div style={{ fontSize: 11, color: t.textHint, marginTop: 4 }}>{card.caption}</div>
          </div>
        ))}
      </div>

      {/* Option tables */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 20 }}>
        {(["capital", "leverage"] as const).map(kind => (
          <OptionTable
            key={kind}
            t={t}
            kind={kind}
            values={lists[kind]}
            defaultValue={defaults[kind]}
            loading={configQuery.isLoading}
            error={configQuery.isError}
            busy={busy}
            onAdd={() => setModal({ kind, editingValue: null })}
            onEdit={value => setModal({ kind, editingValue: value })}
            onDelete={value => handleDelete(kind, value)}
            onMakeDefault={value => handleMakeDefault(kind, value)}
          />
        ))}
      </div>

      <p style={{ fontSize: 11, color: t.textHint, marginTop: 14 }}>
        변경 내용은 저장 즉시 사용자 팝업에 반영됩니다. 선택지를 수정·삭제해도 이미 생성된 데모 계좌의 자본금과 레버리지는 바뀌지 않습니다.
      </p>

      {modal && (
        <OptionModal
          key={`${modal.kind}-${modal.editingValue ?? "new"}`}
          t={t}
          kind={modal.kind}
          editingValue={modal.editingValue}
          isDefault={modal.editingValue != null && modal.editingValue === defaults[modal.kind]}
          values={lists[modal.kind]}
          saving={updateMutation.isPending}
          onClose={() => setModal(null)}
          onSave={handleModalSave}
        />
      )}
    </div>
  );
}
