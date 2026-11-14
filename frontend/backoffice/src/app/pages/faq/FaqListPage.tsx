import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { GripVertical, Plus, Search, X } from 'lucide-react';
import {
  DataTable,
  TablePagination,
  buildPaginationItems,
  getPaginationRange,
} from '../../components/shared/DataTable';
import { Toast } from '../../components/shared/Toast';
import { SEARCH_DEBOUNCE_MS } from '../../components/shared/TableFilters';
import { useAppShell } from '../../layouts/AppShell';
import { DEFAULT_LANGUAGES, SupportedLanguage } from '../../types/language';
import {
  useCreateFaqCategoryMutation,
  useCreateFaqItemMutation,
  useDeleteFaqCategoryMutation,
  useDeleteFaqItemMutation,
  useFaqItemQuery,
  useListAllFaqItemsMutation,
  useListFaqCategoriesQuery,
  useListFaqItemsQuery,
  useReorderFaqCategoriesMutation,
  useReorderFaqItemsMutation,
  useUpdateFaqCategoryMutation,
  useUpdateFaqItemMutation,
} from '../../queries/faq';
import { useListActiveLanguagesQuery } from '../../queries/languages';
import { toSupportedLanguages } from '../../utils/supportedLanguages';
import type { AdminFaqItem, AdminFaqStatus, FaqCategoryLocale, FaqLocale, ListFaqItemsParams } from '@/api/faq';

type ToastState = {
  message: string;
  type: 'success' | 'warning';
} | null;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getApiErrorMessage = (error: unknown, fallback: string) => {
  const data = isRecord(error) && isRecord(error.response) && isRecord(error.response.data)
    ? error.response.data
    : null;

  const detail = data?.detail;
  if (Array.isArray(detail)) {
    const firstMessage = detail
      .map((item) => (isRecord(item) && typeof item.msg === 'string' ? item.msg : null))
      .find((message): message is string => Boolean(message));

    if (firstMessage) return firstMessage;
  }

  if (typeof detail === 'string') return detail;
  if (typeof data?.msg === 'string') return data.msg;
  if (typeof data?.message === 'string') return data.message;

  return fallback;
};

type Category = {
  id: string;
  order: number;
  name: string;
  names: Record<string, string>;
  faqCount: number;
};

type FaqStatus = '게시중' | '숨김';

type FaqItem = {
  id: string;
  order: number;
  question: string;
  answer: string;
  questionKo?: string;
  answerKo?: string;
  categoryId?: string;
  category: string;
  status: FaqStatus;
  createdAt: string;
  updatedAt: string;
  author: string;
  locales: Record<string, FaqLocale>;
};

type FaqSaveDraft = {
  question: string;
  answer: string;
  categoryId: string;
  status: FaqStatus;
  locales: Record<string, FaqLocale>;
};

const ALL_FILTER = '전체';
const FAQ_PAGE_SIZE = 20;

const FAQ_STATUS_LABEL: Record<AdminFaqStatus, FaqStatus> = {
  PUBLISHED: '게시중',
  HIDDEN: '숨김',
};

const FAQ_STATUS_VALUE: Record<FaqStatus, AdminFaqStatus> = {
  게시중: 'PUBLISHED',
  숨김: 'HIDDEN',
};

const isAdminFaqStatus = (value: string): value is AdminFaqStatus =>
  value === 'PUBLISHED' || value === 'HIDDEN';

const parsePageParam = (value: string | null) => {
  const page = Number(value ?? '1');

  return Number.isInteger(page) && page > 0 ? page : 1;
};

const formatDateTimeKst = (value: string | null) => {
  if (!value) return '-';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);

  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(parsed);
};

const toFaqItem = (item: AdminFaqItem): FaqItem => ({
  id: item.id,
  order: item.sort_order,
  question: item.question,
  answer: item.answer,
  questionKo: item.locales.ko?.question ?? '',
  answerKo: item.locales.ko?.answer ?? '',
  categoryId: item.category_id,
  category: item.category_name,
  status: item.status ? FAQ_STATUS_LABEL[item.status] : '숨김',
  createdAt: formatDateTimeKst(item.created_at),
  updatedAt: formatDateTimeKst(item.updated_at),
  author: item.author ?? '-',
  locales: item.locales,
});

const getFaqLocaleValues = (initial?: FaqItem) => {
  const locales = initial?.locales ?? {
    en: {
      question: initial?.question ?? '',
      answer: initial?.answer ?? '',
    },
  };

  return {
    questions: Object.fromEntries(
      Object.entries(locales).map(([code, locale]) => [code, locale.question]),
    ),
    answers: Object.fromEntries(
      Object.entries(locales).map(([code, locale]) => [code, locale.answer]),
    ),
  };
};

function CatBadge({ name, dark }: { name: string; dark: boolean }) {
  const bg = dark ? 'rgba(124,106,247,0.15)' : 'rgba(124,106,247,0.1)';
  const color = '#7C6AF7';
  const border = 'rgba(124,106,247,0.25)';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 8px',
        borderRadius: 9999,
        fontSize: 11,
        fontWeight: 600,
        background: bg,
        color,
        border: `1px solid ${border}`,
      }}
    >
      {name}
    </span>
  );
}

function CategoryModal({
  dark,
  categories,
  onClose,
  onAdd,
  onRename,
  onDelete,
  onReorder,
  onDone,
  onToast,
  isSaving,
  supportedLanguages,
}: {
  dark: boolean;
  categories: Category[];
  onClose: () => void;
  onAdd: (name: string) => Promise<Category>;
  onRename: (categoryId: string, languageCode: string, name: string) => Promise<Category>;
  onDelete: (categoryId: string) => Promise<void>;
  onReorder: (cats: Category[]) => Promise<void>;
  onDone: () => Promise<void>;
  onToast: (message: string, type?: 'success' | 'warning') => void;
  isSaving: boolean;
  supportedLanguages: SupportedLanguage[];
}) {
  const t = {
    surface: dark ? '#1A2035' : '#ffffff',
    surface2: dark ? '#232C44' : '#F4F5F7',
    border: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)',
    border2: dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)',
    text: dark ? '#E8EAF0' : '#1A1A1A',
    textSec: dark ? '#8B8FA8' : '#4A4A58',
    textHint: dark ? '#5A6080' : '#A0A0AA',
    accent: '#7C6AF7',
    overlay: 'rgba(0,0,0,0.6)',
  };

  const [cats, setCats] = useState<Category[]>([...categories]);
  const [newName, setNewName] = useState('');
  const [selectedLang, setSelectedLang] = useState('en');
  const [localizedNames, setLocalizedNames] = useState<Record<string, Record<string, string>>>(
    () => Object.fromEntries(categories.map((category) => [category.id, category.names])),
  );
  const dragIdx = useRef<number | null>(null);
  const overIdx = useRef<number | null>(null);
  const isEnglish = selectedLang === 'en';

  useEffect(() => {
    setCats([...categories]);
    setLocalizedNames(
      Object.fromEntries(categories.map((category) => [category.id, category.names])),
    );
  }, [categories]);

  const usageCount = (category: Category) => category.faqCount;

  const handleDone = async () => {
    try {
      await onDone();
      onClose();
    } catch (error) {
      onToast(getApiErrorMessage(error, '카테고리 목록 갱신에 실패했습니다'), 'warning');
    }
  };

  const handleAdd = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      onToast('카테고리명을 입력해주세요', 'warning');
      return;
    }
    if (cats.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      onToast('이미 존재하는 카테고리입니다', 'warning');
      return;
    }

    try {
      const created = await onAdd(trimmed);
      setCats((prev) => [...prev, created]);
      setLocalizedNames((prev) => ({ ...prev, [created.id]: { en: created.name } }));
      setNewName('');
      onToast('카테고리가 추가되었습니다', 'success');
    } catch (error) {
      onToast(getApiErrorMessage(error, '카테고리 추가에 실패했습니다'), 'warning');
    }
  };

  const handleRename = async (id: string, languageCode: string, oldName: string, newVal: string) => {
    const trimmed = newVal.trim();
    if (!trimmed) {
      if (languageCode === 'en') {
        onToast('카테고리명을 입력해주세요', 'warning');
      }
      return;
    }
    if (trimmed === oldName) return;
    if (
      languageCode === 'en' &&
      cats.some((c) => c.id !== id && c.name.toLowerCase() === trimmed.toLowerCase())
    ) {
      onToast('이미 존재하는 카테고리입니다', 'warning');
      return;
    }

    try {
      const updated = await onRename(id, languageCode, trimmed);
      setCats((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)));
      setLocalizedNames((prev) => ({ ...prev, [id]: updated.names }));
      onToast('카테고리명이 변경되었습니다', 'success');
    } catch (error) {
      onToast(getApiErrorMessage(error, '카테고리명 변경에 실패했습니다'), 'warning');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const target = cats.find((cat) => cat.id === id);
    const count = target ? usageCount(target) : 0;
    if (count > 0) {
      onToast(`해당 카테고리를 사용 중인 FAQ가 ${count}개 있어 삭제할 수 없습니다`, 'warning');
      return;
    }

    try {
      await onDelete(id);
      setCats((prev) => prev.filter((c) => c.id !== id).map((c, i) => ({ ...c, order: i + 1 })));
      setLocalizedNames((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      onToast('카테고리가 삭제되었습니다', 'success');
    } catch (error) {
      onToast(getApiErrorMessage(error, '카테고리 삭제에 실패했습니다'), 'warning');
    }
  };

  const onDragStart = (i: number) => {
    dragIdx.current = i;
  };
  const onDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    overIdx.current = i;
  };
  const onDrop = async () => {
    const from = dragIdx.current;
    const to = overIdx.current;
    if (isSaving || from === null || to === null || from === to) return;
    const next = [...cats];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const reordered = next.map((c, i) => ({ ...c, order: i + 1 }));
    const previous = cats;
    setCats(reordered);
    dragIdx.current = null;
    overIdx.current = null;

    try {
      await onReorder(reordered);
      onToast('카테고리 순서가 변경되었습니다', 'success');
    } catch (error) {
      setCats(previous);
      onToast(getApiErrorMessage(error, '카테고리 순서 저장에 실패했습니다'), 'warning');
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) {
          onClose();
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: t.overlay,
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
            style={{ width: 28, height: 28, borderRadius: '50%', border: `1px solid ${t.border}`, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isSaving ? 'not-allowed' : 'pointer' }}
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
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: '1px 6px',
                        borderRadius: 10,
                        background: 'rgba(124,106,247,0.12)',
                        color: t.accent,
                        whiteSpace: 'nowrap',
                      }}
                    >
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
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleAdd();
                    }}
                    disabled={isSaving}
                    placeholder="새 카테고리명 (영어 필수)"
                    style={{ flex: 1, height: 36, padding: '0 12px', borderRadius: 8, border: `1px solid ${t.border2}`, background: t.surface2, color: t.text, fontSize: 13, outline: 'none' }}
                  />
                  <button type="button" onClick={() => { void handleAdd(); }} disabled={isSaving} style={{ height: 36, padding: '0 18px', borderRadius: 8, border: 'none', background: t.accent, color: '#fff', fontSize: 13, fontWeight: 600, cursor: isSaving ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
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
              {cats.map((cat, i) => {
                const currentName = localizedNames[cat.id]?.[selectedLang] ?? '';
                const enName = localizedNames[cat.id]?.en ?? cat.name;
                const enOk = Boolean(enName.trim());
                const isFilled = Boolean(currentName.trim());

                return (
                <div
                  key={cat.id}
                  draggable={!isSaving}
                  onDragStart={() => onDragStart(i)}
                  onDragOver={(e) => onDragOver(e, i)}
                  onDrop={() => { void onDrop(); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 6, background: t.surface2, borderRadius: 8, border: `1px solid ${isEnglish && !enOk ? 'rgba(220,38,38,0.3)' : t.border}`, cursor: isSaving ? 'not-allowed' : 'grab', userSelect: 'none' }}
                >
                  <GripVertical size={15} style={{ color: t.textHint, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: t.textHint, minWidth: 18, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                  <input
                    type="text"
                    value={currentName}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (isEnglish) {
                        setCats((prev) =>
                          prev.map((item) => (item.id === cat.id ? { ...item, name: value } : item)),
                        );
                      }
                      setCats((prev) =>
                        prev.map((item) =>
                          item.id === cat.id
                            ? { ...item, names: { ...item.names, [selectedLang]: value } }
                            : item,
                        ),
                      );
                      setLocalizedNames((prev) => ({
                        ...prev,
                        [cat.id]: { ...prev[cat.id], [selectedLang]: value },
                      }));
                    }}
                    onBlur={(e) => {
                      if (isEnglish) {
                        void handleRename(cat.id, selectedLang, categories.find((category) => category.id === cat.id)?.name ?? cat.name, e.target.value);
                        return;
                      }
                      void handleRename(cat.id, selectedLang, categories.find((category) => category.id === cat.id)?.names[selectedLang] ?? '', e.target.value);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    disabled={isSaving}
                    placeholder={isEnglish ? '영어 카테고리명 (필수)' : enName || '영어명 없음'}
                    style={{ flex: 1, height: 32, padding: '0 10px', borderRadius: 6, border: `1px solid ${isEnglish && !enOk ? 'rgba(220,38,38,0.4)' : t.border}`, background: t.surface, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box', minWidth: 0 }}
                  />
                  <span
                    title={isFilled ? '입력됨' : isEnglish ? '필수 미입력' : '미입력'}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      flexShrink: 0,
                      background: isFilled ? '#16A34A' : isEnglish ? '#DC2626' : t.border2,
                    }}
                  />
                  <span style={{ fontSize: 11, color: t.textHint, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    FAQ {usageCount(cat)}개
                  </span>
                  <button
                    type="button"
                    onClick={() => { void handleDelete(cat.id, cat.name); }}
                    disabled={isSaving}
                    style={{ height: 28, padding: '0 10px', borderRadius: 6, border: '1px solid rgba(220,38,38,0.3)', background: 'transparent', color: '#DC2626', fontSize: 11, fontWeight: 500, cursor: isSaving ? 'not-allowed' : 'pointer', flexShrink: 0 }}
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
            onClick={() => {
              void handleDone();
            }}
            disabled={isSaving}
            style={{ height: 36, padding: '0 24px', borderRadius: 8, border: 'none', background: t.accent, color: '#fff', fontSize: 13, fontWeight: 600, cursor: isSaving ? 'not-allowed' : 'pointer' }}
          >
            {isSaving ? '처리 중' : '완료'}
          </button>
        </div>
      </div>
    </div>
  );
}
function DeleteModal({
  dark,
  question,
  onConfirm,
  onClose,
}: {
  dark: boolean;
  question: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const t = {
    surface: dark ? '#1A2035' : '#ffffff',
    border: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)',
    border2: dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)',
    text: dark ? '#E8EAF0' : '#1A1A1A',
    textSec: dark ? '#8B8FA8' : '#4A4A58',
    textHint: dark ? '#5A6080' : '#A0A0AA',
    overlay: 'rgba(0,0,0,0.6)',
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
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
      <div style={{ width: 400, background: t.surface, borderRadius: 14, overflow: 'hidden', boxShadow: '0 24px 48px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>FAQ 삭제</span>
          <button type="button" onClick={onClose} style={{ width: 28, height: 28, borderRadius: '50%', border: `1px solid ${t.border}`, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={14} style={{ color: t.textSec }} />
          </button>
        </div>
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: t.text, marginBottom: 8 }}>
            <span style={{ fontWeight: 700 }}>"{question}"</span>
          </div>
          <div style={{ fontSize: 14, color: t.text, marginBottom: 10 }}>FAQ를 삭제하시겠습니까?</div>
          <div style={{ fontSize: 11, color: t.textHint }}>삭제 후 복구할 수 없으며, 프론트 아코디언에서도 즉시 제거됩니다.</div>
        </div>
        <div style={{ padding: '12px 24px 20px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} style={{ height: 36, padding: '0 18px', borderRadius: 8, border: `1px solid ${t.border2}`, background: 'transparent', color: t.text, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            취소
          </button>
          <button type="button" onClick={onConfirm} style={{ height: 36, padding: '0 18px', borderRadius: 8, border: 'none', background: '#DC2626', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

function FaqFormModal({
  dark,
  mode,
  initial,
  categories,
  onClose,
  onSave,
  onToast,
  isSaving,
  supportedLanguages,
}: {
  dark: boolean;
  mode: 'add' | 'edit';
  initial?: FaqItem;
  categories: Category[];
  onClose: () => void;
  onSave: (data: FaqSaveDraft) => Promise<void>;
  onToast: (message: string, type?: 'success' | 'warning') => void;
  isSaving: boolean;
  supportedLanguages: SupportedLanguage[];
}) {
  const t = {
    surface: dark ? '#1A2035' : '#ffffff',
    surface2: dark ? '#232C44' : '#F4F5F7',
    border: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)',
    border2: dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)',
    text: dark ? '#E8EAF0' : '#1A1A1A',
    textSec: dark ? '#8B8FA8' : '#4A4A58',
    textHint: dark ? '#5A6080' : '#A0A0AA',
    accent: '#7C6AF7',
    accentBg: dark ? 'rgba(124,106,247,0.14)' : 'rgba(124,106,247,0.09)',
    overlay: 'rgba(0,0,0,0.6)',
    error: '#DC2626',
    success: '#16A34A',
    successBg: dark ? 'rgba(22,163,74,0.14)' : 'rgba(22,163,74,0.09)',
  };
  const [selectedLang, setSelectedLang] = useState('en');
  const [questions, setQuestions] = useState<Record<string, string>>(
    () => getFaqLocaleValues(initial).questions,
  );
  const [answers, setAnswers] = useState<Record<string, string>>(
    () => getFaqLocaleValues(initial).answers,
  );
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id ?? '');
  const [status, setStatus] = useState<FaqStatus>(initial?.status ?? '게시중');
  const selectedLanguage = supportedLanguages.find((language) => language.code === selectedLang);
  const isEnglishSelected = selectedLang === 'en';

  useEffect(() => {
    const localeValues = getFaqLocaleValues(initial);
    setQuestions(localeValues.questions);
    setAnswers(localeValues.answers);
    setCategoryId(initial?.categoryId ?? categories[0]?.id ?? '');
    setStatus(initial?.status ?? '게시중');
    setSelectedLang('en');
  }, [categories, initial]);

  const handleSave = async () => {
    if (!questions.en?.trim()) {
      setSelectedLang('en');
      onToast('질문을 입력해주세요', 'warning');
      return;
    }
    if (!answers.en?.trim()) {
      setSelectedLang('en');
      onToast('답변을 입력해주세요', 'warning');
      return;
    }
    if (!categoryId) {
      onToast('카테고리를 선택해주세요', 'warning');
      return;
    }

    try {
      const localeCodes = Array.from(
        new Set([
          ...supportedLanguages.map((language) => language.code),
          ...Object.keys(initial?.locales ?? {}),
        ]),
      );
      const locales = Object.fromEntries(
        localeCodes
          .map((code) => {
            const question = questions[code]?.trim() ?? '';
            const answer = answers[code]?.trim() ?? '';
            return [code, { question, answer }] as const;
          })
          .filter(([code, locale]) => {
            if (code === 'en') return true;
            return locale.question.length > 0 && locale.answer.length > 0;
          }),
      );

      await onSave({
        question: questions.en.trim(),
        answer: answers.en.trim(),
        categoryId,
        status,
        locales,
      });
    } catch {
      // Toast is emitted by the caller so the modal can stay open for retry.
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
  const labelStyle = { display: 'block' as const, fontSize: 11, fontWeight: 600 as const, color: t.textSec, marginBottom: 6 };

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, background: t.overlay, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
      <div style={{ width: 880, maxHeight: '92vh', background: t.surface, borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 48px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{mode === 'add' ? 'FAQ 등록' : 'FAQ 수정'}</span>
          <button type="button" onClick={onClose} disabled={isSaving} style={{ width: 28, height: 28, borderRadius: '50%', border: `1px solid ${t.border}`, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isSaving ? 'not-allowed' : 'pointer' }}>
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
              const isFilled = (questions[language.code] ?? '').trim().length > 0;
              let badgeLabel = '미입력';
              let badgeBg = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
              let badgeColor = t.textHint;

              if (language.required) {
                badgeLabel = '필수';
                badgeBg = t.accentBg;
                badgeColor = t.accent;
              } else if (isFilled) {
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

          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20, lineHeight: 1 }}>{selectedLanguage?.flag}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{selectedLanguage?.label}</span>
              {isEnglishSelected && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: t.accentBg, color: t.accent }}>필수</span>}
            </div>

            {!isEnglishSelected && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', border: `1px solid ${t.border}`, fontSize: 12, color: t.textHint, lineHeight: 1.6 }}>
                미입력 시 유저 화면에서 이 언어 선택 시에도 영문이 노출됩니다.
              </div>
            )}

            <div>
              <label style={labelStyle}>질문{isEnglishSelected && <span style={{ color: t.error }}> *</span>}</label>
              <input
                type="text"
                value={questions[selectedLang] ?? ''}
                onChange={(e) => setQuestions((prev) => ({ ...prev, [selectedLang]: e.target.value }))}
                disabled={isSaving}
                placeholder={isEnglishSelected ? 'Enter the question in English' : '선택 사항 — 미입력 시 영문 질문이 표시됩니다'}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <label style={labelStyle}>답변{isEnglishSelected && <span style={{ color: t.error }}> *</span>}</label>
              <textarea
                value={answers[selectedLang] ?? ''}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [selectedLang]: e.target.value }))}
                disabled={isSaving}
                placeholder={isEnglishSelected ? 'Enter the answer in English' : '선택 사항 — 미입력 시 영문 답변이 표시됩니다'}
                rows={9}
                style={{ ...inputStyle, minHeight: 180, flex: 1, padding: 12, resize: 'vertical', lineHeight: 1.6 }}
              />
            </div>
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${t.border}`, padding: '0 24px', height: 48, display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: t.textSec, whiteSpace: 'nowrap' }}>카테고리</span>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={isSaving} style={{ height: 28, padding: '0 8px', borderRadius: 6, border: `1px solid ${t.border2}`, background: t.surface2, color: t.text, fontSize: 12, cursor: isSaving ? 'not-allowed' : 'pointer', outline: 'none' }}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={{ width: 1, height: 18, background: t.border2, flexShrink: 0 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: t.textSec, whiteSpace: 'nowrap' }}>상태</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as FaqStatus)} disabled={isSaving} style={{ height: 28, padding: '0 8px', borderRadius: 6, border: `1px solid ${t.border2}`, background: t.surface2, color: t.text, fontSize: 12, cursor: isSaving ? 'not-allowed' : 'pointer', outline: 'none' }}>
              <option value="게시중">게시중</option>
              <option value="숨김">숨김</option>
            </select>
          </div>
        </div>

        <div style={{ padding: '12px 24px', borderTop: `1px solid ${t.border}`, display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
          <button type="button" onClick={onClose} disabled={isSaving} style={{ height: 36, padding: '0 18px', borderRadius: 8, border: `1px solid ${t.border2}`, background: 'transparent', color: t.text, fontSize: 13, fontWeight: 500, cursor: isSaving ? 'not-allowed' : 'pointer' }}>
            취소
          </button>
          <button type="button" onClick={() => { void handleSave(); }} disabled={isSaving} style={{ height: 36, padding: '0 22px', borderRadius: 8, border: 'none', background: t.accent, color: '#fff', fontSize: 13, fontWeight: 600, cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.72 : 1 }}>
            {isSaving ? '저장 중' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
function ReorderModal({
  dark,
  items,
  onClose,
  onSave,
  isSaving,
}: {
  dark: boolean;
  items: FaqItem[];
  onClose: () => void;
  onSave: (ordered: FaqItem[]) => Promise<void>;
  isSaving: boolean;
}) {
  const t = {
    surface: dark ? '#1A2035' : '#ffffff',
    surface2: dark ? '#232C44' : '#F4F5F7',
    border: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)',
    border2: dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)',
    text: dark ? '#E8EAF0' : '#1A1A1A',
    textSec: dark ? '#8B8FA8' : '#4A4A58',
    textHint: dark ? '#5A6080' : '#A0A0AA',
    accent: '#7C6AF7',
    overlay: 'rgba(0,0,0,0.6)',
  };
  const [list, setList] = useState([...items]);
  const dragIdx = useRef<number | null>(null);
  const overIdx = useRef<number | null>(null);
  const TOP_LIMIT = 10;

  useEffect(() => {
    setList([...items]);
  }, [items]);

  const onDragStart = (i: number) => {
    dragIdx.current = i;
  };
  const onDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    overIdx.current = i;
  };
  const onDrop = () => {
    const from = dragIdx.current;
    const to = overIdx.current;
    if (isSaving || from === null || to === null || from === to) return;
    const next = [...list];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setList(next.map((it, idx) => ({ ...it, order: idx + 1 })));
    dragIdx.current = null;
    overIdx.current = null;
  };

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget && !isSaving) onClose(); }} style={{ position: 'fixed', inset: 0, background: t.overlay, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
      <div style={{ width: 560, maxHeight: '90vh', background: t.surface, borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 48px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: t.text }}>노출 순서 조정</span>
          <button type="button" onClick={onClose} disabled={isSaving} style={{ width: 28, height: 28, borderRadius: '50%', border: `1px solid ${t.border}`, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={14} style={{ color: t.textSec }} />
          </button>
        </div>
        <div style={{ padding: '14px 24px 8px', flexShrink: 0 }}>
          <p style={{ margin: 0, fontSize: 12, color: t.textSec, lineHeight: 1.6 }}>
            카드를 드래그하여 순서를 변경하세요. 변경된 순서는 프론트 아코디언에 그대로 반영됩니다.
          </p>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 24px 16px' }}>
          {list.map((item, i) => (
            <div key={item.id}>
              {list.length > TOP_LIMIT && i === TOP_LIMIT && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0' }}>
                  <div style={{ flex: 1, borderTop: '2px dashed #DC2626' }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#DC2626', whiteSpace: 'nowrap' }}>
                    여기까지 홈 화면 노출 · 이후 항목은 FAQ 전체 페이지에서 노출
                  </span>
                  <div style={{ flex: 1, borderTop: '2px dashed #DC2626' }} />
                </div>
              )}
              <div draggable={!isSaving} onDragStart={() => onDragStart(i)} onDragOver={(e) => onDragOver(e, i)} onDrop={onDrop} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: 6, background: t.surface2, borderRadius: 8, border: `1px solid ${t.border}`, cursor: isSaving ? 'not-allowed' : 'grab', userSelect: 'none' }}>
                <GripVertical size={16} style={{ color: t.textHint, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: t.textHint, minWidth: 22, flexShrink: 0 }}>{i + 1}</span>
                <span style={{ fontSize: 13, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{item.question}</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '16px 24px', borderTop: `1px solid ${t.border}`, display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
          <button type="button" onClick={onClose} disabled={isSaving} style={{ height: 36, padding: '0 18px', borderRadius: 8, border: `1px solid ${t.border2}`, background: 'transparent', color: t.text, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            취소
          </button>
          <button type="button" onClick={() => { void onSave(list); }} disabled={isSaving} style={{ height: 36, padding: '0 22px', borderRadius: 8, border: 'none', background: t.accent, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {isSaving ? '저장 중' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function FaqListPage() {
  const { dark } = useAppShell();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    data: faqCategories = [],
    isLoading: isFaqCategoriesLoading,
    isFetching: isFaqCategoriesFetching,
    isError: isFaqCategoriesError,
    refetch: refetchFaqCategories,
  } = useListFaqCategoriesQuery();
  const createFaqCategoryMutation = useCreateFaqCategoryMutation();
  const updateFaqCategoryMutation = useUpdateFaqCategoryMutation();
  const deleteFaqCategoryMutation = useDeleteFaqCategoryMutation();
  const reorderFaqCategoriesMutation = useReorderFaqCategoriesMutation();
  const createFaqItemMutation = useCreateFaqItemMutation();
  const updateFaqItemMutation = useUpdateFaqItemMutation();
  const deleteFaqItemMutation = useDeleteFaqItemMutation();
  const listAllFaqItemsMutation = useListAllFaqItemsMutation();
  const reorderFaqItemsMutation = useReorderFaqItemsMutation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [reorderFaqs, setReorderFaqs] = useState<FaqItem[]>([]);
  const categoryParam = searchParams.get('category_id');
  const statusParam = searchParams.get('status');
  const searchParam = searchParams.get('q') ?? '';
  const categoryFilter = categoryParam ?? ALL_FILTER;
  const statusFilter = statusParam && isAdminFaqStatus(statusParam) ? statusParam : ALL_FILTER;
  const currentPage = parsePageParam(searchParams.get('page'));
  const [searchQuery, setSearchQuery] = useState(searchParam);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showReorder, setShowReorder] = useState(false);
  const [showForm, setShowForm] = useState<'add' | 'edit' | null>(null);
  const [editTarget, setEditTarget] = useState<FaqItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FaqItem | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const isCategorySaving =
    createFaqCategoryMutation.isPending ||
    updateFaqCategoryMutation.isPending ||
    deleteFaqCategoryMutation.isPending ||
    reorderFaqCategoriesMutation.isPending;
  const isFaqSaving =
    createFaqItemMutation.isPending ||
    updateFaqItemMutation.isPending ||
    deleteFaqItemMutation.isPending;
  const isReorderLoading = listAllFaqItemsMutation.isPending;
  const isReorderSaving = reorderFaqItemsMutation.isPending;

  const updateParams = (updates: Record<string, string | number | null | undefined>) => {
    const next = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '' || value === ALL_FILTER) {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });

    setSearchParams(next, { replace: true });
  };

  const faqItemsParams = useMemo<ListFaqItemsParams>(
    () => ({
      category_id: categoryFilter === ALL_FILTER ? undefined : categoryFilter,
      status: statusFilter === ALL_FILTER ? undefined : statusFilter,
      q: searchParam || undefined,
      page: currentPage,
      size: FAQ_PAGE_SIZE,
    }),
    [categoryFilter, currentPage, searchParam, statusFilter],
  );

  const faqItemsQuery = useListFaqItemsQuery(faqItemsParams);
  const shouldLoadActiveLanguages = showCategoryModal || showForm !== null;
  const activeLanguagesQuery = useListActiveLanguagesQuery(shouldLoadActiveLanguages);
  const faqDetailQuery = useFaqItemQuery(
    editTarget?.id ?? null,
    showForm === 'edit' && Boolean(editTarget),
  );
  const supportedLanguages = useMemo(
    () =>
      activeLanguagesQuery.data
        ? toSupportedLanguages(activeLanguagesQuery.data.items)
        : DEFAULT_LANGUAGES,
    [activeLanguagesQuery.data],
  );

  const t = {
    surface: dark ? '#0F1829' : '#ffffff',
    surface2: dark ? '#1A2035' : '#F4F5F7',
    border: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)',
    border2: dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)',
    text: dark ? '#E8EAF0' : '#1A1A1A',
    textSec: dark ? '#8B8FA8' : '#4A4A58',
    textHint: dark ? '#5A6080' : '#A0A0AA',
    pageBg: dark ? '#0A0F1E' : '#F4F5F7',
    accent: '#7C6AF7',
  };

  const onToast = (message: string, type: 'success' | 'warning' = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (statusParam && !isAdminFaqStatus(statusParam)) {
      updateParams({ status: null });
    }
  }, [statusParam]);

  useEffect(() => {
    setSearchQuery(searchParam);
  }, [searchParam]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query === searchParam) return;

    const timer = window.setTimeout(() => {
      updateParams({ q: query || null, page: 1 });
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [searchParam, searchQuery]);

  useEffect(() => {
    setCategories(
      faqCategories
        .map((category) => ({
          id: category.id,
          order: category.sort_order,
          name: category.name,
          names: Object.fromEntries(
            Object.entries(category.locales).map(([code, locale]) => [code, locale.name]),
          ),
          faqCount: category.faq_count,
        }))
        .sort((a, b) => a.order - b.order),
    );
  }, [faqCategories]);

  useEffect(() => {
    if (isFaqCategoriesLoading || isFaqCategoriesFetching || isFaqCategoriesError) return;
    if (!categoryParam) return;
    if (faqCategories.some((category) => category.id === categoryParam)) return;

    updateParams({ category_id: null });
  }, [
    categoryParam,
    faqCategories,
    isFaqCategoriesError,
    isFaqCategoriesFetching,
    isFaqCategoriesLoading,
  ]);

  useEffect(() => {
    setFaqs((faqItemsQuery.data?.items ?? []).map((item) => toFaqItem(item)));
  }, [faqItemsQuery.data]);

  const totalRows = faqItemsQuery.data?.total ?? faqs.length;
  const responsePage = faqItemsQuery.data?.page ?? currentPage;
  const responsePageSize = faqItemsQuery.data?.size ?? FAQ_PAGE_SIZE;
  const totalPages = Math.max(
    1,
    faqItemsQuery.data?.pages ?? Math.ceil(totalRows / responsePageSize),
  );
  const safeCurrentPage = Math.min(Math.max(1, responsePage), totalPages);
  const paginationRange = getPaginationRange({
    totalItems: totalRows,
    currentPage: safeCurrentPage,
    pageSize: responsePageSize,
    currentPageItemCount: faqs.length,
  });

  const editInitial = faqDetailQuery.data ? toFaqItem(faqDetailQuery.data) : editTarget;

  useEffect(() => {
    if (faqItemsQuery.data && currentPage > totalPages) {
      updateParams({ page: totalPages });
    }
  }, [currentPage, faqItemsQuery.data, totalPages]);

  const toFaqItemPayload = (data: FaqSaveDraft) => ({
    category_id: Number(data.categoryId),
    status: FAQ_STATUS_VALUE[data.status],
    locales: data.locales,
  });

  const handleAddSave = async (data: FaqSaveDraft) => {
    try {
      await createFaqItemMutation.mutateAsync(toFaqItemPayload(data));
      setShowForm(null);
      onToast('FAQ가 등록되었습니다', 'success');
    } catch (error) {
      onToast(getApiErrorMessage(error, 'FAQ 등록에 실패했습니다'), 'warning');
      throw error;
    }
  };

  const handleEditSave = async (data: FaqSaveDraft) => {
    if (!editTarget) return;

    try {
      await updateFaqItemMutation.mutateAsync({
        faqId: editTarget.id,
        payload: toFaqItemPayload(data),
      });
      setEditTarget(null);
      setShowForm(null);
      onToast('FAQ가 수정되었습니다', 'success');
    } catch (error) {
      onToast(getApiErrorMessage(error, 'FAQ 수정에 실패했습니다'), 'warning');
      throw error;
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      await deleteFaqItemMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
      onToast('FAQ가 삭제되었습니다', 'success');
    } catch (error) {
      onToast(getApiErrorMessage(error, 'FAQ 삭제에 실패했습니다'), 'warning');
    }
  };

  const handleOpenReorder = async () => {
    try {
      const items = await listAllFaqItemsMutation.mutateAsync();
      setReorderFaqs(items.map((item) => toFaqItem(item)));
      setShowReorder(true);
    } catch (error) {
      onToast(getApiErrorMessage(error, 'FAQ 전체 목록 조회에 실패했습니다'), 'warning');
    }
  };

  const handleReorderSave = async (ordered: FaqItem[]) => {
    try {
      await reorderFaqItemsMutation.mutateAsync({
        ordered_ids: ordered.map((item) => Number(item.id)),
      });
      setShowReorder(false);
      onToast('노출 순서가 저장되었습니다', 'success');
    } catch (error) {
      onToast(getApiErrorMessage(error, '노출 순서 저장에 실패했습니다'), 'warning');
    }
  };

  const toCategory = (category: {
    id: string;
    name: string;
    sort_order: number;
    faq_count: number;
    locales: Record<string, FaqCategoryLocale>;
  }): Category => ({
    id: category.id,
    order: category.sort_order,
    name: category.name,
    names: Object.fromEntries(
      Object.entries(category.locales).map(([code, locale]) => [code, locale.name]),
    ),
    faqCount: category.faq_count,
  });

  const toCategoryLocales = (names: Record<string, string>) =>
    Object.fromEntries(
      Object.entries(names)
        .filter(([, name]) => name.trim().length > 0)
        .map(([code, name]) => [code, { name: name.trim() }]),
    );

  const handleCategoryAdd = async (name: string): Promise<Category> => {
    const trimmed = name.trim();
    const created = await createFaqCategoryMutation.mutateAsync({
      name: trimmed,
      locales: { en: { name: trimmed } },
    });
    return toCategory(created);
  };

  const handleCategoryRename = async (
    categoryId: string,
    languageCode: string,
    name: string,
  ): Promise<Category> => {
    const trimmed = name.trim();
    const category = categories.find((item) => item.id === categoryId);
    const nextNames = {
      ...(category?.names ?? {}),
      [languageCode]: trimmed,
    };
    const updated = await updateFaqCategoryMutation.mutateAsync({
      categoryId,
      payload: {
        ...(languageCode === 'en' ? { name: trimmed } : {}),
        locales: toCategoryLocales({ [languageCode]: nextNames[languageCode] }),
      },
    });
    return toCategory(updated);
  };

  const handleCategoryDelete = async (categoryId: string) => {
    await deleteFaqCategoryMutation.mutateAsync(categoryId);
  };

  const handleCategoryReorder = async (cats: Category[]) => {
    await reorderFaqCategoriesMutation.mutateAsync({
      ordered_ids: cats.map((category) => Number(category.id)),
    });
  };

  const handleCategoryDone = async () => {
    const result = await refetchFaqCategories();
    const nextCategories = result.data ?? [];

    if (
      categoryFilter !== ALL_FILTER &&
      !nextCategories.some((category) => category.id === categoryFilter)
    ) {
      updateParams({ category_id: null });
    }
  };

  const statusBadge = (status: FaqStatus) => {
    const cfg =
      status === '게시중'
        ? { bg: 'rgba(22,163,74,0.1)', color: '#16A34A', border: 'rgba(22,163,74,0.2)' }
        : { bg: 'rgba(113,113,122,0.1)', color: '#71717A', border: 'rgba(113,113,122,0.2)' };
    return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>{status}</span>;
  };

  return (
    <div style={{ padding: 32, background: t.pageBg, minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: t.text, margin: 0, marginBottom: 8 }}>FAQ</h1>
          <p style={{ fontSize: 13, color: t.textSec, margin: 0, lineHeight: 1.6, whiteSpace: 'nowrap' }}>
            자주 묻는 질문을 관리합니다. 노출 순서는 [노출 순서 조정]에서 변경할 수 있으며, 프론트 아코디언에 이 순서대로 노출됩니다.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 24 }}>
          <button type="button" onClick={() => { void refetchFaqCategories(); setShowCategoryModal(true); }} style={{ height: 36, padding: '0 16px', borderRadius: 8, border: `1px solid ${t.border2}`, background: 'transparent', color: t.text, fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            카테고리 관리
          </button>
          <button type="button" onClick={() => { void handleOpenReorder(); }} disabled={isReorderLoading} style={{ height: 36, padding: '0 16px', borderRadius: 8, border: `1px solid ${t.border2}`, background: 'transparent', color: t.text, fontSize: 13, fontWeight: 500, cursor: isReorderLoading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
            {isReorderLoading ? '불러오는 중' : '노출 순서 조정'}
          </button>
          <button type="button" onClick={() => { setEditTarget(null); setShowForm('add'); }} style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: t.accent, color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
            <Plus size={15} />FAQ 등록
          </button>
        </div>
      </div>

      <div style={{ padding: '14px 20px', background: t.surface, borderRadius: 12, border: `1px solid ${t.border}`, marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={statusFilter} onChange={(e) => { updateParams({ status: e.target.value, page: 1 }); }} style={{ height: 36, padding: '0 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.surface2, color: t.text, fontSize: 13, minWidth: 130, cursor: 'pointer' }}>
          <option value={ALL_FILTER}>상태: 전체</option>
          <option value="PUBLISHED">게시중</option>
          <option value="HIDDEN">숨김</option>
        </select>
        <select value={categoryFilter} onChange={(e) => { updateParams({ category_id: e.target.value, page: 1 }); }} style={{ height: 36, padding: '0 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.surface2, color: t.text, fontSize: 13, minWidth: 180, cursor: 'pointer' }}>
          <option value={ALL_FILTER}>카테고리: 전체</option>
          {(isFaqCategoriesLoading || isFaqCategoriesFetching) && <option disabled>카테고리 불러오는 중</option>}
          {isFaqCategoriesError && <option disabled>카테고리 조회 실패</option>}
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: t.textHint, pointerEvents: 'none' }} />
          <input type="text" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); }} placeholder="질문 검색 (EN / KOR)" style={{ width: '100%', height: 36, padding: '0 12px 0 34px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.surface2, color: t.text, fontSize: 13, boxSizing: 'border-box' }} />
        </div>
      </div>

      <DataTable
        columns={[
          { key: 'order', label: '노출 순서', width: '7%' },
          { key: 'category', label: '카테고리', width: '12%' },
          { key: 'question', label: '질문', width: '31%' },
          { key: 'status', label: '상태', width: '9%' },
          { key: 'createdAt', label: '등록일', width: '10%' },
          { key: 'updatedAt', label: '최종 수정일', width: '10%' },
          { key: 'author', label: '작성자', width: '9%' },
          { key: 'actions', label: '관리', width: '12%' },
        ]}
        rows={faqs}
        rowKey={(faq) => faq.id}
        shellStyle={{
          background: t.surface,
          borderRadius: 12,
          border: `1px solid ${t.border}`,
          overflow: 'hidden',
        }}
        tableStyle={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}
        headerRowStyle={{ background: t.surface2, borderBottom: `1px solid ${t.border}` }}
        headerCellStyle={{
          padding: '12px 16px',
          textAlign: 'left',
          fontSize: 11,
          fontWeight: 600,
          color: t.textSec,
          whiteSpace: 'nowrap',
        }}
        rowStyle={(_, index, isHovered) => ({
          borderBottom: index < faqs.length - 1 ? `1px solid ${t.border}` : 'none',
          background: isHovered ? t.surface2 : 'transparent',
        })}
        emptyState={
          <div style={{ padding: 24, textAlign: 'center', color: t.textHint, fontSize: 13 }}>
            FAQ가 없습니다.
          </div>
        }
        isLoading={faqItemsQuery.isLoading || faqItemsQuery.isFetching}
        rowRenderer={(faq) => (
          <>
            <td style={{ padding: '14px 16px', fontSize: 13, color: t.textSec, textAlign: 'center', fontWeight: 600 }}>{faq.order}</td>
            <td style={{ padding: '14px 16px' }}><CatBadge name={faq.category} dark={dark} /></td>
            <td style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
                EN : {faq.question}
              </div>
              <div style={{ fontSize: 11, color: faq.questionKo ? t.textSec : t.textHint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4, marginTop: 3, fontStyle: faq.questionKo ? 'normal' : 'italic' }}>
                KOR : {faq.questionKo || '미입력'}
              </div>
            </td>
            <td style={{ padding: '14px 16px' }}>{statusBadge(faq.status)}</td>
            <td style={{ padding: '14px 16px', fontSize: 12, color: t.textSec, fontFamily: "'DM Mono', monospace" }}>{faq.createdAt}</td>
            <td style={{ padding: '14px 16px', fontSize: 12, color: t.textSec, fontFamily: "'DM Mono', monospace" }}>{faq.updatedAt}</td>
            <td style={{ padding: '14px 16px', fontSize: 13, color: t.textSec }}>{faq.author}</td>
            <td style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={() => { setEditTarget(faq); setShowForm('edit'); }} style={{ height: 30, padding: '0 12px', borderRadius: 6, border: `1px solid ${t.border2}`, background: 'transparent', color: t.text, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                  수정
                </button>
                <button type="button" onClick={() => setDeleteTarget(faq)} style={{ height: 30, padding: '0 12px', borderRadius: 6, border: '1px solid rgba(220,38,38,0.3)', background: 'rgba(220,38,38,0.05)', color: '#DC2626', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                  삭제
                </button>
              </div>
            </td>
          </>
        )}
        footer={
          totalRows > 0 ? (
            <TablePagination
              summary={`전체 ${totalRows.toLocaleString()}개 중 ${paginationRange.start} - ${paginationRange.end}개 표시`}
              items={buildPaginationItems({
                currentPage: safeCurrentPage,
                totalPages,
                onPageChange: (page) => updateParams({ page }),
              })}
              borderColor={t.border}
              textColor={t.textSec}
              activeBackground={t.accent}
              inactiveBackground={t.surface2}
              inactiveBorderColor={t.border}
            />
          ) : null
        }
      />

      {showCategoryModal && <CategoryModal dark={dark} categories={categories} supportedLanguages={supportedLanguages} onClose={() => setShowCategoryModal(false)} onAdd={handleCategoryAdd} onRename={handleCategoryRename} onDelete={handleCategoryDelete} onReorder={handleCategoryReorder} onDone={handleCategoryDone} onToast={onToast} isSaving={isCategorySaving} />}
      {showReorder && <ReorderModal dark={dark} items={reorderFaqs} onClose={() => setShowReorder(false)} onSave={handleReorderSave} isSaving={isReorderSaving} />}
      {showForm === 'add' && <FaqFormModal dark={dark} mode="add" categories={categories} supportedLanguages={supportedLanguages} onClose={() => setShowForm(null)} onSave={handleAddSave} onToast={onToast} isSaving={isFaqSaving} />}
      {showForm === 'edit' && editInitial && <FaqFormModal dark={dark} mode="edit" initial={editInitial} categories={categories} supportedLanguages={supportedLanguages} onClose={() => { setShowForm(null); setEditTarget(null); }} onSave={handleEditSave} onToast={onToast} isSaving={isFaqSaving} />}
      {deleteTarget && <DeleteModal dark={dark} question={deleteTarget.question} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />}
      {toast && <Toast message={toast.message} type={toast.type} dark={dark} onDone={() => setToast(null)} />}
    </div>
  );
}
