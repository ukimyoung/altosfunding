import { useEffect, useRef, useState } from 'react';
import { GripVertical, X } from 'lucide-react';
import { tok } from '../../theme/tokens';
import type { SupportedLanguage } from '../../types/language';

// 공지사항 '카테고리 관리' 팝업과 같은 구성 (언어 탭 · 추가 · 이름 수정 · 삭제 · 드래그 순서 변경).

export interface InquiryCategoryOption {
  id: string;
  code: string;
  order: number;
  names: Record<string, string>;
  contactCount: number;
}

type ToastType = 'success' | 'warning';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getApiErrorMessage = (error: unknown, fallback: string) => {
  const data = isRecord(error) && isRecord(error.response) && isRecord(error.response.data)
    ? error.response.data
    : null;
  if (typeof data?.message === 'string') return data.message;
  if (typeof data?.detail === 'string') return data.detail;
  return fallback;
};

export function InquiryCategoryModal({
  dark,
  categories,
  supportedLanguages,
  onClose,
  onAdd,
  onRename,
  onDelete,
  onReorder,
  onDone,
  onToast,
  isSaving,
}: {
  dark: boolean;
  categories: InquiryCategoryOption[];
  supportedLanguages: SupportedLanguage[];
  onClose: () => void;
  onAdd: (category: InquiryCategoryOption) => Promise<InquiryCategoryOption>;
  onRename: (category: InquiryCategoryOption) => Promise<InquiryCategoryOption>;
  onDelete: (categoryId: string) => Promise<void>;
  onReorder: (categories: InquiryCategoryOption[]) => Promise<void>;
  onDone: () => Promise<void>;
  onToast: (message: string, type?: ToastType) => void;
  isSaving: boolean;
}) {
  const t = tok(dark);
  const [cats, setCats] = useState<InquiryCategoryOption[]>([...categories]);
  const [selectedLang, setSelectedLang] = useState('en');
  const [newEnName, setNewEnName] = useState('');
  const dragIdx = useRef<number | null>(null);
  const overIdx = useRef<number | null>(null);
  const isEnglish = selectedLang === 'en';

  const usageCount = (categoryName: string) =>
    cats.find((category) => category.names.en === categoryName)?.contactCount ?? 0;

  useEffect(() => {
    setCats([...categories]);
  }, [categories]);

  const handleAdd = async () => {
    if (isSaving) return;
    const trimmed = newEnName.trim();
    if (!trimmed) {
      onToast("영어 카테고리명을 입력해주세요", "warning");
      return;
    }
    if (cats.some((category) => category.names.en?.toLowerCase() === trimmed.toLowerCase())) {
      onToast("이미 존재하는 카테고리입니다", "warning");
      return;
    }

    let created: InquiryCategoryOption;
    try {
      created = await onAdd({
        id: `inquiry-category-${Date.now()}`,
        code: '',
        order: cats.length + 1,
        names: { en: trimmed },
        contactCount: 0,
      });
    } catch (error) {
      onToast(getApiErrorMessage(error, "카테고리 추가에 실패했습니다"), "warning");
      return;
    }
    setCats((prev) => [
      ...prev,
      created,
    ]);
    setNewEnName('');
    onToast("카테고리가 추가되었습니다", "success");
  };

  const handleDelete = async (category: InquiryCategoryOption) => {
    if (isSaving) return;
    const englishName = category.names.en ?? '';
    const count = usageCount(englishName);
    if (count > 0) {
      onToast(`이 카테고리로 접수된 문의가 ${count}건 있어 삭제할 수 없습니다`, "warning");
      return;
    }
    try {
      await onDelete(category.id);
    } catch (error) {
      onToast(getApiErrorMessage(error, "카테고리 삭제에 실패했습니다"), "warning");
      return;
    }
    setCats((prev) =>
      prev.filter((item) => item.id !== category.id).map((item, index) => ({ ...item, order: index + 1 })),
    );
    onToast("카테고리가 삭제되었습니다", "success");
  };

  const handleRename = async (
    category: InquiryCategoryOption,
    languageCode: string,
    oldName: string,
    newName: string,
  ) => {
    if (isSaving) return;
    const trimmed = newName.trim();
    if (trimmed === oldName.trim()) return;
    if (!trimmed) {
      if (languageCode === 'en') {
        onToast("영어 카테고리명을 입력해주세요", "warning");
      }
      return;
    }
    if (
      languageCode === 'en' &&
      cats.some((item) => item.id !== category.id && item.names.en?.trim().toLowerCase() === trimmed.toLowerCase())
    ) {
      onToast("이미 존재하는 카테고리입니다", "warning");
      return;
    }

    const nextCategory = {
      ...category,
      names: {
        ...category.names,
        [languageCode]: trimmed,
      },
    };

    try {
      const updated = await onRename(nextCategory);
      setCats((prev) => prev.map((item) => (item.id === category.id ? updated : item)));
      onToast("카테고리명이 변경되었습니다", "success");
    } catch (error) {
      onToast(getApiErrorMessage(error, "카테고리명 변경에 실패했습니다"), "warning");
    }
  };

  const handleComplete = async () => {
    if (isSaving) return;
    if (cats.some((category) => !category.names.en?.trim())) {
      onToast("모든 카테고리에 영어 카테고리명을 입력해주세요", "warning");
      setSelectedLang('en');
      return;
    }
    try {
      await onDone();
      onClose();
    } catch (error) {
      onToast(getApiErrorMessage(error, "카테고리 목록 갱신에 실패했습니다"), "warning");
    }
  };

  const onDragStart = (index: number) => {
    dragIdx.current = index;
  };
  const onDragOver = (event: React.DragEvent, index: number) => {
    event.preventDefault();
    overIdx.current = index;
  };
  const onDrop = async () => {
    const from = dragIdx.current;
    const to = overIdx.current;
    if (isSaving || from === null || to === null || from === to) return;
    const next = [...cats];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const reordered = next.map((category, index) => ({ ...category, order: index + 1 }));
    const previous = cats;
    setCats(reordered);
    dragIdx.current = null;
    overIdx.current = null;

    try {
      await onReorder(reordered);
      onToast("카테고리 순서가 변경되었습니다", "success");
    } catch (error) {
      setCats(previous);
      onToast(getApiErrorMessage(error, "카테고리 순서 저장에 실패했습니다"), "warning");
    }
  };

  return (
    <div
      onClick={(event) => {
        if (event.target === event.currentTarget && !isSaving) {
          onClose();
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        padding: 24,
      }}
    >
      <div
        style={{
          width: 780,
          maxHeight: '90vh',
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
          <div>
            <span style={{ fontSize: 16, fontWeight: 700, color: t.text }}>카테고리 관리</span>
            <span style={{ marginLeft: 10, fontSize: 12, color: t.textHint }}>
              카테고리 추가·수정·삭제 및 드래그 순서 조정. 영어명은 필수입니다.
            </span>
          </div>
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
              cursor: 'pointer',
            }}
          >
            <X size={14} style={{ color: t.textSec }} />
          </button>
        </div>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ width: 210, borderRight: `1px solid ${t.border}`, overflowY: 'auto', flexShrink: 0, padding: '10px 0' }}>
            <div style={{ padding: '4px 16px 8px', fontSize: 10, fontWeight: 600, color: t.textHint, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
              언어 선택
            </div>
            {supportedLanguages.map((language) => {
              const isActive = selectedLang === language.code;

              return (
                <button
                  key={language.code}
                  type="button"
                  onClick={() => setSelectedLang(language.code)}
                  disabled={isSaving}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    padding: '8px 16px',
                    background: 'transparent',
                    border: 'none',
                    borderLeft: `3px solid ${isActive ? t.accent : 'transparent'}`,
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 16, lineHeight: 1 }}>{language.flag}</span>
                  <span
                    style={{
                      flex: 1,
                      fontSize: 13,
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? t.accent : t.text,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {language.englishName ?? language.label}
                  </span>
                  {language.required && (
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10, background: 'rgba(124,106,247,0.12)', color: t.accent, whiteSpace: 'nowrap' }}>
                      필수
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ padding: '14px 20px 12px', borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
              {isEnglish ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={newEnName}
                    onChange={(event) => setNewEnName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') handleAdd();
                    }}
                    disabled={isSaving}
                    placeholder="새 카테고리명 (영어 필수)"
                    style={{
                      flex: 1,
                      height: 36,
                      padding: '0 12px',
                      borderRadius: 8,
                      border: `1px solid ${t.border2}`,
                      background: t.surface2,
                      color: t.text,
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAdd}
                    disabled={isSaving}
                    style={{
                      height: 36,
                      padding: '0 18px',
                      borderRadius: 8,
                      border: 'none',
                      background: t.accent,
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    추가
                  </button>
                </div>
              ) : (
                <div style={{ height: 36, display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: t.textHint }}>
                    새 카테고리는 English 탭에서 추가할 수 있습니다.
                  </span>
                </div>
              )}
            </div>

            {!isEnglish && (
              <div style={{ padding: '7px 20px', borderBottom: `1px solid ${t.border}`, background: dark ? 'rgba(124,106,247,0.05)' : 'rgba(124,106,247,0.04)', flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: t.textHint }}>
                  미입력 시 영어 카테고리명이 대신 노출됩니다.
                </span>
              </div>
            )}

            <div style={{ flex: 1, padding: '10px 20px 16px' }}>
              {cats.map((category, index) => {
                const currentName = category.names[selectedLang] ?? '';
                const englishName = category.names.en ?? '';
                const englishMissing = isEnglish && !englishName.trim();
                const isFilled = Boolean(currentName.trim());

                return (
                  <div
                    key={category.id}
                    draggable
                    onDragStart={() => onDragStart(index)}
                    onDragOver={(event) => onDragOver(event, index)}
                    onDrop={onDrop}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      marginBottom: 6,
                      background: t.surface2,
                      borderRadius: 8,
                      border: `1px solid ${englishMissing ? 'rgba(220,38,38,0.3)' : t.border}`,
                      cursor: 'grab',
                      userSelect: 'none',
                    }}
                  >
                    <GripVertical size={15} style={{ color: t.textHint, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: t.textHint, minWidth: 18, textAlign: 'right', flexShrink: 0 }}>
                      {index + 1}
                    </span>
                    <input
                      type="text"
                      value={currentName}
                      onChange={(event) => {
                        const value = event.target.value;
                        setCats((prev) =>
                          prev.map((item) =>
                            item.id === category.id
                              ? { ...item, names: { ...item.names, [selectedLang]: value } }
                              : item,
                          ),
                        );
                      }}
                      disabled={isSaving}
                      onClick={(event) => event.stopPropagation()}
                      onBlur={(event) => {
                        const previous = categories.find((item) => item.id === category.id);
                        const oldName = previous?.names[selectedLang] ?? '';
                        void handleRename(category, selectedLang, oldName, event.target.value);
                      }}
                      placeholder={isEnglish ? "영어 카테고리명 (필수)" : englishName || "영어명 없음"}
                      style={{
                        flex: 1,
                        height: 32,
                        padding: '0 10px',
                        borderRadius: 6,
                        border: `1px solid ${englishMissing ? 'rgba(220,38,38,0.4)' : t.border}`,
                        background: t.surface,
                        color: t.text,
                        fontSize: 13,
                        outline: 'none',
                        boxSizing: 'border-box',
                        minWidth: 0,
                      }}
                    />
                    <span
                      title={isFilled ? "입력됨" : isEnglish ? "필수 미입력" : "미입력"}
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        flexShrink: 0,
                        background: isFilled ? '#16A34A' : isEnglish ? '#DC2626' : t.border2,
                      }}
                    />
                    <span style={{ fontSize: 11, color: t.textHint, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      문의 {usageCount(englishName)}건
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDelete(category)}
                      disabled={isSaving}
                      style={{
                        height: 28,
                        padding: '0 10px',
                        borderRadius: 6,
                        border: '1px solid rgba(220,38,38,0.3)',
                        background: 'transparent',
                        color: '#DC2626',
                        fontSize: 11,
                        fontWeight: 500,
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      삭제
                    </button>
                  </div>
                );
              })}
              {cats.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: t.textHint }}>
                  카테고리가 없습니다. 영어 탭에서 추가해주세요.
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ padding: '14px 24px', borderTop: `1px solid ${t.border}`, display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button
            type="button"
            onClick={handleComplete}
            disabled={isSaving}
            style={{
              height: 36,
              padding: '0 24px',
              borderRadius: 8,
              border: 'none',
              background: t.accent,
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            완료
          </button>
        </div>
      </div>
    </div>
  );
}
