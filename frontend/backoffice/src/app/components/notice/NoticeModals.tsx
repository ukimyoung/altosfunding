import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { NoticeContentEditor, NoticeContentEditorHandle } from './NoticeContentEditor';
import type { Notice, NoticeCategory, NoticeStatus } from '../../pages/notice/NoticeListPage';
import { DEFAULT_LANGUAGES, SupportedLanguage } from '../../types/language';

export interface NoticeSaveDraft {
  title: string;
  categoryId: string;
  status: Exclude<NoticeStatus, null>;
  pinned: boolean;
  content: string;
  locales: Record<string, { title: string; content: string }>;
}

export interface NoticeCategoryOption {
  id: string;
  order: number;
  names: Record<string, string>;
  announcementCount?: number;
}

interface NoticeModalProps {
  dark: boolean;
  mode: 'add' | 'edit';
  initialData?: Notice;
  categories?: NoticeCategoryOption[];
  onClose: () => void;
  onSave: (data: NoticeSaveDraft) => Promise<void> | void;
  isSaving?: boolean;
  supportedLanguages?: SupportedLanguage[];
}

const DEFAULT_NOTICE_CATEGORIES: NoticeCategoryOption[] = [
  { id: '1', order: 1, names: { en: 'Rules' } },
  { id: '2', order: 2, names: { en: 'Maintenance' } },
  { id: '3', order: 3, names: { en: 'Policy' } },
  { id: '4', order: 4, names: { en: 'Update' } },
];
const NOTICE_STATUSES: { value: Exclude<NoticeStatus, null>; label: string }[] = [
  { value: 'PUBLISHED', label: '게시중' },
  { value: 'CLOSED', label: '종료' },
];

const hasTextContent = (value: string) => value.replace(/[\u00a0\u200b\ufeff]/g, '').trim().length > 0;

const getNoticeLocaleValues = (initialData?: Notice) => {
  const locales = initialData?.locales ?? {
    en: {
      title: initialData?.title ?? '',
      content: initialData?.content ?? '',
    },
  };

  return {
    titles: Object.fromEntries(
      Object.entries(locales).map(([code, locale]) => [code, locale.title]),
    ),
  };
};

function modalTokens(dark: boolean) {
  return {
    surface: dark ? '#1A2035' : '#ffffff',
    surface2: dark ? '#232C44' : '#F4F5F7',
    border: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)',
    border2: dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)',
    text: dark ? '#E8EAF0' : '#1A1A1A',
    textSec: dark ? '#8B8FA8' : '#4A4A58',
    textHint: dark ? '#5A6080' : '#A0A0AA',
    accent: '#7C6AF7',
    accentBg: dark ? 'rgba(124,106,247,0.14)' : 'rgba(124,106,247,0.09)',
    overlay: 'rgba(0,0,0,0.55)',
    error: '#DC2626',
    success: '#16A34A',
    successBg: dark ? 'rgba(22,163,74,0.14)' : 'rgba(22,163,74,0.09)',
  };
}

export function NoticeModal({
  dark,
  mode,
  initialData,
  categories = DEFAULT_NOTICE_CATEGORIES,
  onClose,
  onSave,
  isSaving = false,
  supportedLanguages = DEFAULT_LANGUAGES,
}: NoticeModalProps) {
  const t = modalTokens(dark);
  const [selectedLang, setSelectedLang] = useState('en');
  const [titles, setTitles] = useState<Record<string, string>>(() =>
    getNoticeLocaleValues(initialData).titles,
  );
  const [category, setCategory] = useState<NoticeCategory>(
    (initialData?.categoryId as NoticeCategory | undefined) ?? categories[0]?.id ?? '1',
  );
  const [status, setStatus] = useState<Exclude<NoticeStatus, null>>(
    initialData?.status ?? 'PUBLISHED',
  );
  const [pinned, setPinned] = useState(initialData?.pinned ?? false);
  const [htmlPreview, setHtmlPreview] = useState<{ html: string; langLabel: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const editorRefs = useRef<Record<string, NoticeContentEditorHandle | null>>({});
  const editorKey = initialData?.id ?? 'add';
  const selectedLanguage = supportedLanguages.find((language) => language.code === selectedLang);
  const isEnglishSelected = selectedLang === 'en';

  const getInitialContent = (code: string) => {
    if (initialData?.locales[code]) return initialData.locales[code].content;
    if (code === 'en') return initialData?.content ?? '';
    return '';
  };

  useEffect(() => {
    setTitles(getNoticeLocaleValues(initialData).titles);
    setCategory((initialData?.categoryId as NoticeCategory | undefined) ?? categories[0]?.id ?? '1');
    setStatus(initialData?.status ?? 'PUBLISHED');
    setPinned(initialData?.pinned ?? false);
    setSelectedLang('en');
    setErrors({});
    setHtmlPreview(null);
  }, [categories, initialData]);

  const openHtmlPreview = () => {
    const html = editorRefs.current[selectedLang]?.getHTML() ?? '';
    const langLabel = selectedLanguage
      ? `${selectedLanguage.flag} ${selectedLanguage.label}`
      : selectedLang.toUpperCase();
    setHtmlPreview({ html, langLabel });
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!titles.en?.trim()) nextErrors.title = '영문 제목을 입력해주세요.';
    if (!hasTextContent(editorRefs.current.en?.getPlainText() ?? '')) {
      nextErrors.content = '영문 내용을 입력해주세요.';
    }
    return nextErrors;
  };

  const handleSave = async () => {
    if (isSaving) return;

    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setSelectedLang('en');
      return;
    }

    try {
      const localeCodes = Array.from(
        new Set([
          ...supportedLanguages.map((language) => language.code),
          ...Object.keys(initialData?.locales ?? {}),
        ]),
      );
      const locales = Object.fromEntries(
        localeCodes
          .map((code) => {
            const title = titles[code]?.trim() ?? '';
            const content = editorRefs.current[code]?.getHTML() ?? getInitialContent(code);
            const plainContent =
              editorRefs.current[code]?.getPlainText() ??
              content.replace(/<[^>]*>/g, '');

            return [code, { title, content, plainContent }] as const;
          })
          .filter(([code, locale]) => {
            if (code === 'en') return true;
            return locale.title.length > 0 && hasTextContent(locale.plainContent);
          })
          .map(([code, locale]) => [
            code,
            {
              title: locale.title,
              content: locale.content,
            },
          ]),
      );

      await onSave({
        title: titles.en.trim(),
        categoryId: category,
        status,
        pinned,
        content: editorRefs.current.en?.getHTML() ?? '',
        locales,
      });
      onClose();
    } catch {
      // The parent save handler shows the user-facing failure toast.
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 38,
    padding: '0 12px',
    borderRadius: 8,
    border: `1px solid ${t.border2}`,
    background: t.surface2,
    color: t.text,
    fontSize: 13,
    boxSizing: 'border-box',
    outline: 'none',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    color: t.textSec,
    marginBottom: 6,
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: t.overlay,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 24,
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 880,
          maxHeight: '92vh',
          background: t.surface,
          borderRadius: 14,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
        }}
      >
        <div
          style={{
            padding: '18px 24px',
            borderBottom: `1px solid ${t.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 700, color: t.text }}>
            {mode === 'add' ? '공지 등록' : '공지 수정'}
          </span>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: `1px solid ${t.border}`,
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isSaving ? 'not-allowed' : 'pointer',
            }}
          >
            <X size={14} style={{ color: t.textSec }} />
          </button>
        </div>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          <div style={{ width: 210, flexShrink: 0, borderRight: `1px solid ${t.border}`, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px 14px 6px', fontSize: 10, fontWeight: 700, color: t.textHint, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              언어 선택
            </div>
            {supportedLanguages.map((language) => {
              const isActive = language.code === selectedLang;
              const titleFilled = (titles[language.code] ?? '').trim().length > 0;
              let badgeLabel = '미입력';
              let badgeBg = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
              let badgeColor = t.textHint;

              if (language.required) {
                badgeLabel = '필수';
                badgeBg = t.accentBg;
                badgeColor = t.accent;
              } else if (titleFilled) {
                badgeLabel = '입력됨';
                badgeBg = t.successBg;
                badgeColor = t.success;
              }

              return (
                <button
                  key={language.code}
                  type="button"
                  onClick={() => setSelectedLang(language.code)}
                  disabled={isSaving}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '11px 14px',
                    background: isActive ? (dark ? 'rgba(124,106,247,0.13)' : 'rgba(124,106,247,0.08)') : 'transparent',
                    borderTop: 'none',
                    borderRight: 'none',
                    borderBottom: 'none',
                    borderLeft: `3px solid ${isActive ? t.accent : 'transparent'}`,
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'background 0.1s',
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{language.flag}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? t.text : t.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {language.label}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 99, background: badgeBg, color: badgeColor, flexShrink: 0, whiteSpace: 'nowrap' }}>
                    {badgeLabel}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              minWidth: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20, lineHeight: 1 }}>{selectedLanguage?.flag}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                  {selectedLanguage?.label}
                </span>
                {isEnglishSelected && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: 99,
                      background: t.accentBg,
                      color: t.accent,
                    }}
                  >
                    필수
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={openHtmlPreview}
                disabled={isSaving}
                style={{
                  height: 28,
                  padding: '0 10px',
                  borderRadius: 6,
                  border: `1px solid ${t.border2}`,
                  background: t.surface2,
                  color: t.textSec,
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  fontFamily: "'DM Mono',monospace",
                  whiteSpace: 'nowrap',
                }}
              >
                &lt;/&gt; HTML 미리보기
              </button>
            </div>

            {!isEnglishSelected && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                  border: `1px solid ${t.border}`,
                  fontSize: 12,
                  color: t.textHint,
                  lineHeight: 1.6,
                }}
              >
                미입력 시 유저 화면에서 이 언어 선택 시에도 영문이 노출됩니다.
              </div>
            )}

            <div>
              <label style={labelStyle}>
                제목{isEnglishSelected && <span style={{ color: t.error }}> *</span>}
              </label>
              <input
                type="text"
                value={titles[selectedLang] ?? ''}
                onChange={(event) => {
                  setTitles((prev) => ({ ...prev, [selectedLang]: event.target.value }));
                  setErrors((prev) => ({ ...prev, title: '' }));
                }}
                placeholder={
                  isEnglishSelected
                    ? '예: Important: Challenge Rule Changes Effective June 1st'
                    : '선택 사항 — 미입력 시 영문 제목이 표시됩니다'
                }
                disabled={isSaving}
                style={{
                  ...inputStyle,
                  border: `1px solid ${isEnglishSelected && errors.title ? t.error : t.border2}`,
                }}
              />
              {isEnglishSelected && errors.title && (
                <div style={{ fontSize: 11, color: t.error, marginTop: 4 }}>{errors.title}</div>
              )}
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>
                내용{isEnglishSelected && <span style={{ color: t.error }}> *</span>}
              </label>
              {supportedLanguages.map((language) => (
                <div key={language.code} style={language.code === selectedLang ? { flex: 1 } : { display: 'none' }}>
                  <NoticeContentEditor
                    key={`${editorKey}-${language.code}`}
                    ref={(element) => {
                      editorRefs.current[language.code] = element;
                    }}
                    initialValue={getInitialContent(language.code)}
                    dark={dark}
                  />
                </div>
              ))}
              {isEnglishSelected && errors.content && (
                <div style={{ fontSize: 11, color: t.error, marginTop: 4 }}>{errors.content}</div>
              )}
            </div>
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${t.border}`, padding: '0 24px', height: 48, display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: t.textSec, whiteSpace: 'nowrap' }}>카테고리</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as NoticeCategory)}
              disabled={isSaving}
              style={{ height: 28, padding: '0 8px', borderRadius: 6, border: `1px solid ${t.border2}`, background: t.surface2, color: t.text, fontSize: 12, cursor: isSaving ? 'not-allowed' : 'pointer', outline: 'none' }}
            >
              {categories.map((item) => (
                <option key={item.id} value={item.id}>{item.names.en?.trim() || item.id}</option>
              ))}
            </select>
          </div>
          <div style={{ width: 1, height: 18, background: t.border2, flexShrink: 0 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: t.textSec, whiteSpace: 'nowrap' }}>상태</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as Exclude<NoticeStatus, null>)}
              disabled={isSaving}
              style={{ height: 28, padding: '0 8px', borderRadius: 6, border: `1px solid ${t.border2}`, background: t.surface2, color: t.text, fontSize: 12, cursor: isSaving ? 'not-allowed' : 'pointer', outline: 'none' }}
            >
              {NOTICE_STATUSES.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>
          <div style={{ width: 1, height: 18, background: t.border2, flexShrink: 0 }} />
          <label
            title={
              mode === 'add'
                ? '고정 공지는 유저 화면 상단에 핀으로 표시됩니다. 등록일은 저장 시 현재 시각(GMT+9)으로 자동 기록됩니다.'
                : '고정 공지는 유저 화면 상단에 핀으로 표시됩니다. 수정 시 원래 등록일은 변경되지 않습니다.'
            }
            style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: isSaving ? 'not-allowed' : 'pointer' }}
          >
            <div
              onClick={() => {
                if (!isSaving) setPinned((prev) => !prev);
              }}
              style={{
                width: 32,
                height: 18,
                borderRadius: 99,
                flexShrink: 0,
                position: 'relative',
                background: pinned ? t.accent : dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.15)',
                transition: 'background 120ms ease',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 2,
                  left: pinned ? 16 : 2,
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                  transition: 'left 120ms ease',
                }}
              />
            </div>
            <span style={{ fontSize: 12, fontWeight: pinned ? 600 : 400, color: pinned ? t.text : t.textSec, whiteSpace: 'nowrap' }}>
              📌 고정 공지
            </span>
          </label>
        </div>

        <div
          style={{
            padding: '12px 24px',
            borderTop: `1px solid ${t.border}`,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            style={{
              height: 36,
              padding: '0 18px',
              borderRadius: 8,
              border: `1px solid ${t.border2}`,
              background: 'transparent',
              color: t.text,
              fontSize: 13,
              fontWeight: 500,
              cursor: isSaving ? 'not-allowed' : 'pointer',
            }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            style={{
              height: 36,
              padding: '0 22px',
              borderRadius: 8,
              border: 'none',
              background: t.accent,
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.72 : 1,
            }}
          >
            {isSaving ? '저장 중' : '저장'}
          </button>
        </div>
      </div>

      {htmlPreview && (
        <div
          onClick={() => setHtmlPreview(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: 24,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 640,
              maxHeight: '80vh',
              background: t.surface,
              borderRadius: 14,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
            }}
          >
            <div
              style={{
                padding: '16px 24px',
                borderBottom: `1px solid ${t.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: t.text, fontFamily: "'DM Mono',monospace" }}>
                &lt;/&gt; HTML 소스 — {htmlPreview.langLabel}
              </span>
              <button
                type="button"
                onClick={() => setHtmlPreview(null)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  border: `1px solid ${t.border}`,
                  background: 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={14} style={{ color: t.textSec }} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
              <textarea
                readOnly
                value={htmlPreview.html}
                style={{
                  width: '100%',
                  minHeight: 320,
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: `1px solid ${t.border2}`,
                  background: dark ? '#1A2035' : '#F8F9FA',
                  color: dark ? '#C8D3F5' : '#1A1A1A',
                  fontSize: 12,
                  fontFamily: "'DM Mono','Fira Mono',monospace",
                  lineHeight: 1.7,
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div
              style={{
                padding: '14px 24px',
                borderTop: `1px solid ${t.border}`,
                display: 'flex',
                justifyContent: 'flex-end',
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={() => setHtmlPreview(null)}
                style={{
                  height: 36,
                  padding: '0 22px',
                  borderRadius: 8,
                  border: 'none',
                  background: t.accent,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export function DeleteNoticeModal({
  dark,
  title,
  onConfirm,
  onClose,
  isDeleting = false,
}: {
  dark: boolean;
  title: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
  isDeleting?: boolean;
}) {
  const t = modalTokens(dark);

  return (
    <div
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: t.overlay,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: 24,
      }}
    >
      <div
        style={{
          width: 360,
          background: t.surface,
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
        }}
      >
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: `1px solid ${t.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>공지 삭제</span>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: `1px solid ${t.border}`,
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={14} style={{ color: t.textSec }} />
          </button>
        </div>
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: t.text, marginBottom: 8 }}>
            <span style={{ fontWeight: 700 }}>"{title}"</span> 공지를 삭제하시겠습니까?
          </div>
          <div style={{ fontSize: 11, color: t.textHint }}>삭제 후 복구할 수 없습니다.</div>
        </div>
        <div
          style={{ padding: '12px 24px 20px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              height: 36,
              padding: '0 18px',
              borderRadius: 8,
              border: `1px solid ${t.border2}`,
              background: 'transparent',
              color: t.text,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            style={{
              height: 36,
              padding: '0 18px',
              borderRadius: 8,
              border: 'none',
              background: '#DC2626',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              opacity: isDeleting ? 0.72 : 1,
            }}
          >
            {isDeleting ? '삭제 중...' : '삭제'}
          </button>
        </div>
      </div>
    </div>
  );
}
