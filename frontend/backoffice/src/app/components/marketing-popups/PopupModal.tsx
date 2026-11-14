import React, { useRef, useState } from "react";
import type {
  DisplayLocation,
  MarketingPopupTheme,
  MarketingPopupToastType,
  PopupBanner,
  PopupBannerSubmit,
  PopupStatus,
} from "../../types/marketingPopup";

interface ModalProps {
  dark: boolean;
  editing: PopupBanner | null;
  onSave: (data: PopupBannerSubmit) => void | Promise<void>;
  onClose: () => void;
  onToast: (msg: string, type?: MarketingPopupToastType) => void;
  t: MarketingPopupTheme;
}

export function PopupModal({ dark, editing, onSave, onClose, onToast, t }: ModalProps) {
  const [title, setTitle]           = useState(editing?.title ?? "");
  const [imageUrl, setImageUrl]     = useState(editing?.imageUrl ?? "");
  const [imagePreview, setImagePreview] = useState(editing?.imageUrl ?? "");
  const [imageFile, setImageFile]   = useState<File | null>(null);
  const [landingUrl, setLandingUrl] = useState(editing?.landingUrl ?? "");
  const [locations, setLocations]   = useState<DisplayLocation[]>(editing?.locations ?? []);
  const [status, setStatus]         = useState<PopupStatus>(editing?.status ?? "active");
  const [errors, setErrors]         = useState<Record<string, string>>({});
  const [dragOver, setDragOver]     = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const inputStyle: React.CSSProperties = {
    width: "100%", height: 38, padding: "0 12px", borderRadius: 8, boxSizing: "border-box",
    border: `1px solid ${t.border2}`, background: t.surface2,
    color: t.text, fontSize: 13, outline: "none",
    fontFamily: "'DM Sans','Noto Sans KR',sans-serif",
  };
  const errStyle: React.CSSProperties = { fontSize: 11, color: "#DC2626", marginTop: 4 };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: t.textSec, marginBottom: 6, display: "block" };

  const processFile = (file: File) => {
    if (editing) return;

    if (file.type !== "image/jpeg" && file.type !== "image/png") {
      onToast("JPG, PNG 이미지 파일만 업로드할 수 있습니다.", "warning");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onToast("이미지 파일은 5MB 이하만 업로드할 수 있습니다.", "warning");
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      const src = e.target?.result as string;
      const img = new window.Image();
      img.onload = () => {
        const ratio = img.width / img.height;
        if (ratio < 0.7 || ratio > 0.9) {
          onToast("권장 비율(4:5)과 다릅니다. 이미지가 크롭될 수 있습니다.", "warning");
        }
        setImagePreview(src);
        setImageUrl(src);
        setImageFile(file);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  const toggleLocation = (loc: DisplayLocation) => {
    setLocations(prev =>
      prev.includes(loc) ? prev.filter(l => l !== loc) : [...prev, loc]
    );
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "제목을 입력해주세요.";
    else if (title.trim().length > 100) e.title = "제목은 100자 이하로 입력해주세요.";
    if (!editing && !imageFile) e.image = "이미지를 업로드해주세요.";
    if (!landingUrl.trim()) e.landingUrl = "랜딩 URL을 입력해주세요.";
    else {
      try {
        const url = new URL(landingUrl.trim());
        if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
      } catch {
        e.landingUrl = "올바른 http 또는 https URL을 입력해주세요.";
      }
    }
    if (locations.length === 0) e.locations = "최소 하나 이상의 노출 위치를 선택해주세요.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    void onSave({
      title: title.trim(),
      imageUrl,
      imageFile,
      landingUrl: landingUrl.trim(),
      locations,
      status,
    });
  };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24 }}
    >
      <div style={{ width: 560, maxHeight: "90vh", background: dark ? "#1A2035" : "#ffffff", borderRadius: 16, overflow: "hidden", boxShadow: "0 32px 64px rgba(0,0,0,0.35)", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ padding: "20px 28px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{editing ? "팝업 배너 수정" : "팝업 배너 등록"}</span>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: t.textSec, fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", flex: 1, padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* 1. Title */}
          <div>
            <label style={labelStyle}>제목 <span style={{ color: "#DC2626" }}>*</span></label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="예: 7월 여름 챌린지 프로모션"
              style={{ ...inputStyle, borderColor: errors.title ? "#DC2626" : t.border2 }}
            />
            {errors.title && <div style={errStyle}>{errors.title}</div>}
          </div>

          {/* 2. Image upload */}
          <div>
            <label style={labelStyle}>이미지 업로드 <span style={{ color: "#DC2626" }}>*</span></label>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              {/* Drop zone */}
              <div
                onDragOver={e => {
                  e.preventDefault();
                  if (!editing) setDragOver(true);
                }}
                onDragLeave={() => { if (!editing) setDragOver(false); }}
                onDrop={e => {
                  e.preventDefault();
                  if (editing) return;
                  setDragOver(false);
                  const f = e.dataTransfer.files[0];
                  if (f) processFile(f);
                }}
                onClick={() => { if (!editing) fileRef.current?.click(); }}
                style={{
                  width: 120, height: 150, borderRadius: 10, border: `2px dashed ${dragOver ? t.accent : errors.image ? "#DC2626" : t.border2}`,
                  background: dragOver ? t.accentBg : t.surface2,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  cursor: editing ? "not-allowed" : "pointer", flexShrink: 0, overflow: "hidden", transition: "all 0.15s",
                  opacity: editing ? 0.7 : 1,
                  position: "relative",
                }}
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <>
                    <span style={{ fontSize: 24, marginBottom: 6 }}>🖼</span>
                    <span style={{ fontSize: 11, color: t.textHint, textAlign: "center", padding: "0 8px" }}>클릭하거나<br/>드래그하세요</span>
                  </>
                )}
                {/* 4:5 ratio guide overlay */}
                {imagePreview && (
                  <div style={{ position: "absolute", inset: 0, border: "2px solid rgba(124,106,247,0.5)", borderRadius: 10, pointerEvents: "none" }}>
                    <div style={{ position: "absolute", top: 4, right: 6, fontSize: 9, color: "rgba(124,106,247,0.9)", fontWeight: 700, background: "rgba(0,0,0,0.4)", padding: "2px 5px", borderRadius: 4 }}>4:5</div>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" disabled={Boolean(editing)} style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ""; }} />

              <div style={{ flex: 1, fontSize: 12, color: t.textHint, lineHeight: 1.7 }}>
                {editing ? (
                  <>
                    <div style={{ fontWeight: 600, color: t.textSec, marginBottom: 4 }}>이미지 변경 불가</div>
                    <div>등록된 이미지는 수정할 수 없습니다.</div>
                    <div>이미지를 변경하려면 팝업을 삭제한 후 다시 등록해 주세요.</div>
                  </>
                ) : (
                  <>
                <div style={{ fontWeight: 600, color: t.textSec, marginBottom: 4 }}>권장 사양</div>
                <div>비율: <strong style={{ color: t.text }}>4:5</strong> (예: 800×1000px)</div>
                <div>형식: JPG, PNG</div>
                <div>최대 크기: 5MB</div>
                <div style={{ marginTop: 8, color: "#EAB308" }}>⚠ 비율이 맞지 않으면 크롭 경고가 표시됩니다.</div>
                  </>
                )}
              </div>
            </div>
            {errors.image && <div style={errStyle}>{errors.image}</div>}
          </div>

          {/* 2. Landing URL */}
          <div>
            <label style={labelStyle}>랜딩 URL <span style={{ color: "#DC2626" }}>*</span></label>
            <input
              type="url"
              value={landingUrl}
              onChange={e => setLandingUrl(e.target.value)}
              placeholder="예: https://altosfunding.com/promo/event01"
              style={{ ...inputStyle, borderColor: errors.landingUrl ? "#DC2626" : t.border2 }}
            />
            {errors.landingUrl && <div style={errStyle}>{errors.landingUrl}</div>}
          </div>

          {/* 4. Display location */}
          <div>
            <label style={labelStyle}>노출 위치 <span style={{ color: "#DC2626" }}>*</span></label>
            <div style={{ display: "flex", gap: 10 }}>
              {([["before_login", "🔓 로그인 전 (홈)"], ["after_login", "🔐 로그인 후 (대시보드)"]] as [DisplayLocation, string][]).map(([loc, label]) => {
                const checked = locations.includes(loc);
                return (
                  <label
                    key={loc}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 8, cursor: "pointer",
                      border: `1px solid ${checked ? t.accent : t.border2}`,
                      background: checked ? t.accentBg : t.surface2,
                      flex: 1, transition: "all 0.12s",
                    }}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggleLocation(loc)} style={{ accentColor: t.accent, width: 14, height: 14, cursor: "pointer" }} />
                    <span style={{ fontSize: 13, color: checked ? t.accent : t.text, fontWeight: checked ? 600 : 400 }}>{label}</span>
                  </label>
                );
              })}
            </div>
            {errors.locations && <div style={errStyle}>{errors.locations}</div>}
          </div>

          {/* 5. Status toggle */}
          <div>
            <label style={labelStyle}>상태</label>
            <div style={{ display: "flex", gap: 0, borderRadius: 8, overflow: "hidden", border: `1px solid ${t.border2}`, alignSelf: "flex-start", width: "fit-content" }}>
              {([["active", "게시중"] as const, ["inactive", "종료"] as const]).map(([val, label], i) => (
                <button
                  key={val}
                  onClick={() => setStatus(val)}
                  style={{
                    height: 36, padding: "0 20px", cursor: "pointer", fontSize: 13, fontWeight: 500, border: "none",
                    borderLeft: i > 0 ? `1px solid ${t.border2}` : "none",
                    background: status === val ? (val === "active" ? "rgba(34,197,94,0.12)" : t.surface3) : t.surface2,
                    color: status === val ? (val === "active" ? "#16A34A" : t.text) : t.textSec,
                    fontFamily: "'DM Sans','Noto Sans KR',sans-serif", transition: "all 0.12s",
                  }}
                >{label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 28px 24px", borderTop: `1px solid ${t.border}`, display: "flex", gap: 10, justifyContent: "flex-end", flexShrink: 0 }}>
          <button onClick={onClose} style={{ height: 38, padding: "0 20px", borderRadius: 8, border: `1px solid ${t.border2}`, background: "transparent", color: t.text, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans','Noto Sans KR',sans-serif" }}>취소</button>
          <button onClick={handleSave} style={{ height: 38, padding: "0 24px", borderRadius: 8, border: "none", background: t.accent, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans','Noto Sans KR',sans-serif" }}>저장</button>
        </div>
      </div>
    </div>
  );
}
