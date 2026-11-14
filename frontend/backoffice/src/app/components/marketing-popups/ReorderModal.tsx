import React, { useRef, useState } from "react";
import { GripVertical, X } from "lucide-react";
import type { PopupBanner } from "../../types/marketingPopup";

export function ReorderModal({ dark, items, onClose, onSave }: { dark: boolean; items: PopupBanner[]; onClose: () => void; onSave: (ordered: PopupBanner[]) => void | Promise<void> }) {
  const t = { surface: dark ? "#1A2035" : "#ffffff", surface2: dark ? "#232C44" : "#F4F5F7", border: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.09)", border2: dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.14)", text: dark ? "#E8EAF0" : "#1A1A1A", textSec: dark ? "#8B8FA8" : "#4A4A58", textHint: dark ? "#5A6080" : "#A0A0AA", accent: "#7C6AF7", overlay: "rgba(0,0,0,0.6)" };
  const [list, setList] = useState([...items]);
  const dragIdx = useRef<number | null>(null);
  const overIdx = useRef<number | null>(null);
  const onDragStart = (i: number) => { dragIdx.current = i; };
  const onDragOver = (e: React.DragEvent, i: number) => { e.preventDefault(); overIdx.current = i; };
  const onDrop = () => {
    const from = dragIdx.current; const to = overIdx.current;
    if (from === null || to === null || from === to) return;
    const next = [...list]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved);
    setList(next);
    dragIdx.current = null; overIdx.current = null;
  };
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, background: t.overlay, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24 }}>
      <div style={{ width: 560, maxHeight: "90vh", background: t.surface, borderRadius: 14, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 48px rgba(0,0,0,0.3)" }}>
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: t.text }}>노출 순서 조정</span>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: "50%", border: `1px solid ${t.border}`, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={14} style={{ color: t.textSec }} /></button>
        </div>
        <div style={{ padding: "14px 24px 8px", flexShrink: 0 }}>
          <p style={{ margin: 0, fontSize: 12, color: t.textSec, lineHeight: 1.6 }}>카드를 드래그하여 순서를 변경하세요. 변경된 순서는 프론트 팝업 노출 순서에 그대로 반영됩니다.</p>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 24px 16px" }}>
          {list.map((item, i) => (
            <div key={item.id} draggable onDragStart={() => onDragStart(i)} onDragOver={(e) => onDragOver(e, i)} onDrop={onDrop}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", marginBottom: 6, background: t.surface2, borderRadius: 8, border: `1px solid ${t.border}`, cursor: "grab", userSelect: "none" }}>
              <GripVertical size={16} style={{ color: t.textHint, flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: t.textHint, minWidth: 22, flexShrink: 0 }}>{i + 1}</span>
              <div style={{ width: 36, height: 44, borderRadius: 6, overflow: "hidden", border: `1px solid ${t.border}`, flexShrink: 0 }}>
                <img src={item.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <span style={{ fontSize: 13, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{item.title}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: "16px 24px", borderTop: `1px solid ${t.border}`, display: "flex", justifyContent: "flex-end", gap: 8, flexShrink: 0 }}>
          <button onClick={onClose} style={{ height: 36, padding: "0 18px", borderRadius: 8, border: `1px solid ${t.border2}`, background: "transparent", color: t.text, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>취소</button>
          <button onClick={() => { void onSave(list); }} style={{ height: 36, padding: "0 22px", borderRadius: 8, border: "none", background: t.accent, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>저장</button>
        </div>
      </div>
    </div>
  );
}
