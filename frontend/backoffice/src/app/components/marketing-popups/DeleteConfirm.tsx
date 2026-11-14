import type { MarketingPopupTheme } from "../../types/marketingPopup";

export function DeleteConfirm({ onConfirm, onClose, t }: { onConfirm: () => void | Promise<void>; onClose: () => void; t: MarketingPopupTheme }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: 24 }}>
      <div style={{ width: 380, background: t.surface, borderRadius: 14, overflow: "hidden", boxShadow: "0 24px 48px rgba(0,0,0,0.3)" }}>
        <div style={{ padding: "20px 24px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#DC2626" }}>배너 삭제</div>
          <div style={{ fontSize: 13, color: t.textSec, lineHeight: 1.6 }}>이 팝업 배너를 삭제하시겠습니까?<br/>삭제 후에는 복원할 수 없습니다.</div>
        </div>
        <div style={{ padding: "12px 24px 20px", display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ height: 36, padding: "0 18px", borderRadius: 8, border: `1px solid ${t.border2}`, background: "transparent", color: t.text, fontSize: 13, cursor: "pointer" }}>취소</button>
          <button onClick={() => { void onConfirm(); }} style={{ height: 36, padding: "0 20px", borderRadius: 8, border: "none", background: "#DC2626", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>삭제</button>
        </div>
      </div>
    </div>
  );
}
