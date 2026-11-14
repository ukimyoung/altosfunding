import { Check, X } from "lucide-react";
import type { Tok } from "../../theme/tokens";

export function KycContent({ tab, t, onApprove, onReject, onResend }: {
  tab: "verified" | "pending" | "failed"; t: Tok;
  onApprove: () => void; onReject: () => void; onResend: () => void;
}) {
  const img = (label: string, opacity = 1, borderColor?: string) => (
    <div style={{ height: 100, background: t.surface2, border: `1px dashed ${borderColor ?? t.border2}`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", opacity }}>
      <span style={{ fontSize: 11, color: t.textHint, fontFamily: "'Noto Sans KR',sans-serif" }}>{label}</span>
    </div>
  );
  const kBtn = (label: string, bg: string, color: string, onClick: () => void, border?: string) => (
    <button onClick={onClick} style={{ height: 30, padding: "0 12px", borderRadius: 7, border: border ? `1px solid ${border}` : "none", background: bg, color, fontSize: 11, fontWeight: 500, fontFamily: "'Noto Sans KR',sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}>{label}</button>
  );

  if (tab === "verified") return (
    <>
      <div style={{ background: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.15)", borderRadius: 8, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Check size={14} strokeWidth={2.5} style={{ color: "#16A34A", flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 500, color: "#16A34A", fontFamily: "'Noto Sans KR',sans-serif", flex: 1 }}>KYC 인증이 완료된 회원입니다</span>
        <span style={{ fontSize: 10, color: t.textHint, whiteSpace: "nowrap" }}>승인일: 2026-03-15</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 10, color: t.accent, fontWeight: 500 }}>업로드된 신분증</span>
        {["Driver's License", "Passport", "ID Card"].map((d) => <span key={d} style={{ fontSize: 10, color: t.textHint }}>{d}</span>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {img("신분증 앞면")}{img("신분증 뒷면")}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 10 }}>
        {kBtn("KYC 반려", "rgba(220,38,38,0.08)", "#DC2626", onReject)}
      </div>
    </>
  );

  if (tab === "pending") return (
    <>
      <div style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.18)", borderRadius: 8, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ width: 14, height: 14, borderRadius: "50%", border: "1.5px dashed #D97706", flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 500, color: "#D97706", fontFamily: "'Noto Sans KR',sans-serif", flex: 1 }}>KYC 인증 검토 대기 중입니다</span>
        <span style={{ fontSize: 10, color: t.textHint, whiteSpace: "nowrap" }}>제출일: 2026-04-10</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 10, color: t.accent, fontWeight: 500 }}>업로드된 신분증</span>
        <span style={{ fontSize: 10, color: t.textHint }}>Passport</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {img("신분증 앞면")}{img("신분증 뒷면")}
      </div>
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 10 }}>
        {kBtn("KYC 승인", "rgba(22,163,74,0.12)", "#16A34A", onApprove)}
        {kBtn("KYC 반려", "rgba(220,38,38,0.08)", "#DC2626", onReject)}
      </div>
    </>
  );

  return (
    <>
      <div style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 8, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <X size={14} strokeWidth={2.5} style={{ color: "#DC2626", flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 500, color: "#DC2626", fontFamily: "'Noto Sans KR',sans-serif", flex: 1 }}>KYC 인증이 반려되었습니다</span>
        <span style={{ fontSize: 10, color: t.textHint, whiteSpace: "nowrap" }}>반려일: 2026-04-12</span>
      </div>
      <div style={{ background: t.surface2, border: "1px solid rgba(248,113,113,0.15)", borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
        <div style={{ padding: "8px 14px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: "#DC2626", letterSpacing: "0.06em", textTransform: "uppercase" }}>반려 사유</span>
          <span style={{ fontSize: 10, color: t.textHint }}>처리자: Admin (김운영)</span>
        </div>
        <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 9999, background: "rgba(220,38,38,0.08)", color: "#DC2626", whiteSpace: "nowrap", flexShrink: 0 }}>주요 사유</span>
            <span style={{ fontSize: 12, color: t.text, lineHeight: 1.6 }}>신분증 이미지가 불명확합니다</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 9999, background: t.surface3, color: t.textSec, whiteSpace: "nowrap", flexShrink: 0 }}>상세 내용</span>
            <span style={{ fontSize: 12, color: t.textSec, lineHeight: 1.6 }}>사진이 흐리거나 빛 반사로 인해 정보 확인이 어렵습니다. 밝은 환경에서 다시 촬영 후 재업로드 해주세요.</span>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 10, color: t.textSec }}>제출 서류</span>
        <span style={{ fontSize: 10, color: t.textHint }}>Driver's License</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {img("신분증 앞면", 0.5, "rgba(248,113,113,0.3)")}{img("신분증 뒷면", 0.5, "rgba(248,113,113,0.3)")}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
        <span style={{ fontSize: 10, color: t.textHint }}>재신청을 유도하거나 직접 승인 처리할 수 있습니다</span>
        <div style={{ display: "flex", gap: 6 }}>
          {kBtn("재심사 승인", "rgba(22,163,74,0.12)", "#16A34A", onApprove)}
          {kBtn("재신청 안내 발송", "transparent", t.textSec, onResend, t.border2)}
        </div>
      </div>
    </>
  );
}
