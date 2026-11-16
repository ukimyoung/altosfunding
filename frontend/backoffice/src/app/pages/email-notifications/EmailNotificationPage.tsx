import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Eye } from 'lucide-react';
import { useSearchParams } from 'react-router';
import {
  EmailTemplateEditor,
  EmailTemplateEditorHandle,
} from '../../components/EmailTemplateEditor';
import { Toast } from '../../components/shared/Toast';
import { useAppShell } from '../../layouts/AppShell';
import {
  useCreateEventTemplateMutation,
  useGetEventTemplateDetailQuery,
  useListEventTemplatesQuery,
  useListEventTypesQuery,
  useListNotificationLogsQuery,
  usePreviewEventTemplateMutation,
  useUpdateEventTemplateMutation,
} from '../../queries/eventTemplates';
import {
  TablePagination,
  buildPaginationItems,
  buildPaginationSummary,
  getPaginationRange,
} from '../../components/shared/DataTable';
import { formatKstDateTime } from '../../utils/utils';
import { AddTemplateModal } from '../../components/email-notifications/AddTemplateModal';
import type { AddTemplateDraft } from '../../components/email-notifications/AddTemplateModal';
import { ManualDispatchTab } from '../../components/email-notifications/ManualDispatchTab';
import { useSearchManualEmailUnsubscribedRecipientsMutation } from '../../queries/manualEmail';
import type { ManualEmailGrade, ManualEmailRecipientPreview } from '../../../api/manualEmail';

type TabType = 'templates' | 'history' | 'dispatch' | 'unsub';
const HISTORY_PAGE_SIZE = 20;
const UNSUBSCRIBE_PAGE_SIZE = 20;
type SendTiming = '즉시 발송' | '지연 발송';
type EditLocale = 'en' | 'ko';
type LocaleDrafts = Record<EditLocale, { subject: string; html: string }>;
const EDIT_LOCALES: { value: EditLocale; label: string }[] = [
  { value: 'en', label: 'EN (영어)' },
  { value: 'ko', label: 'KO (한국어)' },
];
const EMPTY_DRAFTS: LocaleDrafts = { en: { subject: '', html: '' }, ko: { subject: '', html: '' } };

const isBlankHtml = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() === '';

const getTemplateApiErrorMessage = (error: unknown, fallback: string) => {
  if (!axios.isAxiosError<{ message?: string; error_code?: string }>(error)) return fallback;
  const code = error.response?.data?.error_code;
  if (code === 'template_id_exists') return '이미 있는 템플릿 코드입니다.';
  if (code === 'validation_error' || error.response?.status === 422) return '입력값을 확인해 주세요.';
  return error.response?.data?.message || fallback;
};

const parsePageParam = (value: string | null) => {
  const page = Number(value ?? '1');

  return Number.isInteger(page) && page > 0 ? page : 1;
};

interface TemplateListItemProps {
  name: string;
  subtitle?: string;
  selected: boolean;
  t: any;
  onSelect: () => void;
  // onDelete: (e: React.MouseEvent) => void;
}

function TemplateListItem({ name, subtitle, selected, t, onSelect }: TemplateListItemProps) {
  // const [deleteHovered, setDeleteHovered] = useState(false);

  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 10px 10px 12px',
        background: selected ? t.accentBg : 'transparent',
        borderTop: 'none',
        borderRight: 'none',
        borderBottom: 'none',
        borderLeft: selected ? `3px solid ${t.accent}` : '3px solid transparent',
        borderRadius: 6,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: selected ? 600 : 500,
            color: selected ? t.text : t.textSec,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: 10,
              color: t.textHint,
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
      {/*
      <button
        onClick={onDelete}
        onMouseEnter={() => setDeleteHovered(true)}
        onMouseLeave={() => setDeleteHovered(false)}
        style={{
          flexShrink: 0,
          width: 20,
          height: 20,
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: 13,
          color: deleteHovered ? "#DC2626" : t.textHint,
          opacity: deleteHovered ? 1 : 0.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "color 0.15s, opacity 0.15s",
          padding: 0,
          marginLeft: 4,
        }}
      >
        ×
      </button>
      */}
    </div>
  );
}

function UnsubscribeTab({ t }: { t: Record<string, string> }) {
  const searchMutation = useSearchManualEmailUnsubscribedRecipientsMutation();
  const [emailQ, setEmailQ] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [typeFilter, setTypeFilter] = useState<'전체' | '일반' | 'VIP'>('전체');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(UNSUBSCRIBE_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [unsubscribedCount, setUnsubscribedCount] = useState(0);
  const [items, setItems] = useState<ManualEmailRecipientPreview[]>([]);
  const inputStyle: React.CSSProperties = {
    height: 38,
    padding: '0 12px',
    borderRadius: 8,
    border: `1px solid ${t.border2}`,
    background: t.surface2,
    color: t.text,
    fontSize: 13,
    outline: 'none',
    fontFamily: "'Inter','DM Sans','Noto Sans KR',sans-serif",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: t.textSec,
    marginBottom: 6,
    display: 'block',
    fontFamily: "'Inter','DM Sans','Noto Sans KR',sans-serif",
  };
  const headers = ['이름', '이메일', '수신거부 일시', '회원 타입'];
  const toGrade = (): ManualEmailGrade => {
    if (typeFilter === '일반') return 'NORMAL';
    if (typeFilter === 'VIP') return 'VIP';
    return 'ALL';
  };
  const applyResponse = (response: Awaited<ReturnType<typeof searchMutation.mutateAsync>>) => {
    setItems(response.items ?? []);
    setTotal(response.total ?? 0);
    setUnsubscribedCount(response.unsubscribed_count ?? 0);
    setPage(response.page ?? 1);
    setPageSize(response.page_size ?? UNSUBSCRIBE_PAGE_SIZE);
    setTotalPages(Math.max(1, response.total_pages ?? 1));
  };
  const resetResponse = () => {
    setItems([]);
    setTotal(0);
    setUnsubscribedCount(0);
    setPage(1);
    setPageSize(UNSUBSCRIBE_PAGE_SIZE);
    setTotalPages(1);
  };
  const runFilter = async (nextPage = 1) => {
    try {
      const response = await searchMutation.mutateAsync({
        ...(emailQ.trim() ? { email: emailQ.trim() } : {}),
        ...(dateFrom ? { unsubscribed_from: dateFrom } : {}),
        ...(dateTo ? { unsubscribed_to: dateTo } : {}),
        grade: toGrade(),
        page: nextPage,
        page_size: UNSUBSCRIBE_PAGE_SIZE,
      });

      applyResponse(response);
    } catch {
      resetResponse();
    }
  };
  const resetFilter = async () => {
    setEmailQ('');
    setDateFrom('');
    setDateTo('');
    setTypeFilter('전체');

    try {
      const response = await searchMutation.mutateAsync({
        grade: 'ALL',
        page: 1,
        page_size: UNSUBSCRIBE_PAGE_SIZE,
      });

      applyResponse(response);
    } catch {
      resetResponse();
    }
  };
  const formatMemberType = (grade: string) => (grade === 'VIP' ? 'VIP' : '일반');
  const start = items.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = items.length === 0 ? 0 : start + items.length - 1;

  useEffect(() => {
    void runFilter(1);
  }, []);

  return (
    <div
      style={{
        padding: '0 24px 40px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        fontFamily: "'Inter','DM Sans','Noto Sans KR',sans-serif",
      }}
    >
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 24px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 3, height: 18, borderRadius: 2, background: t.accent, flexShrink: 0 }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>수신거부 목록</span>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 13, color: t.textSec, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>현재 수신거부 처리된 회원 목록입니다. 마케팅 메일 발송 시 자동으로 제외됩니다.</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 12, background: 'rgba(220,38,38,0.08)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.18)' }}>
              {unsubscribedCount.toLocaleString()}명
            </span>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={labelStyle}>이메일 검색</label>
              <input
                type="text"
                value={emailQ}
                onChange={(event) => setEmailQ(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void runFilter(1);
                }}
                placeholder="이메일 검색"
                style={{ ...inputStyle, width: 200 }}
              />
            </div>
            <div>
              <label style={labelStyle}>수신거부 일시</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} style={{ ...inputStyle, width: 140 }} />
                <span style={{ color: t.textHint, fontSize: 13 }}>~</span>
                <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} style={{ ...inputStyle, width: 140 }} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>회원 타입</label>
              <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: `1px solid ${t.border2}` }}>
                {(['전체', '일반', 'VIP'] as const).map((option, index) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setTypeFilter(option)}
                    style={{
                      height: 38,
                      padding: '0 16px',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 500,
                      border: 'none',
                      borderLeft: index > 0 ? `1px solid ${t.border2}` : 'none',
                      background: typeFilter === option ? t.accentBg : t.surface2,
                      color: typeFilter === option ? t.accent : t.textSec,
                      fontFamily: "'Inter','DM Sans','Noto Sans KR',sans-serif",
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
              <button type="button" onClick={() => runFilter(1)} style={{ height: 38, padding: '0 20px', borderRadius: 8, cursor: 'pointer', border: 'none', background: t.accent, color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: "'Inter','DM Sans','Noto Sans KR',sans-serif", whiteSpace: 'nowrap' }}>
                조회
              </button>
              <button type="button" onClick={resetFilter} style={{ height: 38, padding: '0 16px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${t.border2}`, background: t.surface2, color: t.textSec, fontSize: 13, fontWeight: 500, fontFamily: "'Inter','DM Sans','Noto Sans KR',sans-serif", whiteSpace: 'nowrap' }}>
                초기화
              </button>
            </div>
          </div>

          <div style={{ fontSize: 12, color: t.textHint }}>
            총 {total.toLocaleString()}개 중 {start}–{end}개 표시
          </div>
          <div style={{ border: `1px solid ${t.border2}`, borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <colgroup>
                <col style={{ width: '28%' }} />
                <col style={{ width: '30%' }} />
                <col style={{ width: '22%' }} />
                <col style={{ width: '20%' }} />
              </colgroup>
              <thead>
                <tr>
                  {headers.map((header) => (
                    <th key={header} style={{ padding: '9px 14px', fontSize: 11, fontWeight: 700, color: t.textSec, textAlign: 'left', whiteSpace: 'nowrap', background: t.surface3, borderBottom: `1px solid ${t.border2}`, letterSpacing: '0.05em' }}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '32px 14px', textAlign: 'center', fontSize: 13, color: t.textHint }}>
                      검색 결과가 없습니다.
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => (
                    <tr key={item.user_id ?? item.email} style={{ background: index % 2 === 0 ? 'transparent' : t.surface2 }}>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: t.text, borderBottom: `1px solid ${t.border}` }}>{item.user_name ?? '-'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: t.textSec, borderBottom: `1px solid ${t.border}` }}>{item.email}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: t.textSec, borderBottom: `1px solid ${t.border}`, whiteSpace: 'nowrap' }}>
                        {item.newsletter_unsubscribed_at
                          ? formatKstDateTime(item.newsletter_unsubscribed_at)
                          : '-'}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: t.textSec, borderBottom: `1px solid ${t.border}` }}>
                        {formatMemberType(item.grade) === 'VIP' ? (
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: 'rgba(234,179,8,0.12)', color: '#EAB308', border: '1px solid rgba(234,179,8,0.25)', whiteSpace: 'nowrap' }}>VIP</span>
                        ) : (
                          <span>{formatMemberType(item.grade)}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
              <button type="button" onClick={() => runFilter(Math.max(1, page - 1))} disabled={page === 1} style={{ height: 32, padding: '0 12px', borderRadius: 6, border: `1px solid ${t.border2}`, background: t.surface2, color: page === 1 ? t.textHint : t.text, fontSize: 12, cursor: page === 1 ? 'not-allowed' : 'pointer', fontFamily: "'Inter',sans-serif" }}>이전</button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                <button key={pageNumber} type="button" onClick={() => runFilter(pageNumber)} style={{ height: 32, minWidth: 32, padding: '0 8px', borderRadius: 6, border: `1px solid ${pageNumber === page ? t.accent : t.border2}`, background: pageNumber === page ? t.accentBg : t.surface2, color: pageNumber === page ? t.accent : t.textSec, fontSize: 12, fontWeight: pageNumber === page ? 700 : 400, cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>
                  {pageNumber}
                </button>
              ))}
              <button type="button" onClick={() => runFilter(Math.min(totalPages, page + 1))} disabled={page === totalPages} style={{ height: 32, padding: '0 12px', borderRadius: 6, border: `1px solid ${t.border2}`, background: t.surface2, color: page === totalPages ? t.textHint : t.text, fontSize: 12, cursor: page === totalPages ? 'not-allowed' : 'pointer', fontFamily: "'Inter',sans-serif" }}>다음</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function EmailNotificationPage() {
  const { dark } = useAppShell();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: eventTemplateList, refetch: refetchEventTemplates } = useListEventTemplatesQuery();
  const editorRef = useRef<EmailTemplateEditorHandle>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);
  const tabParam = searchParams.get('tab');
  const activeTab: TabType =
    tabParam === 'history' || tabParam === 'dispatch' || tabParam === 'unsub'
      ? tabParam
      : 'templates';
  const [selectedEventTemplate, setSelectedEventTemplate] = useState(0);
  const [sendTiming, setSendTiming] = useState<SendTiming>('즉시 발송');
  const [delayMinutes, setDelayMinutes] = useState(120);
  const [subject, setSubject] = useState('');
  const [bodyContent, setBodyContent] = useState('');
  const [editLocale, setEditLocale] = useState<EditLocale>('en');
  const [localeDrafts, setLocaleDrafts] = useState<LocaleDrafts>(EMPTY_DRAFTS);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');

  const templateIdParam = searchParams.get('template_id');
  const templateFilter = searchParams.get('event_type') ?? '';
  const dateFrom = searchParams.get('start_date') ?? '';
  const dateTo = searchParams.get('end_date') ?? '';
  const historyPage = parsePageParam(searchParams.get('page'));

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

  const onToast = (message: string, type: 'success' | 'warning' = 'success') => {
    setToast({ message, type });
  };

  const createEventTemplateMutation = useCreateEventTemplateMutation();

  const saveAddedTemplate = async (template: AddTemplateDraft): Promise<string | null> => {
    try {
      const created = await createEventTemplateMutation.mutateAsync({
        template_id: template.templateId,
        template_name: template.templateName,
        description: template.eventType,
        rule: {
          send_mode: template.sendTiming === '지연 발송' ? 'delay' : 'instant',
          delay_minutes: template.delayMinutes,
        },
        locales: { en: { subject: template.subject, html_content: template.htmlContent } },
      });
      // 목록을 먼저 새로 받아야 새 템플릿이 선택된다.
      await refetchEventTemplates();
      onToast('템플릿이 등록되었습니다', 'success');
      updateParams({ template_id: created.template_id });
      return null;
    } catch (error) {
      return getTemplateApiErrorMessage(error, '템플릿 등록에 실패했습니다.');
    }
  };

  const eventTemplates = eventTemplateList?.items ?? [];
  const selectedEventTemplateId = eventTemplates[selectedEventTemplate]?.template_id ?? null;
  const { data: selectedEventTemplateDetail } =
    useGetEventTemplateDetailQuery(selectedEventTemplateId);
  const previewTemplateMutation = usePreviewEventTemplateMutation();
  const updateEventTemplateMutation = useUpdateEventTemplateMutation();
  const eventTypesQuery = useListEventTypesQuery(activeTab === 'history');
  const eventTypes = eventTypesQuery.data?.events ?? [];
  const eventTypeNameMap = new Map(eventTypes.map((event) => [event.id, event.name]));
  const notificationLogsQuery = useListNotificationLogsQuery(
    {
      event_type: templateFilter || undefined,
      start_date: dateFrom || undefined,
      end_date: dateTo || undefined,
      group_by_batch: true,
      page: historyPage,
      page_size: HISTORY_PAGE_SIZE,
    },
    activeTab === 'history',
  );

  useEffect(() => {
    if (activeTab !== 'history' || eventTypesQuery.isLoading || eventTypesQuery.isError) return;
    if (!templateFilter) return;
    if (eventTypes.some((event) => event.id === templateFilter)) return;

    updateParams({ event_type: null });
  }, [activeTab, eventTypes, eventTypesQuery.isError, eventTypesQuery.isLoading, templateFilter]);

  useEffect(() => {
    if (activeTab !== 'templates' || eventTemplates.length === 0) return;

    if (!templateIdParam) {
      const firstTemplateId = eventTemplates[0]?.template_id;
      if (firstTemplateId) {
        updateParams({ template_id: firstTemplateId });
      }
      return;
    }

    const nextIndex = eventTemplates.findIndex(
      (template) => template.template_id === templateIdParam,
    );

    if (nextIndex < 0) {
      updateParams({ template_id: eventTemplates[0]?.template_id ?? null });
      return;
    }

    if (nextIndex !== selectedEventTemplate) {
      setSelectedEventTemplate(nextIndex);
      setShowPreview(false);
      setPreviewHtml('');
    }
  }, [activeTab, eventTemplates, selectedEventTemplate, templateIdParam]);

  useEffect(() => {
    if (!selectedEventTemplateDetail) return;

    const { locales } = selectedEventTemplateDetail;
    const drafts: LocaleDrafts = {
      en: { subject: locales.en?.subject ?? '', html: locales.en?.html_content ?? '' },
      ko: { subject: locales.ko?.subject ?? '', html: locales.ko?.html_content ?? '' },
    };
    const nextSubject = drafts.en.subject;
    const nextBody = drafts.en.html;
    setLocaleDrafts(drafts);
    setEditLocale('en');

    setSendTiming(
      selectedEventTemplateDetail.rule.send_mode === 'instant' ? '즉시 발송' : '지연 발송',
    );
    setDelayMinutes(selectedEventTemplateDetail.rule.delay_minutes);
    setSubject(nextSubject);
    setBodyContent(nextBody);
  }, [selectedEventTemplateDetail]);

  const t = {
    surface: dark ? '#0F1829' : '#ffffff',
    surface2: dark ? '#1A2035' : '#F4F5F7',
    surface3: dark ? '#232C44' : '#E8EAF0',
    border: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)',
    border2: dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)',
    text: dark ? '#E8EAF0' : '#1A1A1A',
    textSec: dark ? '#8B8FA8' : '#4A4A58',
    textHint: dark ? '#5A6080' : '#A0A0AA',
    pageBg: dark ? '#0A0F1E' : '#F4F5F7',
    accent: '#7C6AF7',
    accentBg: 'rgba(124,106,247,0.12)',
    accentBd: 'rgba(124,106,247,0.2)',
    tabActive: dark ? '#1A2035' : '#E8EAF0',
  };

  const selectEventTemplate = (index: number) => {
    setSelectedEventTemplate(index);
    updateParams({ template_id: eventTemplates[index]?.template_id ?? null });
    setShowPreview(false);
    setPreviewHtml('');
  };

  const switchEditLocale = (next: EditLocale) => {
    if (next === editLocale) return;
    const html = editorRef.current?.getHTML() ?? bodyContent;
    const updated: LocaleDrafts = { ...localeDrafts, [editLocale]: { subject, html } };
    setLocaleDrafts(updated);
    setEditLocale(next);
    setSubject(updated[next].subject);
    setBodyContent(updated[next].html);
    setShowPreview(false);
    setPreviewHtml('');
  };

  const fetchPreviewHtml = async () => {
    if (!selectedEventTemplateId) {
      onToast('미리볼 템플릿을 선택하세요', 'warning');
      return null;
    }

    try {
      const editorHtml = editorRef.current?.getHTML() ?? bodyContent;

      return await previewTemplateMutation.mutateAsync({
        content_html: editorHtml,
        subject,
        locale: editLocale,
      });
    } catch {
      onToast('미리보기를 불러오지 못했습니다', 'warning');
      return null;
    }
  };

  const saveTemplate = async () => {
    if (!selectedEventTemplateId || !selectedEventTemplateDetail) {
      onToast('수정할 템플릿을 선택하세요', 'warning');
      return;
    }

    const editorHtml = editorRef.current?.getHTML() ?? bodyContent;
    const allDrafts: LocaleDrafts = { ...localeDrafts, [editLocale]: { subject, html: editorHtml } };
    const locales: Record<string, { subject: string; html_content: string }> = {};
    for (const { value, label } of EDIT_LOCALES) {
      const draft = allDrafts[value];
      const hasSubject = draft.subject.trim() !== '';
      const hasBody = !isBlankHtml(draft.html);
      if (!hasSubject && !hasBody) continue;
      if (!hasSubject || !hasBody) {
        onToast(`${label} 제목과 본문을 모두 입력하세요`, 'warning');
        return;
      }
      locales[value] = { subject: draft.subject.trim(), html_content: draft.html };
    }
    if (!locales.en) {
      onToast('EN (영어) 제목과 본문은 필수입니다', 'warning');
      return;
    }
    const sendMode = sendTiming === '즉시 발송' ? 'instant' : 'delay';
    const nextDelayMinutes = sendMode === 'delay' ? Math.round(delayMinutes) : 0;

    try {
      await updateEventTemplateMutation.mutateAsync({
        templateId: selectedEventTemplateId,
        payload: {
          template_name: selectedEventTemplateDetail.template_name,
          description: selectedEventTemplateDetail.description ?? '',
          rule: {
            event_type: selectedEventTemplateDetail.rule.event_type,
            is_active: selectedEventTemplateDetail.rule.is_active,
            send_mode: sendMode,
            delay_minutes: nextDelayMinutes,
            event_name: selectedEventTemplateDetail.rule.event_name ?? '',
          },
          locales,
        },
      });

      setLocaleDrafts(allDrafts);
      setBodyContent(editorHtml);
      onToast('템플릿이 수정되었습니다', 'success');
    } catch (error) {
      onToast(getTemplateApiErrorMessage(error, '템플릿 수정에 실패했습니다'), 'warning');
    }
  };

  const formatNotificationSendTiming = (sendMode: string, delayMinutes: number) => {
    if (sendMode === 'instant') return '즉시 발송';
    if (sendMode === 'delay' || sendMode === 'delayed') {
      if (delayMinutes === 0) return '즉시 발송';

      return `지연 ${delayMinutes}분`;
    }
    return sendMode || '-';
  };

  const notificationLogs = notificationLogsQuery.data?.items ?? [];
  const notificationLogTotal = notificationLogsQuery.data?.total ?? 0;
  const notificationLogPageSize = notificationLogsQuery.data?.page_size ?? HISTORY_PAGE_SIZE;
  const notificationLogTotalPages = Math.max(
    1,
    Math.ceil(notificationLogTotal / notificationLogPageSize),
  );
  const notificationLogCurrentPage = notificationLogsQuery.data?.page ?? historyPage;
  const notificationLogRange = getPaginationRange({
    totalItems: notificationLogTotal,
    currentPage: notificationLogCurrentPage,
    pageSize: notificationLogPageSize,
    currentPageItemCount: notificationLogs.length,
  });

  return (
    <div style={{ background: t.pageBg, minHeight: '100vh' }}>
      {showAddModal && (
        <AddTemplateModal
          dark={dark}
          onClose={() => setShowAddModal(false)}
          onSave={saveAddedTemplate}
        />
      )}
      {/* Header */}
      <div
        style={{
          padding: '32px 24px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: t.text, margin: 0, marginBottom: 8 }}>
            이메일/알림 관리
          </h1>
          <p style={{ fontSize: 13, color: t.textSec, margin: 0 }}>
            이메일 발송 템플릿과 자동 발송 조건을 설정하고, 발송 이력을 관리합니다.
          </p>
        </div>
        {activeTab === 'templates' && (
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              onClick={async () => {
                if (showPreview) {
                  setShowPreview(false);
                  return;
                }

                const html = await fetchPreviewHtml();
                if (!html) return;

                setPreviewHtml(html);
                setShowPreview(true);
              }}
              style={{
                height: 36,
                padding: '0 16px',
                borderRadius: 8,
                border: `1px solid ${t.border2}`,
                background: 'transparent',
                color: t.text,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Eye size={14} />
              미리보기
            </button>
            <button
              type="button"
              onClick={saveTemplate}
              style={{
                height: 36,
                padding: '0 20px',
                borderRadius: 8,
                border: 'none',
                background: t.accent,
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: updateEventTemplateMutation.isPending ? 'not-allowed' : 'pointer',
                opacity: updateEventTemplateMutation.isPending ? 0.7 : 1,
              }}
              disabled={updateEventTemplateMutation.isPending}
            >
              저장
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ padding: '0 24px', marginBottom: 16 }}>
        <div
          style={{
            display: 'flex',
            gap: 8,
            borderBottom: `1px solid ${t.border}`,
          }}
        >
          <button
            onClick={() =>
              updateParams({
                tab: null,
                event_type: null,
                start_date: null,
                end_date: null,
                page: null,
                template_id: selectedEventTemplateId,
              })
            }
            style={{
              padding: '12px 20px',
              background: activeTab === 'templates' ? t.tabActive : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'templates' ? `2px solid ${t.accent}` : 'none',
              color: activeTab === 'templates' ? t.text : t.textSec,
              fontSize: 14,
              fontWeight: activeTab === 'templates' ? 600 : 500,
              cursor: 'pointer',
              borderRadius: '8px 8px 0 0',
            }}
          >
            템플릿 관리
          </button>
          <button
            onClick={() => updateParams({ tab: 'history', template_id: null })}
            style={{
              padding: '12px 20px',
              background: activeTab === 'history' ? t.tabActive : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'history' ? `2px solid ${t.accent}` : 'none',
              color: activeTab === 'history' ? t.text : t.textSec,
              fontSize: 14,
              fontWeight: activeTab === 'history' ? 600 : 500,
              cursor: 'pointer',
              borderRadius: '8px 8px 0 0',
            }}
          >
            발송 이력
          </button>
          <button
            onClick={() => updateParams({ tab: 'dispatch', template_id: null })}
            style={{
              padding: '12px 20px',
              background: activeTab === 'dispatch' ? t.tabActive : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'dispatch' ? `2px solid ${t.accent}` : 'none',
              color: activeTab === 'dispatch' ? t.text : t.textSec,
              fontSize: 14,
              fontWeight: activeTab === 'dispatch' ? 600 : 500,
              cursor: 'pointer',
              borderRadius: '8px 8px 0 0',
            }}
          >
            수동 발송 관리
          </button>
          <button
            onClick={() => updateParams({ tab: 'unsub', template_id: null })}
            style={{
              padding: '12px 20px',
              background: activeTab === 'unsub' ? t.tabActive : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'unsub' ? `2px solid ${t.accent}` : 'none',
              color: activeTab === 'unsub' ? t.text : t.textSec,
              fontSize: 14,
              fontWeight: activeTab === 'unsub' ? 600 : 500,
              cursor: 'pointer',
              borderRadius: '8px 8px 0 0',
            }}
          >
            수신거부 목록
          </button>
        </div>
      </div>

      {/* Tab 1: 템플릿 관리 */}
      {activeTab === 'templates' && (
        <div style={{ padding: '0 24px 32px' }}>
          <div style={{ display: 'flex', gap: 16, minHeight: '70vh' }}>
            {/* Left Panel: Template List */}
            <div
              style={{
                width: 240,
                flexShrink: 0,
                background: t.surface,
                border: `1px solid ${t.border}`,
                borderRadius: 12,
                padding: 16,
                height: 'fit-content',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>이메일 템플릿</span>
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: `1px solid ${t.border}`,
                    background: 'transparent',
                    color: t.accent,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  + 신규 등록
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {eventTemplates.map((template, index) => (
                  <TemplateListItem
                    key={template.template_id}
                    name={template.template_name}
                    subtitle={template.description ?? undefined}
                    selected={selectedEventTemplate === index}
                    t={t}
                    onSelect={() => selectEventTemplate(index)}
                    // onDelete={(e) => { e.stopPropagation(); setDeleteIndex(index); }}
                  />
                ))}
              </div>
            </div>

            {/* Right Panel: Template Editor */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Section A: 발송 시점 설정 */}
              <div
                style={{
                  background: t.surface,
                  border: `1px solid ${t.border}`,
                  borderRadius: 12,
                  padding: 20,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 16 }}>
                  발송 시점 설정
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 11,
                        fontWeight: 600,
                        color: t.textSec,
                        marginBottom: 8,
                      }}
                    >
                      발송 시점
                    </label>
                    <select
                      value={sendTiming}
                      onChange={(e) => setSendTiming(e.target.value as SendTiming)}
                      style={{
                        width: '100%',
                        height: 38,
                        padding: '0 12px',
                        borderRadius: 8,
                        border: `1px solid ${t.border}`,
                        background: t.surface2,
                        color: t.text,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      <option value="즉시 발송">즉시 발송</option>
                      <option value="지연 발송">지연 발송</option>
                    </select>
                  </div>
                  {sendTiming === '지연 발송' && (
                    <div style={{ flex: 1 }}>
                      <label
                        style={{
                          display: 'block',
                          fontSize: 11,
                          fontWeight: 600,
                          color: t.textSec,
                          marginBottom: 8,
                        }}
                      >
                        지연 시간
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="number"
                          value={delayMinutes}
                          onChange={(e) => setDelayMinutes(Number(e.target.value))}
                          style={{
                            width: '100%',
                            height: 38,
                            padding: '0 50px 0 12px',
                            borderRadius: 8,
                            border: `1px solid ${t.border}`,
                            background: t.surface2,
                            color: t.text,
                            fontSize: 13,
                            fontFamily: "'DM Mono',monospace",
                          }}
                        />
                        <span
                          style={{
                            position: 'absolute',
                            right: 12,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            fontSize: 12,
                            color: t.textSec,
                          }}
                        >
                          분 후
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 편집 언어 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: t.textSec, marginRight: 4 }}>
                  편집 언어
                </span>
                {EDIT_LOCALES.map(({ value, label }) => {
                  const active = editLocale === value;
                  const empty =
                    value !== editLocale &&
                    !localeDrafts[value].subject.trim() &&
                    isBlankHtml(localeDrafts[value].html);
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => switchEditLocale(value)}
                      style={{
                        height: 30,
                        padding: '0 14px',
                        borderRadius: 8,
                        border: `1px solid ${active ? t.accent : t.border2}`,
                        background: active ? t.accentBg : 'transparent',
                        color: active ? t.accent : t.textSec,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {label}
                      {empty ? ' · 미작성' : ''}
                    </button>
                  );
                })}
                <span style={{ fontSize: 11, color: t.textHint, marginLeft: 4 }}>
                  회원 언어가 한국어면 KO, 그 외에는 EN 내용으로 발송됩니다. KO가 비어 있으면 EN으로 보냅니다.
                </span>
              </div>

              {/* Section B: 제목 */}
              <div
                style={{
                  background: t.surface,
                  border: `1px solid ${t.border}`,
                  borderRadius: 12,
                  padding: 20,
                }}
              >
                <label
                  style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 600,
                    color: t.text,
                    marginBottom: 12,
                  }}
                >
                  제목 (Subject)
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  style={{
                    width: '100%',
                    height: 38,
                    padding: '0 12px',
                    borderRadius: 8,
                    border: `1px solid ${t.border}`,
                    background: t.surface2,
                    color: t.text,
                    fontSize: 13,
                  }}
                />
              </div>

              {/* Section C: 본문 */}
              <div
                style={{
                  background: t.surface,
                  border: `1px solid ${t.border}`,
                  borderRadius: 12,
                  padding: 20,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 12 }}>
                  본문 (Body — HTML)
                </div>

                {/* Editor area */}
                <EmailTemplateEditor
                  key={`${selectedEventTemplateId ?? 'empty-template'}-${editLocale}`}
                  ref={editorRef}
                  initialValue={bodyContent}
                  dark={dark}
                />
                {(selectedEventTemplateDetail?.variables?.length ?? 0) > 0 && (
                  <div style={{ fontSize: 11, color: t.textHint, marginTop: 10, lineHeight: 1.6 }}>
                    사용 가능한 변수:{' '}
                    {selectedEventTemplateDetail?.variables
                      ?.map((name) => `{{ ${name} }}`)
                      .join(', ')}
                  </div>
                )}
              </div>

              {/* Section F: 이메일 미리보기 */}
              {showPreview && (
                <div
                  style={{
                    background: t.surface,
                    border: `1px solid ${t.border}`,
                    borderRadius: 12,
                    padding: 20,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 16 }}>
                    📧 이메일 미리보기
                  </div>
                  <iframe
                    title="이메일 미리보기"
                    srcDoc={previewHtml}
                    style={{
                      width: '100%',
                      minHeight: 640,
                      border: 'none',
                      borderRadius: 8,
                      background: '#ffffff',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    }}
                  />{' '}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: 발송 이력 */}
      {activeTab === 'history' && (
        <>
          {/* Filter Bar */}
          <div style={{ padding: '0 24px 20px' }}>
            <div
              style={{
                padding: '16px 20px',
                background: t.surface,
                borderRadius: 12,
                border: `1px solid ${t.border}`,
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <select
                value={templateFilter}
                onChange={(e) => {
                  updateParams({ event_type: e.target.value, page: 1, tab: 'history' });
                }}
                style={{
                  height: 36,
                  padding: '0 12px',
                  borderRadius: 8,
                  border: `1px solid ${t.border}`,
                  background: t.surface2,
                  color: t.text,
                  fontSize: 13,
                  minWidth: 180,
                  cursor: 'pointer',
                }}
              >
                <option value="">템플릿: 전체</option>
                {eventTypes.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  updateParams({ start_date: e.target.value, page: 1, tab: 'history' });
                }}
                style={{
                  height: 36,
                  padding: '0 12px',
                  borderRadius: 8,
                  border: `1px solid ${t.border}`,
                  background: t.surface2,
                  color: t.text,
                  fontSize: 13,
                }}
              />
              <span style={{ color: t.textSec }}>~</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  updateParams({ end_date: e.target.value, page: 1, tab: 'history' });
                }}
                style={{
                  height: 36,
                  padding: '0 12px',
                  borderRadius: 8,
                  border: `1px solid ${t.border}`,
                  background: t.surface2,
                  color: t.text,
                  fontSize: 13,
                }}
              />
            </div>
          </div>

          {/* Table */}
          <div style={{ padding: '0 24px 32px' }}>
            <div
              style={{
                background: t.surface,
                borderRadius: 12,
                border: `1px solid ${t.border}`,
                overflow: 'hidden',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: t.surface2, borderBottom: `1px solid ${t.border}` }}>
                    {['템플릿', '이벤트 트리거', '발송 시점', '수신자수', '발송일시'].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '12px 16px',
                          textAlign: 'left',
                          fontSize: 11,
                          fontWeight: 600,
                          color: t.textSec,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {notificationLogs.map((item) => (
                    <tr
                      key={item.trace_id ?? `${item.event_type}-${item.sent_at}`}
                      style={{ borderBottom: `1px solid ${t.border}` }}
                    >
                      <td style={{ padding: '16px', fontSize: 12, color: t.text }}>
                        {item.subject || '-'}
                      </td>
                      <td style={{ padding: '16px', fontSize: 11, color: t.textSec }}>
                        {eventTypeNameMap.get(item.event_type) ?? item.event_type}
                      </td>
                      <td style={{ padding: '16px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            padding: '4px 10px',
                            borderRadius: 9999,
                            fontSize: 11,
                            fontWeight: 600,
                            background: t.surface2,
                            color: t.textSec,
                            border: `1px solid ${t.border2}`,
                          }}
                        >
                          {formatNotificationSendTiming(item.send_mode, item.delay_minutes)}
                        </span>
                      </td>
                      <td style={{ padding: '16px', fontSize: 12, color: t.text }}>
                        {item.total_count.toLocaleString()}명
                      </td>
                      <td
                        style={{
                          padding: '16px',
                          fontSize: 11,
                          color: t.textSec,
                          fontFamily: "'DM Mono',monospace",
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatKstDateTime(item.sent_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <TablePagination
                summary={buildPaginationSummary({
                  totalItems: notificationLogTotal,
                  start: notificationLogRange.start,
                  end: notificationLogRange.end,
                  unit: '건',
                })}
                borderColor={t.border}
                textColor={t.textHint}
                activeBackground={t.accent}
                inactiveBackground={t.surface2}
                inactiveBorderColor={t.border2}
                items={buildPaginationItems({
                  currentPage: notificationLogCurrentPage,
                  totalPages: notificationLogTotalPages,
                  onPageChange: (page) => updateParams({ page, tab: 'history' }),
                })}
              />
            </div>
          </div>
        </>
      )}
      {activeTab === 'dispatch' && (
        <ManualDispatchTab dark={dark} onToast={onToast} t={t} />
      )}
      {activeTab === 'unsub' && <UnsubscribeTab t={t} />}
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
