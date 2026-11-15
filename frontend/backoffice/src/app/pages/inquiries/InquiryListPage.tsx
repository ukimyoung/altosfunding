import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import axios from 'axios';
import { Check } from 'lucide-react';
import type {
  AdminContact,
  ContactCategory as ApiContactCategory,
  ContactStatus as ApiContactStatus,
} from '@/api/contact';
import {
  DataTable,
  TablePagination,
  buildPaginationItems,
  buildPaginationSummary,
  getPaginationRange,
} from '../../components/shared/DataTable';
import {
  SEARCH_DEBOUNCE_MS,
  SearchField,
  SelectFilter,
  TableFilterBar,
} from '../../components/shared/TableFilters';
import { Toast } from '../../components/shared/Toast';
import { useAppShell } from '../../layouts/AppShell';
import {
  useContactCategoriesQuery,
  useContactsQuery,
  useContactQuery,
  useCreateContactCategoryMutation,
  useDeleteContactCategoryMutation,
  useReorderContactCategoriesMutation,
  useSendContactReplyMutation,
  useUpdateContactCategoryMutation,
  useUpdateContactDraftMutation,
} from '../../queries/contacts';
import {
  InquiryCategoryModal,
  type InquiryCategoryOption,
} from '../../components/inquiries/InquiryCategoryModal';
import { useListActiveLanguagesQuery } from '../../queries/languages';
import { DEFAULT_LANGUAGES } from '../../types/language';
import { toSupportedLanguages } from '../../utils/supportedLanguages';
import type { AdminContactCategory } from '@/api/contact';
import { formatKstDateTime } from '../../utils/utils';

type ToastState = {
  message: string;
  type: 'success' | 'warning';
} | null;

type ContactApiErrorResponse = {
  error_code?: unknown;
};

const ITEMS_PER_PAGE = 20;

const ALL_CATEGORY_OPTION: { value: '' | ApiContactCategory; label: string } = {
  value: '',
  label: '카테고리: 전체',
};

// 카테고리 목록을 불러오기 전에 쓰는 기본값. 실제 목록은 '카테고리 관리'에서 관리한다.
const DEFAULT_CATEGORY_OPTIONS: { value: ApiContactCategory; label: string }[] = [
  { value: 'billing', label: 'Billing & Payments' },
  { value: 'technical', label: 'Technical Support' },
  { value: 'account', label: 'Account Management' },
  { value: 'verification', label: 'KYC Verification' },
  { value: 'trading', label: 'Trading Questions' },
  { value: 'payout', label: 'Payout Requests' },
  { value: 'general', label: 'General Inquiry' },
];

const STATUS_OPTIONS: { value: '' | ApiContactStatus; label: string }[] = [
  { value: '', label: '상태: 전체' },
  { value: 'RECEIVED', label: '접수' },
  { value: 'PROCESSING', label: '처리중' },
  { value: 'ANSWERED', label: '답변완료' },
];

const EXTRA_CATEGORY_COLORS = [
  { bg: 'rgba(236,72,153,0.1)', color: '#DB2777', border: 'rgba(236,72,153,0.2)' },
  { bg: 'rgba(14,165,233,0.1)', color: '#0284C7', border: 'rgba(14,165,233,0.2)' },
  { bg: 'rgba(132,204,22,0.12)', color: '#65A30D', border: 'rgba(132,204,22,0.25)' },
  { bg: 'rgba(249,115,22,0.1)', color: '#EA580C', border: 'rgba(249,115,22,0.2)' },
];

const toCategoryOption = (category: AdminContactCategory): InquiryCategoryOption => ({
  id: category.id,
  code: category.code,
  order: category.sort_order,
  names: Object.fromEntries(
    Object.entries(category.locales).map(([code, locale]) => [code, locale.name]),
  ),
  contactCount: category.contact_count,
});

const toCategoryLocales = (category: InquiryCategoryOption, previous?: InquiryCategoryOption) =>
  Object.fromEntries(
    Object.entries(category.names)
      .filter(([code, name]) => {
        const trimmed = name.trim();
        return trimmed.length > 0 && trimmed !== (previous?.names[code] ?? '').trim();
      })
      .map(([code, name]) => [code, { name: name.trim() }]),
  );

const STATUS_LABELS: Record<string, string> = {
  RECEIVED: '접수',
  PROCESSING: '처리중',
  ANSWERED: '답변완료',
};

const parsePageParam = (value: string | null) => {
  const page = Number(value ?? '1');

  return Number.isInteger(page) && page > 0 ? page : 1;
};

const getContactApiErrorCode = (error: unknown) => {
  if (!axios.isAxiosError<ContactApiErrorResponse>(error)) {
    return null;
  }

  const errorCode = error.response?.data?.error_code;

  return typeof errorCode === 'string' ? errorCode : null;
};

const getDraftErrorMessage = (error: unknown) => {
  switch (getContactApiErrorCode(error)) {
    case 'contact_already_answered':
      return '이미 답변 완료된 문의입니다.';
    case 'contact_not_found':
      return '문의를 찾을 수 없습니다.';
    default:
      return '임시 저장에 실패했습니다.';
  }
};

const getReplyErrorMessage = (error: unknown) => {
  switch (getContactApiErrorCode(error)) {
    case 'reply_body_required':
      return '답변 내용을 입력하세요.';
    case 'contact_already_answered':
      return '이미 답변 완료된 문의입니다.';
    case 'contact_not_found':
      return '문의를 찾을 수 없습니다.';
    default:
      return '답변 전송에 실패했습니다.';
  }
};

const isContactStatus = (value: string): value is ApiContactStatus =>
  STATUS_OPTIONS.some((status) => status.value === value);

export function InquiryListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { dark } = useAppShell();
  const search = searchParams.get('q') ?? '';
  const categoryParam = searchParams.get('category');
  const statusParam = searchParams.get('status');
  const categoryFilter = categoryParam ?? '';
  const statusFilter = statusParam && isContactStatus(statusParam) ? statusParam : '';
  const currentPage = parsePageParam(searchParams.get('page'));
  const [searchDraft, setSearchDraft] = useState(search);
  const [selectedInquiry, setSelectedInquiry] = useState<AdminContact | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyError, setReplyError] = useState('');
  const [toast, setToast] = useState<ToastState>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const selectedInquiryId = selectedInquiry?.id ?? null;

  const t = {
    surface: dark ? '#0F1829' : '#ffffff',
    surface2: dark ? '#1A2035' : '#F4F5F7',
    border: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)',
    text: dark ? '#E8EAF0' : '#1A1A1A',
    textSec: dark ? '#8B8FA8' : '#4A4A58',
    textHint: dark ? '#5A6080' : '#A0A0AA',
    pageBg: dark ? '#0A0F1E' : '#F4F5F7',
    accent: '#7C6AF7',
  };

  const queryParams = useMemo(
    () => ({
      q: search.trim().length >= 2 ? search.trim() : null,
      category: categoryFilter ? (categoryFilter as ApiContactCategory) : null,
      status: statusFilter ? (statusFilter as ApiContactStatus) : null,
      page: currentPage,
      size: ITEMS_PER_PAGE,
    }),
    [categoryFilter, currentPage, search, statusFilter],
  );
  const inquiriesQuery = useContactsQuery(queryParams);
  const categoriesQuery = useContactCategoriesQuery();
  const activeLanguagesQuery = useListActiveLanguagesQuery(showCategoryModal);
  const createCategoryMutation = useCreateContactCategoryMutation();
  const updateCategoryMutation = useUpdateContactCategoryMutation();
  const deleteCategoryMutation = useDeleteContactCategoryMutation();
  const reorderCategoriesMutation = useReorderContactCategoriesMutation();
  const isCategorySaving =
    createCategoryMutation.isPending ||
    updateCategoryMutation.isPending ||
    deleteCategoryMutation.isPending ||
    reorderCategoriesMutation.isPending;
  const supportedLanguages = useMemo(
    () =>
      activeLanguagesQuery.data
        ? toSupportedLanguages(activeLanguagesQuery.data.items)
        : DEFAULT_LANGUAGES,
    [activeLanguagesQuery.data],
  );
  const categoryOptions = useMemo(
    () => (categoriesQuery.data ?? []).map(toCategoryOption),
    [categoriesQuery.data],
  );
  const categoryFilterOptions = useMemo(
    () => [
      ALL_CATEGORY_OPTION,
      ...(categoriesQuery.data
        ? categoriesQuery.data.map((category) => ({ value: category.code, label: category.name }))
        : DEFAULT_CATEGORY_OPTIONS),
    ],
    [categoriesQuery.data],
  );
  const categoryLabels = useMemo(
    () =>
      Object.fromEntries(
        categoryFilterOptions.filter((option) => option.value).map((option) => [option.value, option.label]),
      ) as Record<string, string>,
    [categoryFilterOptions],
  );
  const inquiryDetailQuery = useContactQuery(selectedInquiryId);
  const updateDraftMutation = useUpdateContactDraftMutation();
  const sendReplyMutation = useSendContactReplyMutation();
  const rows = inquiriesQuery.data?.items ?? [];
  const totalRows = inquiriesQuery.data?.total ?? rows.length;
  const responsePageSize = inquiriesQuery.data?.size ?? ITEMS_PER_PAGE;
  const totalPages = Math.max(1, inquiriesQuery.data?.pages ?? 1);
  const responsePage =
    !inquiriesQuery.isPlaceholderData && inquiriesQuery.data ? inquiriesQuery.data.page : currentPage;
  const safeCurrentPage = Math.min(Math.max(1, responsePage), totalPages);
  const paginationRange = getPaginationRange({
    totalItems: totalRows,
    currentPage: safeCurrentPage,
    pageSize: responsePageSize,
    currentPageItemCount: rows.length,
  });

  const updateParams = (updates: Record<string, string | number | null | undefined>) => {
    const next = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });

    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    const updates: Record<string, null> = {};

    if (
      categoryParam &&
      categoriesQuery.data &&
      !categoriesQuery.data.some((category) => category.code === categoryParam)
    ) {
      updates.category = null;
    }
    if (statusParam && !isContactStatus(statusParam)) {
      updates.status = null;
    }

    if (Object.keys(updates).length > 0) {
      updateParams(updates);
    }
  }, [categoryParam, categoriesQuery.data, statusParam]);

  useEffect(() => {
    if (inquiriesQuery.data && !inquiriesQuery.isPlaceholderData && currentPage !== safeCurrentPage) {
      updateParams({ page: safeCurrentPage });
    }
  }, [currentPage, inquiriesQuery.data, inquiriesQuery.isPlaceholderData, safeCurrentPage]);

  useEffect(() => {
    setSearchDraft(search);
  }, [search]);

  useEffect(() => {
    const query = searchDraft.trim();
    if (query === search) return;

    const timer = window.setTimeout(() => {
      updateParams({ q: query.length >= 2 ? query : null, page: 1 });
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [searchDraft, search]);

  useEffect(() => {
    if (!inquiryDetailQuery.data) return;

    setReplyText(inquiryDetailQuery.data.reply_body ?? inquiryDetailQuery.data.reply_draft ?? '');
  }, [inquiryDetailQuery.data]);

  const getCategoryConfig = (category: AdminContact['category']) => {
    const configs: Record<string, { bg: string; color: string; border: string }> = {
      billing: {
        bg: 'rgba(59,130,246,0.1)',
        color: '#3B82F6',
        border: 'rgba(59,130,246,0.2)',
      },
      technical: {
        bg: 'rgba(22,163,74,0.1)',
        color: '#16A34A',
        border: 'rgba(22,163,74,0.2)',
      },
      account: {
        bg: 'rgba(124,106,247,0.12)',
        color: '#7C6AF7',
        border: 'rgba(124,106,247,0.2)',
      },
      verification: {
        bg: 'rgba(217,119,6,0.1)',
        color: '#D97706',
        border: 'rgba(217,119,6,0.2)',
      },
      trading: {
        bg: 'rgba(20,184,166,0.1)',
        color: '#0D9488',
        border: 'rgba(20,184,166,0.2)',
      },
      payout: {
        bg: 'rgba(220,38,38,0.08)',
        color: '#DC2626',
        border: 'rgba(220,38,38,0.2)',
      },
      general: {
        bg: 'rgba(113,113,122,0.1)',
        color: '#71717A',
        border: 'rgba(113,113,122,0.2)',
      },
    };

    const known = configs[category ?? ''];
    if (known) return known;
    const index = categoriesQuery.data?.findIndex((item) => item.code === category) ?? -1;
    return index >= 0 ? EXTRA_CATEGORY_COLORS[index % EXTRA_CATEGORY_COLORS.length] : configs.general;
  };

  const getStatusConfig = (status: AdminContact['status']) => {
    switch (status) {
      case 'RECEIVED':
        return { bg: 'rgba(217,119,6,0.1)', color: '#D97706', border: 'rgba(217,119,6,0.2)' };
      case 'PROCESSING':
        return { bg: 'rgba(59,130,246,0.1)', color: '#3B82F6', border: 'rgba(59,130,246,0.2)' };
      case 'ANSWERED':
        return { bg: 'rgba(22,163,74,0.1)', color: '#16A34A', border: 'rgba(22,163,74,0.2)' };
      default:
        return { bg: 'rgba(113,113,122,0.1)', color: '#71717A', border: 'rgba(113,113,122,0.2)' };
    }
  };

  const handleOpenInquiry = (inquiry: AdminContact) => {
    setSelectedInquiry(inquiry);
    setReplyText('');
    setReplyError('');
  };

  const handleSaveDraft = async () => {
    if (!selectedInquiryId) return;
    const nextReplyText = replyText.trim();

    try {
      await updateDraftMutation.mutateAsync({
        contactId: selectedInquiryId,
        payload: { reply_draft: nextReplyText },
      });
      setToast({ message: '임시 저장되었습니다', type: 'success' });
      setReplyError('');
    } catch (error) {
      setToast({ message: getDraftErrorMessage(error), type: 'warning' });
    }
  };

  const handleSendReply = async () => {
    if (!selectedInquiryId) return;
    const nextReplyText = replyText.trim();

    if (!nextReplyText) {
      setReplyError('답변 내용을 입력하세요.');
      return;
    }

    try {
      await sendReplyMutation.mutateAsync({
        contactId: selectedInquiryId,
        payload: { reply_body: nextReplyText },
      });
      setToast({ message: '답변이 전송되었습니다', type: 'success' });
      setSelectedInquiry(null);
      setReplyText('');
      setReplyError('');
    } catch (error) {
      const message = getReplyErrorMessage(error);

      if (getContactApiErrorCode(error) === 'reply_body_required') {
        setReplyError(message);
      }

      setToast({ message, type: 'warning' });
    }
  };

  const inquiryDetail = inquiryDetailQuery.data;
  const modalInquiry = inquiryDetail ?? selectedInquiry;
  const modalStatus = modalInquiry?.status ?? selectedInquiry?.status;
  const modalCreatedAt = modalInquiry?.created_at ?? selectedInquiry?.created_at ?? '';
  const modalRepliedAt = inquiryDetail?.replied_at ?? '';
  const isReplyActionPending = updateDraftMutation.isPending || sendReplyMutation.isPending;

  return (
    <div style={{ padding: 32, background: t.pageBg, minHeight: '100vh' }}>
      <div
        style={{
          marginBottom: 24,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: t.text, margin: 0, marginBottom: 8 }}>
            문의하기
          </h1>
          <p style={{ fontSize: 13, color: t.textSec, margin: 0 }}>
            유저 문의를 조회하고 답변합니다. 작성한 답변은 유저가 등록한 이메일로 발송됩니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCategoryModal(true)}
          style={{
            height: 36,
            padding: '0 16px',
            borderRadius: 8,
            border: `1px solid ${t.border}`,
            background: 'transparent',
            color: t.text,
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          카테고리 관리
        </button>
      </div>

      <TableFilterBar
        background={t.surface}
        borderColor={t.border}
        containerStyle={{ marginBottom: 20, padding: '16px 20px' }}
      >
        <SelectFilter
          value={categoryFilter}
          onChange={(value) => updateParams({ category: value, page: 1 })}
          width={180}
          background={t.surface2}
          borderColor={t.border}
          textColor={t.text}
          iconColor={t.text}
          options={categoryFilterOptions}
        />

        <SelectFilter
          value={statusFilter}
          onChange={(value) => updateParams({ status: value, page: 1 })}
          width={140}
          background={t.surface2}
          borderColor={t.border}
          textColor={t.text}
          iconColor={t.text}
          options={STATUS_OPTIONS}
        />

        <SearchField
          value={searchDraft}
          onChange={setSearchDraft}
          placeholder="유저명 또는 제목 검색"
          minWidth={260}
          height={36}
          background={t.surface2}
          borderColor={t.border}
          textColor={t.text}
          iconColor={t.textHint}
        />
      </TableFilterBar>

      <DataTable
        columns={[
          { key: 'user', label: '유저' },
          { key: 'title', label: '제목' },
          { key: 'category', label: '카테고리' },
          { key: 'status', label: '상태' },
          { key: 'createdAt', label: '접수일' },
          { key: 'actions', label: '관리' },
        ]}
        rows={rows}
        isLoading={inquiriesQuery.isLoading}
        rowKey={(inquiry) => inquiry.id}
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
        rowStyle={(_, index) => ({
          borderBottom: index < rows.length - 1 ? `1px solid ${t.border}` : 'none',
        })}
        emptyState={
          <div style={{ padding: 24, textAlign: 'center', color: t.textHint, fontSize: 13 }}>
            {inquiriesQuery.isLoading
              ? '문의 목록을 불러오는 중입니다.'
              : inquiriesQuery.isError
                ? '문의 목록을 불러오지 못했습니다.'
                : '조회 결과가 없습니다.'}
          </div>
        }
        rowRenderer={(inquiry) => {
          const categoryConfig = getCategoryConfig(inquiry.category);
          const statusConfig = getStatusConfig(inquiry.status);
          const categoryLabel = categoryLabels[inquiry.category ?? ''] ?? inquiry.category ?? '-';
          const statusLabel = STATUS_LABELS[inquiry.status] ?? inquiry.status;

          return (
            <>
              <td style={{ padding: '16px' }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: t.text,
                    marginBottom: 2,
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word',
                  }}
                >
                  {inquiry.name || '-'}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: t.textHint,
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word',
                  }}
                >
                  {inquiry.email || '-'}
                </div>
              </td>
              <td
                style={{
                  padding: '16px',
                  fontSize: 13,
                  fontWeight: 500,
                  color: t.text,
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word',
                }}
              >
                {inquiry.subject || '-'}
              </td>
              <td style={{ padding: '16px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '4px 10px',
                    borderRadius: 9999,
                    fontSize: 11,
                    fontWeight: 600,
                    background: categoryConfig.bg,
                    color: categoryConfig.color,
                    border: `1px solid ${categoryConfig.border}`,
                  }}
                >
                  {categoryLabel}
                </span>
              </td>
              <td style={{ padding: '16px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '4px 10px',
                    borderRadius: 9999,
                    fontSize: 11,
                    fontWeight: 600,
                    background: statusConfig.bg,
                    color: statusConfig.color,
                    border: `1px solid ${statusConfig.border}`,
                  }}
                >
                  {statusLabel}
                </span>
              </td>
              <td
                style={{
                  padding: '16px',
                  fontSize: 12,
                  color: t.textSec,
                  fontFamily: "'DM Mono', monospace",
                  whiteSpace: 'nowrap',
                }}
              >
                {formatKstDateTime(inquiry.created_at)} (GMT +9)
              </td>
              <td style={{ padding: '16px' }}>
                <button
                  type="button"
                  onClick={() => handleOpenInquiry(inquiry)}
                  style={{
                    height: 32,
                    padding: '0 12px',
                    borderRadius: 6,
                    border: `1px solid ${t.border}`,
                    background: t.surface2,
                    color: t.text,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  {inquiry.status === 'ANSWERED' ? '보기' : '답변'}
                </button>
              </td>
            </>
          );
        }}
        footer={
          totalRows > 0 ? (
            <TablePagination
              summary={buildPaginationSummary({
                totalItems: totalRows,
                start: paginationRange.start,
                end: paginationRange.end,
              })}
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

      {selectedInquiry && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => {
            setSelectedInquiry(null);
            setReplyError('');
          }}
        >
          <div
            style={{
              background: t.surface,
              borderRadius: 12,
              width: 640,
              maxHeight: '80vh',
              overflow: 'auto',
              border: `1px solid ${t.border}`,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ padding: 24, borderBottom: `1px solid ${t.border}` }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 4 }}>
                문의 내용
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: t.textSec,
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word',
                }}
              >
                {modalInquiry?.name || '-'} · {modalCreatedAt ? formatKstDateTime(modalCreatedAt) : '-'}
              </div>
            </div>

            <div style={{ padding: 24, borderBottom: `1px solid ${t.border}` }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: t.text,
                  marginBottom: 12,
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word',
                }}
              >
                {modalInquiry?.subject || '-'}
              </div>
              <div
                style={{
                  padding: 16,
                  background: t.surface2,
                  borderRadius: 8,
                  fontSize: 13,
                  color: t.text,
                  lineHeight: 1.6,
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {inquiryDetailQuery.isLoading
                  ? '문의 내용을 불러오는 중입니다.'
                  : inquiryDetailQuery.isError
                    ? '문의 내용을 불러오지 못했습니다.'
                    : inquiryDetail?.message || '-'}
              </div>
            </div>

            <div style={{ padding: 24 }}>
              {modalStatus === 'ANSWERED' ? (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Check size={15} strokeWidth={2.5} style={{ color: '#16A34A' }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#16A34A' }}>
                        답변 완료
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        color: t.textHint,
                        overflowWrap: 'anywhere',
                        wordBreak: 'break-word',
                        textAlign: 'right',
                      }}
                    >
                      답변 완료일: {modalRepliedAt ? formatKstDateTime(modalRepliedAt) : '—'} (GMT+9)
                    </span>
                  </div>
                  <div
                    style={{
                      padding: 14,
                      background: t.surface2,
                      borderRadius: 8,
                      fontSize: 13,
                      color: t.text,
                      lineHeight: 1.7,
                      overflowWrap: 'anywhere',
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {inquiryDetail?.reply_body || '-'}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 8 }}>
                    답변 작성
                  </div>
                  <textarea
                    value={replyText}
                    onChange={(event) => {
                      setReplyText(event.target.value);
                      if (replyError) setReplyError('');
                    }}
                    placeholder="답변 내용을 입력하세요"
                    style={{
                      width: '100%',
                      minHeight: 160,
                      padding: 12,
                      borderRadius: 8,
                      border: `1px solid ${t.border}`,
                      background: t.surface,
                      color: t.text,
                      fontSize: 13,
                      lineHeight: 1.6,
                      resize: 'vertical',
                      boxSizing: 'border-box',
                      overflowWrap: 'anywhere',
                      wordBreak: 'break-word',
                    }}
                  />
                  {replyError && (
                    <div style={{ marginTop: 8, fontSize: 12, color: '#DC2626' }}>{replyError}</div>
                  )}
                </>
              )}
            </div>

            <div
              style={{
                padding: '16px 24px',
                borderTop: `1px solid ${t.border}`,
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 12,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setSelectedInquiry(null);
                  setReplyError('');
                }}
                style={{
                  height: 36,
                  padding: '0 16px',
                  borderRadius: 8,
                  border: `1px solid ${t.border}`,
                  background: 'transparent',
                  color: t.text,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                닫기
              </button>
              {modalStatus !== 'ANSWERED' && (
                <>
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={isReplyActionPending}
                    style={{
                      height: 36,
                      padding: '0 16px',
                      borderRadius: 8,
                      border: `1px solid ${t.border}`,
                      background: t.surface2,
                      color: t.text,
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: isReplyActionPending ? 'not-allowed' : 'pointer',
                      opacity: isReplyActionPending ? 0.6 : 1,
                    }}
                  >
                    임시저장
                  </button>
                  <button
                    type="button"
                    onClick={handleSendReply}
                    disabled={isReplyActionPending}
                    style={{
                      height: 36,
                      padding: '0 16px',
                      borderRadius: 8,
                      border: 'none',
                      background: t.accent,
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: isReplyActionPending ? 'not-allowed' : 'pointer',
                      opacity: isReplyActionPending ? 0.6 : 1,
                    }}
                  >
                    답변 전송
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showCategoryModal && (
        <InquiryCategoryModal
          dark={dark}
          categories={categoryOptions}
          supportedLanguages={supportedLanguages}
          onClose={() => setShowCategoryModal(false)}
          onAdd={async (category) =>
            toCategoryOption(
              await createCategoryMutation.mutateAsync({
                name: category.names.en?.trim(),
                locales: toCategoryLocales(category),
              }),
            )
          }
          onRename={async (category) =>
            toCategoryOption(
              await updateCategoryMutation.mutateAsync({
                categoryId: category.id,
                payload: {
                  name: category.names.en?.trim() ?? '',
                  locales: toCategoryLocales(
                    category,
                    categoryOptions.find((item) => item.id === category.id),
                  ),
                },
              }),
            )
          }
          onDelete={async (categoryId) => {
            const deleted = categoryOptions.find((item) => item.id === categoryId);
            await deleteCategoryMutation.mutateAsync(categoryId);
            if (deleted && categoryFilter === deleted.code) {
              updateParams({ category: null, page: 1 });
            }
          }}
          onReorder={async (next) => {
            await reorderCategoriesMutation.mutateAsync(next.map((item) => Number(item.id)));
          }}
          onDone={async () => {
            await categoriesQuery.refetch();
          }}
          onToast={(message, type = 'success') => setToast({ message, type })}
          isSaving={isCategorySaving}
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
