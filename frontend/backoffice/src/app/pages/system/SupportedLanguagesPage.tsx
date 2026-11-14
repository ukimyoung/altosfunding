import { useState, useRef } from "react";
import { Search, Plus, Trash2, Star, AlertTriangle, Globe } from "lucide-react";
import { Toast } from "../../components/shared/Toast";
import { useAppShell } from "../../layouts/AppShell";
import { ISO_LANGUAGE_CATALOG, TOTAL_ISO_LANGUAGE_COUNT } from "../../constants/languages";
import { DEFAULT_LANGUAGES, IsoLanguageEntry, SupportedLanguage } from "../../types/language";
import {
  useCreateLanguageMutation,
  useListActiveLanguagesQuery,
  useListLanguagesQuery,
  useUpdateLanguageMutation,
} from "../../queries/languages";
import type { AdminLanguage } from "@/api/languages";

interface SupportedLanguagesPageProps {
  dark: boolean;
  supportedLanguages: SupportedLanguage[];
  onToast: (message: string, type?: "success" | "warning") => void;
  onAddLanguage: (lang: IsoLanguageEntry) => Promise<void>;
  onRemoveLanguage: (lang: SupportedLanguage) => Promise<void>;
  isSaving: boolean;
}

const findCatalogLanguage = (code: string) =>
  ISO_LANGUAGE_CATALOG.find((language) => language.code === code);

const toSupportedLanguage = (language: AdminLanguage): SupportedLanguage => {
  const catalogLanguage = findCatalogLanguage(language.code);

  return {
    code: language.code,
    flag: catalogLanguage?.flag ?? "🌐",
    label: language.name_native,
    englishName: language.name_en,
    required: language.is_default,
  };
};

function SupportedLanguagesContent({
  dark,
  supportedLanguages,
  onToast,
  onAddLanguage,
  onRemoveLanguage,
  isSaving,
}: SupportedLanguagesPageProps) {
  const t = {
    pageBg:        dark ? "#0A0F1E" : "#F0F1F5",
    surface:       dark ? "#0F1829" : "#ffffff",
    surface2:      dark ? "#1A2035" : "#F4F5F7",
    surface3:      dark ? "#141E33" : "#ECEEF2",
    border:        dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.09)",
    border2:       dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.14)",
    text:          dark ? "#E8EAF0" : "#1A1A1A",
    textSec:       dark ? "#8B8FA8" : "#4A4A58",
    textHint:      dark ? "#5A6080" : "#A0A0AA",
    accent:        "#7C6AF7",
    accentMuted:   dark ? "rgba(124,106,247,0.12)" : "rgba(124,106,247,0.08)",
    accentBorder:  dark ? "rgba(124,106,247,0.4)" : "rgba(124,106,247,0.35)",
    error:         "#DC2626",
    errorBg:       dark ? "rgba(220,38,38,0.1)" : "rgba(220,38,38,0.07)",
    errorBorder:   "rgba(220,38,38,0.25)",
    success:       "#16A34A",
    successBg:     dark ? "rgba(22,163,74,0.12)" : "rgba(22,163,74,0.08)",
    warning:       "#D97706",
    warningBg:     dark ? "rgba(217,119,6,0.12)" : "rgba(217,119,6,0.08)",
    warningBorder: "rgba(217,119,6,0.28)",
  };

  const activeCodes = new Set(supportedLanguages.map(l => l.code));

  // Combobox state
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<IsoLanguageEntry | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Inline delete-confirm: stores the code of the lang pending confirmation
  const [confirmCode, setConfirmCode] = useState<string | null>(null);

  // ── Search filtering ──────────────────────────────────────────────────────
  const q = searchQuery.trim().toLowerCase();
  const searchResults: IsoLanguageEntry[] = q.length === 0 ? [] : ISO_LANGUAGE_CATALOG.filter(lang => {
    if (activeCodes.has(lang.code)) return false;
    return (
      lang.englishName.toLowerCase().includes(q) ||
      lang.code.toLowerCase().includes(q) ||
      lang.nativeName.toLowerCase().includes(q) ||
      (lang.koreanName?.toLowerCase().includes(q) ?? false)
    );
  }).slice(0, 9);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSelectCandidate = (lang: IsoLanguageEntry) => {
    setSelectedCandidate(lang);
    setSearchQuery(`${lang.flag} ${lang.englishName}`);
    setDropdownOpen(false);
  };

  const handleAdd = async () => {
    if (!selectedCandidate) return;

    try {
      await onAddLanguage(selectedCandidate);
      onToast(`${selectedCandidate.flag} ${selectedCandidate.englishName}이(가) 추가되었습니다.`, "success");
      setSelectedCandidate(null);
      setSearchQuery("");
    } catch {
      onToast(`${selectedCandidate.flag} ${selectedCandidate.englishName} 추가에 실패했습니다.`, "warning");
    }
  };

  const handleRemoveConfirmed = async (code: string) => {
    const lang = supportedLanguages.find(l => l.code === code);
    if (!lang) return;

    try {
      await onRemoveLanguage(lang);
      onToast(`${lang.flag} ${lang.englishName ?? lang.label}이(가) 삭제되었습니다.`, "warning");
      setConfirmCode(null);
    } catch {
      onToast(`${lang.flag} ${lang.englishName ?? lang.label} 삭제에 실패했습니다.`, "warning");
    }
  };

  // ── Shared micro-styles ───────────────────────────────────────────────────
  const monoStyle: React.CSSProperties = {
    fontFamily: "'DM Mono','Fira Mono',monospace",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.04em",
  };

  return (
    <div style={{ padding: 32, background: t.pageBg, minHeight: "100vh" }}>

      {/* ── Page Header ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ marginBottom: 10 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text, margin: 0 }}>지원 언어 관리</h1>
        </div>
        <p style={{ fontSize: 13, color: t.textSec, margin: 0, lineHeight: 1.75 }}>
          다국어 콘텐츠 입력 화면(공지 등록, FAQ 등록 등)에서 사용할 수 있는 언어 목록을 설정합니다.
          <br />
          여기서 활성화한 언어만 각 콘텐츠 편집 모달의 언어 선택 목록에 나타납니다.
        </p>
      </div>

      {/* ── Impact warning banner ── */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 18px", background: t.warningBg, border: `1px solid ${t.warningBorder}`, borderRadius: 10, marginBottom: 24 }}>
        <AlertTriangle size={16} style={{ color: t.warning, flexShrink: 0, marginTop: 1 }} />
        <span style={{ fontSize: 12, color: t.warning, lineHeight: 1.6 }}>
          언어를 삭제하면 공지사항·FAQ 등 해당 언어로 입력된 탭이 편집 화면에서 숨겨집니다.
          기존 콘텐츠 데이터는 보존되며, 재추가 시 복원됩니다.
        </span>
      </div>

      {/* ── Master Card ── */}
      <div style={{ position: "relative", background: t.surface, borderRadius: 14, border: `2px solid ${t.accentBorder}`, overflow: "visible", boxShadow: dark ? "0 0 0 1px rgba(124,106,247,0.08), 0 8px 32px rgba(0,0,0,0.3)" : "0 0 0 4px rgba(124,106,247,0.06), 0 4px 20px rgba(0,0,0,0.08)" }}>

        {/* MASTER badge — anchored top-left, overlapping the border */}
        <div style={{ position: "absolute", top: -13, left: 20, display: "flex", alignItems: "center", gap: 6, background: t.accent, borderRadius: 99, padding: "3px 10px 3px 8px", boxShadow: "0 2px 8px rgba(124,106,247,0.4)" }}>
          <Star size={11} fill="#fff" style={{ color: "#fff" }} />
          <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", letterSpacing: "0.1em" }}>MASTER</span>
        </div>

        {/* Card top strip: system-impact notice + counts */}
        <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <span style={{ fontSize: 12, color: t.accent, fontWeight: 500 }}>
            이 목록이 전체 시스템의 다국어 입력 화면에 반영됩니다
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: t.textHint }}>
              전체 <strong style={{ color: t.textSec }}>{TOTAL_ISO_LANGUAGE_COUNT}개</strong> 언어(ISO 639-1) 중
            </span>
            <div style={{ width: 1, height: 14, background: t.border2 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 99, background: t.accentMuted, border: `1px solid ${t.accentBorder}` }}>
              <Globe size={12} style={{ color: t.accent }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: t.accent }}>등록된 언어 {supportedLanguages.length}개</span>
            </div>
          </div>
        </div>

        {/* ── Active language list ── */}
        <div style={{ overflowY: "auto", maxHeight: 360 }}>
          {/* List header */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 72px 72px 80px", alignItems: "center", padding: "9px 24px", background: t.surface2, borderBottom: `1px solid ${t.border}`, position: "sticky", top: 0, zIndex: 1 }}>
            {["언어", "코드", "구분", ""].map((h, i) => (
              <span key={i} style={{ fontSize: 10, fontWeight: 700, color: t.textHint, letterSpacing: "0.07em", textTransform: "uppercase" }}>{h}</span>
            ))}
          </div>

          {supportedLanguages.map((lang, i) => {
            const isRequired = !!lang.required;
            const isConfirming = confirmCode === lang.code;
            const displayName = lang.englishName ?? lang.label;

            return (
              <div
                key={lang.code}
                style={{
                  borderBottom: i < supportedLanguages.length - 1 ? `1px solid ${t.border}` : "none",
                  background: isConfirming
                    ? (dark ? "rgba(220,38,38,0.07)" : "rgba(220,38,38,0.04)")
                    : "transparent",
                  transition: "background 0.15s",
                }}
              >
                {isConfirming ? (
                  /* ── Inline confirm row ── */
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 24px" }}>
                    <span style={{ fontSize: 20 }}>{lang.flag}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: t.text, flex: 1 }}>{displayName}</span>
                    <span style={{ fontSize: 12, color: t.error }}>삭제 후 해당 언어 탭이 편집 화면에서 제거됩니다. 계속하시겠습니까?</span>
                    <button
                      onClick={() => handleRemoveConfirmed(lang.code)}
                      disabled={isSaving}
                      style={{ height: 28, padding: "0 12px", borderRadius: 6, border: "none", background: t.error, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
                    >
                      삭제 확인
                    </button>
                    <button
                      onClick={() => setConfirmCode(null)}
                      style={{ height: 28, padding: "0 10px", borderRadius: 6, border: `1px solid ${t.border2}`, background: "transparent", color: t.textSec, fontSize: 12, cursor: "pointer", flexShrink: 0 }}
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  /* ── Normal row ── */
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 72px 72px 80px", alignItems: "center", padding: "12px 24px" }}>
                    {/* Flag + name */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 22, lineHeight: 1 }}>{lang.flag}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{displayName}</div>
                        <div style={{ fontSize: 11, color: t.textHint, marginTop: 1 }}>{lang.label !== displayName ? lang.label : lang.code.toUpperCase()}</div>
                      </div>
                    </div>

                    {/* ISO code */}
                    <span style={{ ...monoStyle, display: "inline-flex", alignItems: "center", padding: "2px 7px", borderRadius: 5, background: t.surface2, color: t.textSec, border: `1px solid ${t.border2}`, width: "fit-content" }}>
                      {lang.code.toUpperCase()}
                    </span>

                    {/* Badge */}
                    {isRequired ? (
                      <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: t.accentMuted, color: t.accent, border: `1px solid ${t.accentBorder}`, width: "fit-content" }}>
                        필수
                      </span>
                    ) : (
                      <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600, background: t.surface2, color: t.textHint, border: `1px solid ${t.border}`, width: "fit-content" }}>
                        선택
                      </span>
                    )}

                    {/* Delete button */}
                    <div>
                      {isRequired ? (
                        <button
                          disabled
                          title="필수 언어는 삭제할 수 없습니다"
                          style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 28, padding: "0 10px", borderRadius: 6, border: `1px solid ${t.border}`, background: "transparent", color: t.textHint, fontSize: 12, cursor: "not-allowed", opacity: 0.45 }}
                        >
                          <Trash2 size={12} />삭제
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirmCode(lang.code)}
                          style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 28, padding: "0 10px", borderRadius: 6, border: `1px solid ${t.errorBorder}`, background: t.errorBg, color: t.error, fontSize: 12, fontWeight: 500, cursor: "pointer" }}
                        >
                          <Trash2 size={12} />삭제
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {supportedLanguages.length === 0 && (
            <div style={{ padding: "32px 0", textAlign: "center", fontSize: 13, color: t.textHint }}>
              활성화된 언어가 없습니다.
            </div>
          )}
        </div>

        {/* ── Add language section ── */}
        <div style={{ padding: "18px 24px", borderTop: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.textSec, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>언어 추가</div>

          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            {/* Combobox */}
            <div style={{ position: "relative", flex: 1 }}>
              <div style={{ position: "relative" }}>
                <Search size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: t.textHint, pointerEvents: "none" }} />
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSelectedCandidate(null);
                    setDropdownOpen(e.target.value.trim().length > 0);
                  }}
                  onFocus={() => { if (q.length > 0) setDropdownOpen(true); }}
                  onBlur={() => { setTimeout(() => setDropdownOpen(false), 150); }}
                  placeholder="언어 검색 (예: 일본어, Japanese, ja...)"
                  style={{ width: "100%", height: 36, padding: "0 12px 0 34px", borderRadius: 8, border: `1px solid ${dropdownOpen ? t.accent : t.border2}`, background: t.surface2, color: t.text, fontSize: 13, boxSizing: "border-box", outline: "none", transition: "border-color 0.15s" }}
                />
              </div>

              {/* Dropdown results */}
              {dropdownOpen && (
                <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: t.surface, border: `1px solid ${t.border2}`, borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.2)", zIndex: 100, overflow: "hidden", maxHeight: 300, overflowY: "auto" }}>
                  {searchResults.length === 0 ? (
                    <div style={{ padding: "14px 16px", fontSize: 13, color: t.textHint, textAlign: "center" }}>
                      일치하는 언어가 없습니다
                    </div>
                  ) : searchResults.map((lang, i) => (
                    <div
                      key={lang.code}
                      onMouseDown={(e) => { e.preventDefault(); handleSelectCandidate(lang); }}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", cursor: "pointer", borderBottom: i < searchResults.length - 1 ? `1px solid ${t.border}` : "none", transition: "background 0.1s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = t.surface2)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <span style={{ fontSize: 20, flexShrink: 0 }}>{lang.flag}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{lang.englishName}</div>
                        <div style={{ fontSize: 11, color: t.textHint }}>{lang.nativeName}{lang.koreanName ? ` · ${lang.koreanName}` : ""}</div>
                      </div>
                      <span style={{ ...monoStyle, padding: "2px 6px", borderRadius: 4, background: t.surface2, color: t.textSec, border: `1px solid ${t.border}`, flexShrink: 0 }}>
                        {lang.code.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add button */}
            <button
              onClick={handleAdd}
              disabled={!selectedCandidate || isSaving}
              style={{ height: 36, padding: "0 18px", borderRadius: 8, border: "none", background: selectedCandidate ? t.accent : (dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"), color: selectedCandidate ? "#fff" : t.textHint, fontSize: 13, fontWeight: 600, cursor: selectedCandidate && !isSaving ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 7, flexShrink: 0, transition: "background 0.18s" }}
            >
              <Plus size={15} />언어 추가
            </button>
          </div>

          {selectedCandidate && (
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", borderRadius: 7, background: t.successBg, border: `1px solid rgba(22,163,74,0.22)` }}>
              <span style={{ fontSize: 16 }}>{selectedCandidate.flag}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: t.success }}>{selectedCandidate.englishName}</span>
              <span style={{ fontSize: 11, color: t.textHint }}>({selectedCandidate.nativeName})</span>
              <span style={{ ...monoStyle, fontSize: 10, padding: "1px 5px", borderRadius: 4, background: t.surface2, color: t.textHint, border: `1px solid ${t.border}` }}>{selectedCandidate.code.toUpperCase()}</span>
              <span style={{ fontSize: 12, color: t.success, marginLeft: "auto" }}>선택됨 — "언어 추가" 버튼을 눌러 등록하세요</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer note */}
      <p style={{ marginTop: 14, fontSize: 11, color: t.textHint, lineHeight: 1.7 }}>
        언어 추가/삭제는 즉시 반영됩니다. 삭제해도 해당 언어로 입력된 기존 콘텐츠 데이터는 보존되며, 재추가 시 복원됩니다.
      </p>
    </div>
  );
}

export function SupportedLanguagesPage() {
  const { dark } = useAppShell();
  const activeLanguagesQuery = useListActiveLanguagesQuery();
  const registeredLanguagesQuery = useListLanguagesQuery();
  const createLanguageMutation = useCreateLanguageMutation();
  const updateLanguageMutation = useUpdateLanguageMutation();
  const [toast, setToast] = useState<{ message: string; type: "success" | "warning" } | null>(
    null,
  );
  const activeLanguageItems = activeLanguagesQuery.data?.items;
  const supportedLanguages =
    activeLanguageItems
      ?.slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((language) => toSupportedLanguage(language)) ??
    DEFAULT_LANGUAGES.map((language) => ({ ...language }));
  const isSaving = createLanguageMutation.isPending || updateLanguageMutation.isPending;

  const handleAddLanguage = async (language: IsoLanguageEntry) => {
    const registered =
      registeredLanguagesQuery.data?.items ??
      (await registeredLanguagesQuery.refetch()).data?.items ??
      [];
    const existing = registered.find((item) => item.code === language.code);

    if (existing) {
      await updateLanguageMutation.mutateAsync({
        code: language.code,
        payload: { is_active: true },
      });
      return;
    }

    await createLanguageMutation.mutateAsync({
      code: language.code,
      name_en: language.englishName,
      name_native: language.nativeName,
      is_active: true,
    });
  };

  const handleRemoveLanguage = async (language: SupportedLanguage) => {
    await updateLanguageMutation.mutateAsync({
      code: language.code,
      payload: { is_active: false },
    });
  };

  return (
    <>
      <SupportedLanguagesContent
        dark={dark}
        supportedLanguages={supportedLanguages}
        onToast={(message, type = "success") => setToast({ message, type })}
        onAddLanguage={handleAddLanguage}
        onRemoveLanguage={handleRemoveLanguage}
        isSaving={isSaving}
      />
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          dark={dark}
          onDone={() => setToast(null)}
        />
      )}
    </>
  );
}
