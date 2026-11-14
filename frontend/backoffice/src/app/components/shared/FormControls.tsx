import { useState } from "react";
import type { CSSProperties } from "react";
import type { Tok } from "../../theme/tokens";

// 모달 폼에서 반복 사용하는 label, input, radio, textarea 컨트롤입니다.

export function SectionLabel({ label, t }: { label: string; t: Tok }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: t.textSec, letterSpacing: "0.07em", textTransform: "uppercase", fontFamily: "'DM Sans',sans-serif", borderBottom: `1px solid ${t.border}`, paddingBottom: 6, marginBottom: 16 }}>
      {label}
    </div>
  );
}

export function FormLabel({ label, required, t }: { label: string; required?: boolean; t: Tok }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 500, color: t.textSec, fontFamily: "'Noto Sans KR','DM Sans',sans-serif", marginBottom: 6, display: "flex", alignItems: "center", gap: 3 }}>
      {label}
      {required && <span style={{ color: "#DC2626", fontSize: 12, lineHeight: 1 }}>*</span>}
    </div>
  );
}

export function FormInput({
  placeholder,
  type = "text",
  t,
  style,
  value,
  onChange,
}: {
  placeholder: string;
  type?: string;
  t: Tok;
  style?: CSSProperties;
  value?: string;
  onChange?: (value: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      placeholder={placeholder}
      type={type}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        height: 38, background: t.surface2, border: `1px solid ${focused ? "#7C6AF7" : t.border2}`,
        borderRadius: 8, fontSize: 13, padding: "0 12px", color: t.text, outline: "none", width: "100%",
        boxSizing: "border-box", fontFamily: "'Noto Sans KR','DM Sans',sans-serif",
        transition: "border-color 0.15s", ...style,
      }}
    />
  );
}

export function RadioItem({ label, selected, onClick, t }: { label: string; selected: boolean; onClick: () => void; t: Tok }) {
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 8, height: 32, cursor: "pointer" }}>
      <div style={{
        width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
        background: selected ? "#7C6AF7" : t.surface2,
        border: selected ? "none" : `1.5px solid ${t.border2}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.15s",
      }}>
        {selected && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
      </div>
      <span style={{ fontSize: 12, color: t.textSec, fontFamily: "'Noto Sans KR',sans-serif" }}>{label}</span>
    </div>
  );
}

export function TextareaField({
  placeholder,
  t,
  value,
  onChange,
}: {
  placeholder: string;
  t: Tok;
  value?: string;
  onChange?: (value: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <textarea
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: "100%", height: 80, background: t.surface2,
        border: `1px solid ${focused ? "#7C6AF7" : t.border2}`,
        borderRadius: 8, fontSize: 13, padding: "10px 12px", color: t.text,
        outline: "none", resize: "vertical", boxSizing: "border-box",
        fontFamily: "'Noto Sans KR','DM Sans',sans-serif", transition: "border-color 0.15s",
      }}
    />
  );
}
