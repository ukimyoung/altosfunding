import { useState } from "react";
import { ModalCloseBtn } from "../shared/ModalCloseButton";
import { tok } from "../../theme/tokens";

export function MemberDeactivateModal({
  dark,
  onCancel,
  onConfirm,
}: {
  dark: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const t = tok(dark);
  const [reason, setReason] = useState("");

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }} style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 420, background: t.surface, borderRadius: 16, padding: 28, boxShadow: "0 8px 32px rgba(0,0,0,0.2)", fontFamily: "'Noto Sans KR','DM Sans',sans-serif" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <ModalCloseBtn onClick={onCancel} t={t} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 10 }}>
          회원 INACTIVE (비활성) 처리
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.8, marginBottom: 16, color: t.textSec }}>
          해당 회원 계정을 비활성 처리하시겠습니까?<br /><br />
          <span style={{ color: t.text, fontWeight: 600 }}>처리 후 접속 제한:</span><br />
          • Altos Funding 사이트 — 로그인 불가<br />
          • MT4 — 접속 불가<br /><br />
          계정 데이터는 유지되며 어드민이 언제든 재활성화할 수 있습니다.
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: t.textSec, marginBottom: 6 }}>비활성 사유 (선택)</div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="비활성 사유를 입력하세요 (미입력 가능)"
            rows={2}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: `1px solid ${t.border}`,
              background: t.surface2,
              color: t.text,
              fontSize: 13,
              fontFamily: "'Noto Sans KR', sans-serif",
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button onClick={onCancel} style={{ height: 36, padding: "0 20px", borderRadius: 8, border: `1px solid ${t.border2}`, background: "transparent", color: t.textSec, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>취소</button>
          <button onClick={() => onConfirm(reason.trim())} style={{ height: 36, padding: "0 20px", borderRadius: 8, border: "none", background: "rgba(217,119,6,0.12)", color: "#D97706", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>비활성 처리</button>
        </div>
      </div>
    </div>
  );
}

export function MemberReactivateModal({
  dark,
  onCancel,
  onConfirm,
}: {
  dark: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = tok(dark);

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }} style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 420, background: t.surface, borderRadius: 16, padding: 28, boxShadow: "0 8px 32px rgba(0,0,0,0.2)", fontFamily: "'Noto Sans KR','DM Sans',sans-serif" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>
          </div>
          <ModalCloseBtn onClick={onCancel} t={t} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 10 }}>
          활성 복귀 처리
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.8, marginBottom: 20, color: t.textSec }}>
          해당 회원 계정을 활성 복귀 처리하시겠습니까?<br /><br />
          • 사이트 로그인이 다시 가능해집니다<br />
          • MT4 접속이 복구됩니다
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button onClick={onCancel} style={{ height: 36, padding: "0 20px", borderRadius: 8, border: `1px solid ${t.border2}`, background: "transparent", color: t.textSec, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>취소</button>
          <button onClick={onConfirm} style={{ height: 36, padding: "0 20px", borderRadius: 8, border: "none", background: "#16A34A", color: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>활성 복귀</button>
        </div>
      </div>
    </div>
  );
}

export function MemberBannedModal({
  dark,
  onCancel,
  onConfirm,
}: {
  dark: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const t = tok(dark);
  const [reason, setReason] = useState("");

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }} style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 420, background: t.surface, borderRadius: 16, padding: 28, boxShadow: "0 8px 32px rgba(0,0,0,0.2)", fontFamily: "'Noto Sans KR','DM Sans',sans-serif" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
          <ModalCloseBtn onClick={onCancel} t={t} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 10 }}>
          회원 BANNED (영구정지) 처리
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.8, marginBottom: 16, color: t.textSec }}>
          해당 회원을 영구정지 처리하시겠습니까?<br /><br />
          • Altos Funding 사이트 로그인 영구 차단<br />
          • MT4 접속 영구 차단<br />
          • 보유 계좌 전체 거래 즉시 중단<br />
          • 모든 활성 포지션 강제 종료<br /><br />
          이 작업은 되돌릴 수 없습니다.
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: t.textSec, marginBottom: 6, display: "flex", gap: 4 }}>
            영구정지 사유
            <span style={{ color: "#DC2626" }}>*</span>
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="영구정지 사유를 입력하세요"
            rows={2}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: `1px solid ${t.border}`,
              background: t.surface2,
              color: t.text,
              fontSize: 13,
              fontFamily: "'Noto Sans KR', sans-serif",
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button onClick={onCancel} style={{ height: 36, padding: "0 20px", borderRadius: 8, border: `1px solid ${t.border2}`, background: "transparent", color: t.textSec, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>취소</button>
          <button
            onClick={() => onConfirm(reason.trim())}
            disabled={!reason.trim()}
            style={{
              height: 36,
              padding: "0 20px",
              borderRadius: 8,
              border: "none",
              background: reason.trim() ? "#DC2626" : t.surface2,
              color: reason.trim() ? "#fff" : t.textSec,
              fontSize: 12,
              fontWeight: 500,
              cursor: reason.trim() ? "pointer" : "not-allowed",
            }}
          >
            영구정지
          </button>
        </div>
      </div>
    </div>
  );
}

export function MemberWithdrawModal({
  dark,
  onCancel,
  onConfirm,
}: {
  dark: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = tok(dark);

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }} style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 420, background: t.surface, borderRadius: 16, padding: 28, boxShadow: "0 8px 32px rgba(0,0,0,0.2)", fontFamily: "'Noto Sans KR','DM Sans',sans-serif" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </div>
          <ModalCloseBtn onClick={onCancel} t={t} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 10 }}>
          회원탈퇴 처리
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.8, marginBottom: 20, color: t.textSec }}>
          해당 회원 계정을 탈퇴 처리하시겠습니까?<br /><br />
          ⚠ 이 작업은 되돌릴 수 없습니다.<br />
          • 계정 및 모든 데이터가 삭제됩니다<br />
          • MT4 계좌가 비활성화됩니다<br />
          • 미출금 잔액은 환불 처리가 필요합니다
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button onClick={onCancel} style={{ height: 36, padding: "0 20px", borderRadius: 8, border: `1px solid ${t.border2}`, background: "transparent", color: t.textSec, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>취소</button>
          <button onClick={onConfirm} style={{ height: 36, padding: "0 20px", borderRadius: 8, border: "none", background: "#DC2626", color: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>탈퇴 처리</button>
        </div>
      </div>
    </div>
  );
}

// Account Inactive modal (account drawer)
