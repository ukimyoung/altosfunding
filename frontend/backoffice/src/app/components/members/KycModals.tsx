import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { ModalCloseBtn } from "../shared/ModalCloseButton";
import { tok } from "../../theme/tokens";

export function KycApproveModal({ dark, onCancel, onConfirm }: { dark: boolean; onCancel: () => void; onConfirm: () => void }) {
  const t = tok(dark);
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }} style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 360, background: t.surface, borderRadius: 16, padding: 24, boxShadow: "0 8px 32px rgba(0,0,0,0.2)", fontFamily: "'Noto Sans KR','DM Sans',sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: "#16A34A" }}>KYC 승인</span>
          <ModalCloseBtn onClick={onCancel} t={t} />
        </div>
        <div style={{ background: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.15)", borderRadius: 10, padding: "14px 16px", marginBottom: 16, textAlign: "center" }}>
          <div style={{ fontSize: 12, color: t.text, lineHeight: 1.8 }}>
            해당 회원의 KYC 인증을 승인 처리하시겠습니까?<br />
            승인 즉시 회원의 KYC 상태가 <span style={{ color: "#16A34A", fontWeight: 600 }}>APPROVED</span>로 변경되며,<br />
            서비스 이용 제한이 해제됩니다.
          </div>
        </div>
        <div style={{ background: t.surface2, borderRadius: 8, padding: "12px 14px", marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: t.textHint, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>승인 대상 서류</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 9999, background: t.accentBg, color: t.accent }}>업로드된 신분증</span>
            <span style={{ fontSize: 11, color: t.textSec }}>John Doe</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button onClick={onCancel} style={{ height: 36, padding: "0 20px", borderRadius: 8, border: `1px solid ${t.border2}`, background: "transparent", color: t.textSec, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>취소</button>
          <button onClick={onConfirm} style={{ height: 36, padding: "0 20px", borderRadius: 8, border: "none", background: "#16A34A", color: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>승인 확인</button>
        </div>
      </div>
    </div>
  );
}

// KYC Reject modal

export function KycRejectModal({ dark, onCancel, onConfirm }: { dark: boolean; onCancel: () => void; onConfirm: () => void }) {
  const t = tok(dark);
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }} style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 380, background: t.surface, borderRadius: 16, padding: 24, boxShadow: "0 8px 32px rgba(0,0,0,0.2)", fontFamily: "'Noto Sans KR','DM Sans',sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: "#DC2626" }}>KYC 반려</span>
          <ModalCloseBtn onClick={onCancel} t={t} />
        </div>
        <div style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(248,113,113,0.15)", borderRadius: 10, padding: "14px 16px", marginBottom: 16, textAlign: "center" }}>
          <div style={{ fontSize: 12, color: t.text, lineHeight: 1.8 }}>
            해당 회원의 KYC 인증을 반려 처리하시겠습니까?<br />
            반려 시 회원의 KYC 상태가 <span style={{ color: "#DC2626", fontWeight: 600 }}>Rejected</span>로 변경되며,<br />
            회원에게 반려 사유가 전달됩니다.
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: t.textSec, marginBottom: 6, display: "flex", gap: 3 }}>반려 사유 <span style={{ color: "#DC2626" }}>*</span></div>
          <div style={{ position: "relative" }}>
            <select value={reason} onChange={(e) => setReason(e.target.value)} style={{ width: "100%", height: 38, background: t.surface2, border: `1px solid ${t.border2}`, borderRadius: 8, fontSize: 13, padding: "0 32px 0 12px", color: reason ? t.text : t.textHint, outline: "none", appearance: "none", WebkitAppearance: "none", fontFamily: "'Noto Sans KR',sans-serif", boxSizing: "border-box" as const, cursor: "pointer" }}>
              <option value="" disabled>사유를 선택하세요</option>
              <option value="unclear">신분증 이미지가 불명확합니다</option>
              <option value="expired">신분증 유효기간이 만료되었습니다</option>
              <option value="mismatch">이름이 일치하지 않습니다</option>
              <option value="unsupported">지원하지 않는 신분증 종류입니다</option>
              <option value="custom">직접 입력</option>
            </select>
            <ChevronDown size={12} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: t.textHint, pointerEvents: "none" }} />
          </div>
          <textarea value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="추가 사유를 입력하세요 (선택)" style={{ marginTop: 8, width: "100%", height: 72, background: t.surface2, border: `1px solid ${t.border2}`, borderRadius: 8, fontSize: 12, padding: "10px 12px", color: t.text, outline: "none", resize: "vertical", boxSizing: "border-box" as const, fontFamily: "'Noto Sans KR',sans-serif" }} />
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button onClick={onCancel} style={{ height: 36, padding: "0 20px", borderRadius: 8, border: `1px solid ${t.border2}`, background: "transparent", color: t.textSec, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>취소</button>
          <button onClick={onConfirm} style={{ height: 36, padding: "0 20px", borderRadius: 8, border: "none", background: "#DC2626", color: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>반려 확인</button>
        </div>
      </div>
    </div>
  );
}
