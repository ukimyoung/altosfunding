import { useEffect, useMemo, useRef, useState } from 'react';
import { GripVertical, Pin, Plus, Search, X } from 'lucide-react';
import { useSearchParams } from 'react-router';
import {
  DeleteNoticeModal,
  NoticeModal,
  NoticeCategoryOption,
  NoticeSaveDraft,
} from '../../components/notice/NoticeModals';
import {
  TablePagination,
  buildPaginationItems,
  getPaginationRange,
} from '../../components/shared/DataTable';
import {
  useCreateAnnouncementMutation,
  useCreateAnnouncementCategoryMutation,
  useDeleteAnnouncementCategoryMutation,
  useDeleteAnnouncementMutation,
  useAnnouncementQuery,
  useListAnnouncementCategoriesQuery,
  useListAllAnnouncementsMutation,
  useListAnnouncementsQuery,
  useReorderAnnouncementsMutation,
  useReorderAnnouncementCategoriesMutation,
  useUpdateAnnouncementCategoryMutation,
  useUpdateAnnouncementMutation,
} from '../../queries/announcements';
import { useListActiveLanguagesQuery } from '../../queries/languages';
import { SEARCH_DEBOUNCE_MS } from '../../components/shared/TableFilters';
import { Toast } from '../../components/shared/Toast';
import { useAppShell } from '../../layouts/AppShell';
import { tok } from '../../theme/tokens';
import { DEFAULT_LANGUAGES, SupportedLanguage } from '../../types/language';
import { toSupportedLanguages } from '../../utils/supportedLanguages';
import type { AdminAnnouncement, AnnouncementLocale, AnnouncementStatus } from '@/api/announcement';

export type NoticeCategory = string;
export type NoticeStatus = AnnouncementStatus | null;

export interface Notice {
  id: string;
  pinned: boolean;
  categoryId: string;
  category: string;
  sortOrder: number;
  categorySortOrder: number;
  title: string;
  titleKo?: string;
  status: NoticeStatus;
  createdAt: string;
  updatedAt: string;
  author: string;
  content: string;
  contentKo?: string;
  locales: Record<string, AnnouncementLocale>;
}

type ToastState = {
  message: string;
  type: 'success' | 'warning';
};

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

const ALL_FILTER = "전체";
const NOTICE_PAGE_SIZE = 20;

const INITIAL_NOTICE_CATEGORIES: NoticeCategoryOption[] = [
  { id: '1', order: 1, names: { en: 'Rules' } },
  { id: '2', order: 2, names: { en: 'Maintenance' } },
  { id: '3', order: 3, names: { en: 'Policy' } },
  { id: '4', order: 4, names: { en: 'Update' } },
];
const STATUS_OPTIONS: { value: AnnouncementStatus; label: string }[] = [
  { value: 'PUBLISHED', label: "게시중" },
  { value: 'CLOSED', label: "종료" },
];

function isAnnouncementStatus(value: string): value is AnnouncementStatus {
  return STATUS_OPTIONS.some((option) => option.value === value);
}

const parsePageParam = (value: string | null) => {
  const page = Number(value ?? '1');

  return Number.isInteger(page) && page > 0 ? page : 1;
};

function getCategoryConfig(category: string) {
  const configs: Record<string, { bg: string; color: string; border: string }> = {
    Rules: { bg: 'rgba(124,106,247,0.12)', color: '#7C6AF7', border: 'rgba(124,106,247,0.2)' },
    Maintenance: { bg: 'rgba(217,119,6,0.1)', color: '#D97706', border: 'rgba(217,119,6,0.2)' },
    Policy: { bg: 'rgba(22,163,74,0.1)', color: '#16A34A', border: 'rgba(22,163,74,0.2)' },
    Update: { bg: 'rgba(113,113,122,0.1)', color: '#71717A', border: 'rgba(113,113,122,0.2)' },
  };

  return configs[category] ?? configs.Update;
}

function getStatusConfig(status: NoticeStatus) {
  const configs = {
    PUBLISHED: { bg: 'rgba(22,163,74,0.1)', color: '#16A34A', border: 'rgba(22,163,74,0.2)' },
    CLOSED: { bg: 'rgba(113,113,122,0.1)', color: '#71717A', border: 'rgba(113,113,122,0.2)' },
  };

  return status ? configs[status] : configs.CLOSED;
}

function getStatusLabel(status: NoticeStatus) {
  if (!status) return '-';
  return status === 'PUBLISHED' ? "게시중" : "종료";
}

function formatCreatedAt(value: string) {
  if (!value) return '-';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.replace('T', ' ').slice(0, 16);

  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return formatter.format(parsed).replace('T', ' ');
}

const toNotice = (notice: AdminAnnouncement): Notice => ({
  id: notice.id,
  pinned: notice.is_pinned,
  categoryId: notice.category_id,
  category: notice.category,
  sortOrder: notice.sort_order,
  categorySortOrder: notice.category_sort_order,
  title: notice.title,
  titleKo: notice.locales.ko?.title ?? '',
  status: notice.status,
  createdAt: formatCreatedAt(notice.created_at ?? ''),
  updatedAt: formatCreatedAt(notice.updated_at ?? ''),
  author: notice.author ?? '-',
  content: notice.content,
  contentKo: notice.locales.ko?.content ?? '',
  locales: notice.locales,
});

function NoticeCategoryModal({
  dark,
  categories,
  notices,
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
  categories: NoticeCategoryOption[];
  notices: Notice[];
  supportedLanguages: SupportedLanguage[];
  onClose: () => void;
  onAdd: (category: NoticeCategoryOption) => Promise<NoticeCategoryOption>;
  onRename: (category: NoticeCategoryOption) => Promise<NoticeCategoryOption>;
  onDelete: (categoryId: string) => Promise<void>;
  onReorder: (categories: NoticeCategoryOption[]) => Promise<void>;
  onDone: () => Promise<void>;
  onToast: (message: string, type?: ToastState['type']) => void;
  isSaving: boolean;
}) {
  const t = tok(dark);
  const [cats, setCats] = useState<NoticeCategoryOption[]>([...categories]);
  const [selectedLang, setSelectedLang] = useState('en');
  const [newEnName, setNewEnName] = useState('');
  const dragIdx = useRef<number | null>(null);
  const overIdx = useRef<number | null>(null);
  const isEnglish = selectedLang === 'en';

  const usageCount = (categoryName: string) =>
    cats.find((category) => category.names.en === categoryName)?.announcementCount ??
    notices.filter((notice) => notice.category === categoryName).length;

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

    let created: NoticeCategoryOption;
    try {
      created = await onAdd({
        id: `notice-category-${Date.now()}`,
        order: cats.length + 1,
        names: { en: trimmed },
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

  const handleDelete = async (category: NoticeCategoryOption) => {
    if (isSaving) return;
    const englishName = category.names.en ?? '';
    const count = usageCount(englishName);
    if (count > 0) {
      onToast(`이 카테고리를 사용 중인 공지가 ${count}개 있어 삭제할 수 없습니다`, "warning");
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
    category: NoticeCategoryOption,
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
                      공지 {usageCount(englishName)}개
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

function NoticeReorderModal({
  dark,
  items,
  onClose,
  onSave,
  isSaving,
}: {
  dark: boolean;
  items: Notice[];
  onClose: () => void;
  onSave: (ordered: Notice[]) => Promise<void>;
  isSaving: boolean;
}) {
  const t = tok(dark);
  const pinned = items.filter((notice) => notice.pinned);
  const [draggable, setDraggable] = useState(items.filter((notice) => !notice.pinned));
  const dragIdx = useRef<number | null>(null);
  const overIdx = useRef<number | null>(null);
  const hasPinned = pinned.length > 0;

  useEffect(() => {
    setDraggable(items.filter((notice) => !notice.pinned));
  }, [items]);

  const onDragStart = (index: number) => {
    dragIdx.current = index;
  };

  const onDragOver = (event: React.DragEvent, index: number) => {
    event.preventDefault();
    overIdx.current = index;
  };

  const onDrop = () => {
    const from = dragIdx.current;
    const to = overIdx.current;

    dragIdx.current = null;
    overIdx.current = null;

    if (from === null || to === null || from === to) return;

    const next = [...draggable];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setDraggable(next);
  };

  const handleSave = () => {
    if (isSaving) return;
    void onSave([...pinned, ...draggable]);
  };

  return (
    <div
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
          width: 560,
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
            padding: '20px 24px',
            borderBottom: `1px solid ${t.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 700, color: t.text }}>노출 순서 조정</span>
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

        <div style={{ padding: '14px 24px 8px', flexShrink: 0 }}>
          <p style={{ margin: 0, fontSize: 12, color: t.textSec, lineHeight: 1.6 }}>
            카드를 드래그하여 노출 순서를 변경하세요. 변경된 순서는 저장 후 반영됩니다.
          </p>
          {hasPinned && (
            <p style={{ margin: '6px 0 0', fontSize: 11, color: t.textHint, lineHeight: 1.6 }}>
              📌 고정 공지는 순서 변경이 불가합니다. 순서를 바꾸려면 수정 화면에서 고정을 해제한 뒤 다시 조정하세요.
            </p>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 24px 16px' }}>
          {pinned.map((item, index) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                marginBottom: 6,
                background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                borderRadius: 8,
                border: `1px solid ${t.border}`,
                opacity: 0.55,
                cursor: 'not-allowed',
                userSelect: 'none',
              }}
            >
              <GripVertical size={16} style={{ color: t.border2, flexShrink: 0 }} />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: t.textHint,
                  minWidth: 22,
                  flexShrink: 0,
                }}
              >
                {index + 1}
              </span>
              <Pin size={13} color="#7C6AF7" fill="#7C6AF7" style={{ flexShrink: 0 }} />
              <span
                style={{
                  fontSize: 13,
                  color: t.textSec,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                }}
              >
                {item.title}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '2px 7px',
                  borderRadius: 99,
                  background: dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
                  color: t.textHint,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                고정됨 · 변경 불가
              </span>
            </div>
          ))}

          {hasPinned && draggable.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 8px' }}>
              <div style={{ flex: 1, borderTop: `1px dashed ${t.border2}` }} />
              <span style={{ fontSize: 10, color: t.textHint, whiteSpace: 'nowrap' }}>
                순서 변경 가능 항목
              </span>
              <div style={{ flex: 1, borderTop: `1px dashed ${t.border2}` }} />
            </div>
          )}

          {draggable.map((item, index) => (
            <div
              key={item.id}
              draggable
              onDragStart={() => onDragStart(index)}
              onDragOver={(event) => onDragOver(event, index)}
              onDrop={onDrop}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                marginBottom: 6,
                background: t.surface2,
                borderRadius: 8,
                border: `1px solid ${t.border}`,
                cursor: 'grab',
                userSelect: 'none',
              }}
            >
              <GripVertical size={16} style={{ color: t.textHint, flexShrink: 0 }} />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: t.textHint,
                  minWidth: 22,
                  flexShrink: 0,
                }}
              >
                {pinned.length + index + 1}
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: t.text,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                }}
              >
                {item.title}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: t.textHint,
                  flexShrink: 0,
                }}
              >
                {item.category}
              </span>
            </div>
          ))}
          {draggable.length === 0 && !hasPinned && (
            <p style={{ textAlign: 'center', fontSize: 13, color: t.textHint, padding: '24px 0' }}>
              공지가 없습니다.
            </p>
          )}
          {draggable.length === 0 && hasPinned && (
            <p style={{ textAlign: 'center', fontSize: 12, color: t.textHint, padding: '16px 0' }}>
              고정되지 않은 공지가 없습니다.
            </p>
          )}
        </div>

        <div
          style={{
            padding: '16px 24px',
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
            }}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
export function NoticeListPage() {
  const { dark } = useAppShell();
  const t = tok(dark);
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get('category');
  const categoryIdParam = searchParams.get('category_id');
  const statusParam = searchParams.get('status');
  const keywordParam = searchParams.get('keyword') ?? '';
  const currentPage = parsePageParam(searchParams.get('page'));
  const [noticeCategories, setNoticeCategories] = useState<NoticeCategoryOption[]>(
    INITIAL_NOTICE_CATEGORIES,
  );
  const noticeCategoryNames = useMemo(
    () =>
      noticeCategories
        .map((category) => category.names.en?.trim())
        .filter((name): name is string => Boolean(name)),
    [noticeCategories],
  );
  const noticeCategoryIds = useMemo(
    () => noticeCategories.map((category) => category.id),
    [noticeCategories],
  );
  const categoryFilter =
    categoryIdParam && noticeCategoryIds.includes(categoryIdParam) ? categoryIdParam : ALL_FILTER;
  const statusFilter = statusParam && isAnnouncementStatus(statusParam) ? statusParam : ALL_FILTER;
  const [searchQuery, setSearchQuery] = useState(keywordParam);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showReorder, setShowReorder] = useState(false);
  const [noticeOrderIds, setNoticeOrderIds] = useState<string[]>([]);
  const [reorderNotices, setReorderNotices] = useState<Notice[]>([]);
  const [editTarget, setEditTarget] = useState<Notice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Notice | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const updateParams = (updates: Record<string, string | number | null | undefined>) => {
    const next = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      if (!value || value === ALL_FILTER) {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });

    setSearchParams(next, { replace: true });
  };

  const queryParams = useMemo(
    () => ({
      category_id: categoryFilter === ALL_FILTER ? undefined : categoryFilter,
      status: statusFilter === ALL_FILTER ? undefined : (statusFilter as AnnouncementStatus),
      keyword: keywordParam || undefined,
      page: currentPage,
      size: NOTICE_PAGE_SIZE,
    }),
    [categoryFilter, currentPage, keywordParam, statusFilter],
  );

  const announcementsQuery = useListAnnouncementsQuery(queryParams);
  const announcementCategoriesQuery = useListAnnouncementCategoriesQuery();
  const shouldLoadActiveLanguages = showCategoryModal || showAddModal || Boolean(editTarget);
  const activeLanguagesQuery = useListActiveLanguagesQuery(shouldLoadActiveLanguages);
  const announcementDetailQuery = useAnnouncementQuery(editTarget?.id ?? null, Boolean(editTarget));
  const createAnnouncementMutation = useCreateAnnouncementMutation();
  const updateAnnouncementMutation = useUpdateAnnouncementMutation();
  const deleteAnnouncementMutation = useDeleteAnnouncementMutation();
  const listAllAnnouncementsMutation = useListAllAnnouncementsMutation();
  const createAnnouncementCategoryMutation = useCreateAnnouncementCategoryMutation();
  const updateAnnouncementCategoryMutation = useUpdateAnnouncementCategoryMutation();
  const deleteAnnouncementCategoryMutation = useDeleteAnnouncementCategoryMutation();
  const reorderAnnouncementCategoriesMutation = useReorderAnnouncementCategoriesMutation();
  const reorderAnnouncementsMutation = useReorderAnnouncementsMutation();
  const isNoticeCategorySaving =
    createAnnouncementCategoryMutation.isPending ||
    updateAnnouncementCategoryMutation.isPending ||
    deleteAnnouncementCategoryMutation.isPending ||
    reorderAnnouncementCategoriesMutation.isPending;
  const supportedLanguages = useMemo(
    () =>
      activeLanguagesQuery.data
        ? toSupportedLanguages(activeLanguagesQuery.data.items)
        : DEFAULT_LANGUAGES,
    [activeLanguagesQuery.data],
  );

  useEffect(() => {
    if (!announcementCategoriesQuery.data) return;

    setNoticeCategories(
      announcementCategoriesQuery.data
        .map((category) => ({
          id: category.id,
          order: category.sort_order,
          names: Object.fromEntries(
            Object.entries(category.locales).map(([code, locale]) => [code, locale.name]),
          ),
          announcementCount: category.announcement_count,
        }))
        .sort((a, b) => a.order - b.order),
    );
  }, [announcementCategoriesQuery.data]);

  const notices = useMemo<Notice[]>(() => {
    const mapped = (announcementsQuery.data?.items ?? []).map((notice) => toNotice(notice));

    if (noticeOrderIds.length === 0) return mapped;

    const orderMap = new Map(noticeOrderIds.map((id, index) => [id, index]));

    return [...mapped].sort((a, b) => {
      const aOrder = orderMap.get(a.id);
      const bOrder = orderMap.get(b.id);

      if (aOrder === undefined && bOrder === undefined) return 0;
      if (aOrder === undefined) return 1;
      if (bOrder === undefined) return -1;
      return aOrder - bOrder;
    });
  }, [announcementsQuery.data, noticeOrderIds]);

  const totalRows = announcementsQuery.data?.total ?? notices.length;
  const responsePage = announcementsQuery.data?.page ?? currentPage;
  const responsePageSize = announcementsQuery.data?.size ?? NOTICE_PAGE_SIZE;
  const totalPages = Math.max(
    1,
    announcementsQuery.data?.pages ?? Math.ceil(totalRows / responsePageSize),
  );
  const safeCurrentPage = Math.min(Math.max(1, responsePage), totalPages);
  const paginationRange = getPaginationRange({
    totalItems: totalRows,
    currentPage: safeCurrentPage,
    pageSize: responsePageSize,
    currentPageItemCount: notices.length,
  });

  const editInitial = useMemo(() => {
    const detail = announcementDetailQuery.data ? toNotice(announcementDetailQuery.data) : editTarget;
    if (!detail) return null;

    return {
      ...detail,
      category: noticeCategoryIds.includes(detail.categoryId)
        ? detail.category
        : noticeCategoryNames[0] ?? 'Rules',
      categoryId: noticeCategoryIds.includes(detail.categoryId)
        ? detail.categoryId
        : noticeCategories[0]?.id ?? '',
      status: detail.status ?? 'PUBLISHED',
    };
  }, [announcementDetailQuery.data, editTarget, noticeCategories, noticeCategoryIds, noticeCategoryNames]);

  const showToast = (message: string, type: ToastState['type'] = 'success') => {
    setToast({ message, type });
  };

  const resetFilters = () => {
    setSearchQuery('');
    updateParams({ category: null, status: null, keyword: null, page: null });
  };

  const toCategoryLocales = (category: NoticeCategoryOption) =>
    Object.fromEntries(
      Object.entries(category.names)
        .filter(([, name]) => name.trim().length > 0)
        .map(([code, name]) => [code, { name: name.trim() }]),
    );

  const toChangedCategoryLocales = (
    category: NoticeCategoryOption,
    previous?: NoticeCategoryOption,
  ) =>
    Object.fromEntries(
      Object.entries(category.names)
        .filter(([code, name]) => {
          const trimmed = name.trim();
          return trimmed.length > 0 && trimmed !== (previous?.names[code] ?? '').trim();
        })
        .map(([code, name]) => [code, { name: name.trim() }]),
    );

  const toNoticeCategoryOption = (category: {
    id: string;
    sort_order: number;
    locales: Record<string, { name: string }>;
    announcement_count: number;
  }): NoticeCategoryOption => ({
    id: category.id,
    order: category.sort_order,
    names: Object.fromEntries(
      Object.entries(category.locales).map(([code, locale]) => [code, locale.name]),
    ),
    announcementCount: category.announcement_count,
  });

  const handleNoticeCategoryAdd = async (
    category: NoticeCategoryOption,
  ): Promise<NoticeCategoryOption> => {
    const created = await createAnnouncementCategoryMutation.mutateAsync({
      name: category.names.en?.trim(),
      locales: toCategoryLocales(category),
    });
    const next = toNoticeCategoryOption(created);
    setNoticeCategories((prev) => [...prev, next]);
    return next;
  };

  const handleNoticeCategoryRename = async (
    category: NoticeCategoryOption,
  ): Promise<NoticeCategoryOption> => {
    const previous = noticeCategories.find((item) => item.id === category.id);
    const updated = await updateAnnouncementCategoryMutation.mutateAsync({
      categoryId: category.id,
      payload: {
        name: category.names.en?.trim() ?? '',
        locales: toChangedCategoryLocales(category, previous),
      },
    });
    const next = toNoticeCategoryOption(updated);
    setNoticeCategories((prev) => prev.map((item) => (item.id === next.id ? next : item)));
    return next;
  };

  const handleNoticeCategoryDelete = async (categoryId: string) => {
    await deleteAnnouncementCategoryMutation.mutateAsync(categoryId);
    setNoticeCategories((prev) =>
      prev.filter((category) => category.id !== categoryId).map((category, index) => ({ ...category, order: index + 1 })),
    );
    if (categoryFilter === categoryId) {
      updateParams({ category_id: null, page: 1 });
    }
  };

  const handleNoticeCategoryReorder = async (nextCategories: NoticeCategoryOption[]) => {
    const orderedIds = nextCategories
      .map((category) => Number(category.id))
      .filter((id) => Number.isInteger(id));

    if (orderedIds.length === nextCategories.length) {
      await reorderAnnouncementCategoriesMutation.mutateAsync({ ordered_ids: orderedIds });
    }
    setNoticeCategories(nextCategories);
  };

  const handleNoticeCategoryDone = async () => {
    await announcementCategoriesQuery.refetch();
  };

  const handleNoticeReorderSave = async (ordered: Notice[]) => {
    const orderedIds = ordered
      .filter((notice) => !notice.pinned)
      .map((notice) => Number(notice.id))
      .filter((id) => Number.isInteger(id));
    const isCategoryScope = categoryFilter !== ALL_FILTER;

    try {
      await reorderAnnouncementsMutation.mutateAsync({
        ordered_ids: orderedIds,
        scope: isCategoryScope ? 'category' : 'global',
        ...(isCategoryScope ? { category_id: Number(categoryFilter) } : {}),
      });
      setNoticeOrderIds(ordered.map((notice) => notice.id));
      setShowReorder(false);
      showToast("노출 순서가 저장되었습니다", "success");
    } catch (error) {
      showToast(getApiErrorMessage(error, "노출 순서 저장에 실패했습니다"), "warning");
      throw error;
    }
  };

  const handleOpenNoticeReorder = async () => {
    try {
      const items = await listAllAnnouncementsMutation.mutateAsync(
        categoryFilter === ALL_FILTER ? {} : { category_id: categoryFilter },
      );
      setReorderNotices(items.map((notice) => toNotice(notice)));
      setShowReorder(true);
    } catch (error) {
      showToast(getApiErrorMessage(error, "노출 순서 목록을 불러오지 못했습니다"), "warning");
    }
  };

  useEffect(() => {
    const updates: Record<string, null> = {};

    if (categoryParam) {
      updates.category = null;
    }
    if (categoryIdParam && !noticeCategoryIds.includes(categoryIdParam)) {
      updates.category_id = null;
    }
    if (statusParam && !isAnnouncementStatus(statusParam)) {
      updates.status = null;
    }

    if (Object.keys(updates).length > 0) {
      updateParams(updates);
    }
  }, [categoryIdParam, categoryParam, noticeCategoryIds, statusParam]);

  useEffect(() => {
    if (announcementsQuery.data && currentPage > totalPages) {
      updateParams({ page: totalPages });
    }
  }, [announcementsQuery.data, currentPage, totalPages]);

  useEffect(() => {
    setSearchQuery(keywordParam);
  }, [keywordParam]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query === keywordParam) return;

    const timer = window.setTimeout(() => {
      updateParams({ keyword: query || null, page: 1 });
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [keywordParam, searchQuery]);

  const handleAddSave = async (data: NoticeSaveDraft) => {
    try {
      await createAnnouncementMutation.mutateAsync({
        category_id: Number(data.categoryId),
        status: data.status,
        is_pinned: data.pinned,
        locales: data.locales,
      });
      showToast("공지가 등록되었습니다", "success");
    } catch (error) {
      showToast(getApiErrorMessage(error, "공지 등록에 실패했습니다"), "warning");
      throw error;
    }
  };

  const handleEditSave = async (data: NoticeSaveDraft) => {
    if (!editTarget) return;

    try {
      await updateAnnouncementMutation.mutateAsync({
        announcementId: editTarget.id,
        payload: {
          category_id: Number(data.categoryId),
          status: data.status,
          is_pinned: data.pinned,
          locales: data.locales,
        },
      });
      setEditTarget(null);
      showToast("공지가 수정되었습니다", "success");
    } catch (error) {
      showToast(getApiErrorMessage(error, "공지 수정에 실패했습니다"), "warning");
      throw error;
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      await deleteAnnouncementMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
      showToast("공지가 삭제되었습니다", "success");
    } catch (error) {
      showToast(getApiErrorMessage(error, "공지 삭제에 실패했습니다"), "warning");
    }
  };

  const selectStyle: React.CSSProperties = {
    height: 36,
    padding: '0 12px',
    borderRadius: 8,
    border: `1px solid ${t.border}`,
    background: t.surface2,
    color: t.text,
    fontSize: 13,
    minWidth: 150,
    cursor: 'pointer',
  };

  const badgeStyle = (config: ReturnType<typeof getCategoryConfig>): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 8px',
    borderRadius: 9999,
    fontSize: 11,
    fontWeight: 600,
    background: config.bg,
    color: config.color,
    border: `1px solid ${config.border}`,
    whiteSpace: 'nowrap',
  });

  return (
    <div style={{ padding: 32, background: t.pageBg, minHeight: '100vh' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: t.text, margin: 0, marginBottom: 8 }}>
            공지사항
          </h1>
          <p style={{ fontSize: 13, color: t.textSec, margin: 0 }}>
            플랫폼 공지를 등록하고 관리합니다. 고정 공지는 유저 화면 상단에 핀으로 표시됩니다.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setShowCategoryModal(true)}
            style={{
              height: 36,
              padding: '0 16px',
              borderRadius: 8,
              border: `1px solid ${t.border2}`,
              background: 'transparent',
              color: t.text,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            카테고리 관리
          </button>
          <button
            type="button"
            onClick={() => { void handleOpenNoticeReorder(); }}
            disabled={listAllAnnouncementsMutation.isPending}
            style={{
              height: 36,
              padding: '0 16px',
              borderRadius: 8,
              border: `1px solid ${t.border2}`,
              background: 'transparent',
              color: t.text,
              fontSize: 13,
              fontWeight: 500,
              cursor: listAllAnnouncementsMutation.isPending ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            노출 순서 조정
          </button>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            style={{
              height: 36,
              padding: '0 16px',
              borderRadius: 8,
              border: 'none',
              background: t.accent,
              color: '#fff',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              whiteSpace: 'nowrap',
            }}
          >
            <Plus size={16} />
            공지 등록
          </button>
        </div>
      </div>

      <div
        style={{
          padding: '16px 20px',
          background: t.surface,
          borderRadius: 12,
          border: `1px solid ${t.border}`,
          marginBottom: 20,
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <select
          value={categoryFilter}
          onChange={(event) => {
            updateParams({ category_id: event.target.value, page: 1 });
          }}
          style={{ ...selectStyle, minWidth: 180 }}
        >
          <option value={ALL_FILTER}>카테고리: 전체</option>
          {noticeCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.names.en?.trim() || category.id}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(event) => {
            updateParams({ status: event.target.value, page: 1 });
          }}
          style={selectStyle}
        >
          <option value={ALL_FILTER}>상태: 전체</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <Search
            size={15}
            style={{
              position: 'absolute',
              left: 11,
              top: '50%',
              transform: 'translateY(-50%)',
              color: t.textHint,
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
            }}
            placeholder="제목 검색 (EN / KOR)"
            style={{
              width: '100%',
              height: 36,
              padding: '0 12px 0 34px',
              borderRadius: 8,
              border: `1px solid ${t.border}`,
              background: t.surface2,
              color: t.text,
              fontSize: 13,
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
        </div>
        <button
          type="button"
          onClick={resetFilters}
          style={{
            height: 36,
            padding: '0 16px',
            borderRadius: 8,
            border: `1px solid ${t.border}`,
            background: t.surface2,
            color: t.text,
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          초기화
        </button>
      </div>

      <div
        style={{
          background: t.surface,
          borderRadius: 12,
          border: `1px solid ${t.border}`,
          overflow: 'hidden',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              minWidth: 1080,
              borderCollapse: 'collapse',
              tableLayout: 'fixed',
            }}
          >
            <colgroup>
              <col style={{ width: '5%' }} />
              <col style={{ width: '5%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '29%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '15%' }} />
            </colgroup>
            <thead>
              <tr style={{ background: t.surface2, borderBottom: `1px solid ${t.border}` }}>
                {[
                  "번호",
                  "고정",
                  "카테고리",
                  "제목",
                  "상태",
                  "등록일",
                  "최종 수정일",
                  "작성자",
                  "관리",
                ].map((header) => (
                  <th
                    key={header}
                    style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: 11,
                      fontWeight: 600,
                      color: t.textSec,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {notices.map((notice, index) => {
                const categoryConfig = getCategoryConfig(notice.category);
                const statusConfig = getStatusConfig(notice.status);
                const [createdDatePart] = notice.createdAt.split(' ');
                const [updatedDatePart] = notice.updatedAt.split(' ');

                return (
                  <tr
                    key={notice.id}
                    style={{
                      borderBottom: index < notices.length - 1 ? `1px solid ${t.border}` : 'none',
                    }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.background = t.surface2;
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <td style={{ padding: '14px 16px', fontSize: 13, color: t.textSec }}>
                      {notice.id || '-'}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {notice.pinned && <Pin size={15} color={t.accent} fill={t.accent} />}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={badgeStyle(categoryConfig)}>{notice.category || '-'}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: t.text,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          lineHeight: 1.4,
                        }}
                      >
                        EN : {notice.title || '-'}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: notice.titleKo ? t.textSec : t.textHint,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          lineHeight: 1.4,
                          marginTop: 3,
                          fontStyle: notice.titleKo ? 'normal' : 'italic',
                        }}
                      >
                        KOR : {notice.titleKo || "미입력"}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={badgeStyle(statusConfig)}>{getStatusLabel(notice.status)}</span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: 12, color: t.textSec, fontFamily: "'DM Mono', monospace" }}>
                        {createdDatePart}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: 12, color: t.textSec, fontFamily: "'DM Mono', monospace" }}>
                        {updatedDatePart}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: t.textSec }}>
                      {notice.author}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() =>
                            setEditTarget({
                              ...notice,
                              categoryId: noticeCategoryIds.includes(notice.categoryId)
                                ? notice.categoryId
                                : noticeCategories[0]?.id ?? '',
                              category: noticeCategoryIds.includes(notice.categoryId)
                                ? notice.category
                                : noticeCategoryNames[0] ?? 'Rules',
                              status: notice.status ?? 'PUBLISHED',
                            })
                          }
                          style={{
                            height: 30,
                            padding: '0 12px',
                            borderRadius: 6,
                            border: `1px solid ${t.border2}`,
                            background: 'transparent',
                            color: t.text,
                            fontSize: 12,
                            fontWeight: 500,
                            cursor: 'pointer',
                          }}
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(notice)}
                          style={{
                            height: 30,
                            padding: '0 12px',
                            borderRadius: 6,
                            border: '1px solid rgba(220,38,38,0.35)',
                            background: 'rgba(220,38,38,0.06)',
                            color: '#DC2626',
                            fontSize: 12,
                            fontWeight: 500,
                            cursor: 'pointer',
                          }}
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {notices.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    style={{
                      padding: '40px 0',
                      textAlign: 'center',
                      fontSize: 13,
                      color: t.textHint,
                    }}
                  >
                    {announcementsQuery.isLoading
                      ? "공지사항을 불러오는 중입니다."
                      : announcementsQuery.isError
                        ? "공지사항을 불러오지 못했습니다."
                        : "공지사항이 없습니다."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          summary={
            totalRows > 0
              ? `총 ${totalRows.toLocaleString()}개 중 ${paginationRange.start} - ${paginationRange.end}개 표시`
              : "총 0개"
          }
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
      </div>

      {showCategoryModal && (
        <NoticeCategoryModal
          dark={dark}
          categories={noticeCategories}
          notices={notices}
          supportedLanguages={supportedLanguages}
          onClose={() => setShowCategoryModal(false)}
          onAdd={handleNoticeCategoryAdd}
          onRename={handleNoticeCategoryRename}
          onDelete={handleNoticeCategoryDelete}
          onReorder={handleNoticeCategoryReorder}
          onDone={handleNoticeCategoryDone}
          onToast={showToast}
          isSaving={isNoticeCategorySaving}
        />
      )}
      {showReorder && (
        <NoticeReorderModal
          dark={dark}
          items={reorderNotices}
          onClose={() => setShowReorder(false)}
          onSave={handleNoticeReorderSave}
          isSaving={reorderAnnouncementsMutation.isPending}
        />
      )}
      {showAddModal && (
        <NoticeModal
          dark={dark}
          mode="add"
          categories={noticeCategories}
          supportedLanguages={supportedLanguages}
          onClose={() => setShowAddModal(false)}
          onSave={handleAddSave}
          isSaving={createAnnouncementMutation.isPending}
        />
      )}
      {editTarget && editInitial && (
        <NoticeModal
          dark={dark}
          mode="edit"
          initialData={editInitial}
          categories={noticeCategories}
          supportedLanguages={supportedLanguages}
          onClose={() => setEditTarget(null)}
          onSave={handleEditSave}
          isSaving={updateAnnouncementMutation.isPending}
        />
      )}
      {deleteTarget && (
        <DeleteNoticeModal
          dark={dark}
          title={deleteTarget.title}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
          isDeleting={deleteAnnouncementMutation.isPending}
        />
      )}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          dark={dark}
          onDone={() => setToast(null)}
        />
      )}
    </div>
  );
}
