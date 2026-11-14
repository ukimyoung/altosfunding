import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { DISPATCH_SEARCH_PAGE_SIZE } from '../../constants/emailDispatch';
import { EmailTemplateEditor, EmailTemplateEditorHandle } from '../EmailTemplateEditor';
import { formatKstDateTimeParts } from '../../utils/utils';
import {
  useCreateManualEmailDraftMutation,
  useCreateManualEmailDraftWithCsvMutation,
  useExportManualEmailRecipientsMutation,
  useManualEmailDraftsQuery,
  useSearchManualEmailRecipientsMutation,
  useSendManualEmailDraftMutation,
  useUploadManualEmailImageMutation,
  useUpdateManualEmailDraftMutation,
} from '../../queries/manualEmail';
import type {
  ManualEmailDraftPayload,
  ManualEmailDraftResponse,
  ManualEmailFilter,
  ManualEmailGrade,
} from '../../../api/manualEmail';
import type {
  DispatchSearchRow,
  DispatchSearchState,
  DispatchTargetType,
  DispatchTiming,
  DispatchVipFilter,
} from '../../types/emailDispatch';

type ToastType = 'success' | 'warning';

interface ManualEmailApiError {
  error_code?: string;
  message_key?: string;
  message?: string;
  detail?: unknown;
}

interface ManualDispatchTabProps {
  dark: boolean;
  onToast: (message: string, type?: ToastType) => void;
  t: Record<string, string>;
}

const getManualEmailErrorMessage = (error: unknown, fallback: string) => {
  if (!axios.isAxiosError<ManualEmailApiError>(error)) return fallback;

  const message = error.response?.data?.message;
  return message?.trim() || fallback;
};

function SectionCard({
  title,
  children,
  t,
}: {
  title: string;
  children: React.ReactNode;
  t: Record<string, string>;
}) {
  return (
    <div
      style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '14px 24px',
          borderBottom: `1px solid ${t.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{ width: 3, height: 18, borderRadius: 2, background: t.accent, flexShrink: 0 }}
        />
        <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{title}</span>
      </div>
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {children}
      </div>
    </div>
  );
}

function ToggleSwitch({
  on,
  onChange,
  dark,
}: {
  on: boolean;
  onChange: () => void;
  dark: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        border: 'none',
        cursor: 'pointer',
        flexShrink: 0,
        background: on ? '#7C6AF7' : dark ? 'rgba(255,255,255,0.15)' : '#D1D5DB',
        position: 'relative',
        transition: 'background 0.2s',
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#fff',
          position: 'absolute',
          top: 3,
          left: on ? 23 : 3,
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  );
}

export function ManualDispatchTab({ dark, onToast, t }: ManualDispatchTabProps) {
  const draftListQuery = useManualEmailDraftsQuery();
  const searchRecipientsMutation = useSearchManualEmailRecipientsMutation();
  const allUserTotalMutation = useSearchManualEmailRecipientsMutation();
  const exportRecipientsMutation = useExportManualEmailRecipientsMutation();
  const createDraftMutation = useCreateManualEmailDraftMutation();
  const createDraftWithCsvMutation = useCreateManualEmailDraftWithCsvMutation();
  const updateDraftMutation = useUpdateManualEmailDraftMutation();
  const sendDraftMutation = useSendManualEmailDraftMutation();
  const uploadImageMutation = useUploadManualEmailImageMutation();
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterVip, setFilterVip] = useState<DispatchVipFilter>('전체');
  const [csvDragOver, setCsvDragOver] = useState(false);
  const [searchState, setSearchState] = useState<DispatchSearchState>('idle');
  const [searchResults, setSearchResults] = useState<DispatchSearchRow[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchPageSize, setSearchPageSize] = useState(DISPATCH_SEARCH_PAGE_SIZE);
  const [searchTotalPages, setSearchTotalPages] = useState(1);
  const [allUserTotal, setAllUserTotal] = useState<number | null>(null);
  const [allUserUnsubscribed, setAllUserUnsubscribed] = useState(0);
  const [searchDirty, setSearchDirty] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [pendingDraft, setPendingDraft] = useState<ManualEmailDraftResponse | null>(null);

  const [targetType, setTargetType] = useState<DispatchTargetType>('all');
  const [manualEmails, setManualEmails] = useState('');
  const [subject, setSubject] = useState('');
  const [optMarketing, setOptMarketing] = useState(true);
  const [optEmergency, setOptEmergency] = useState(false);
  const [htmlMode, setHtmlMode] = useState(false);
  const [htmlSource, setHtmlSource] = useState('');
  const [editorInitialHtml, setEditorInitialHtml] = useState('');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [sendTiming, setSendTiming] = useState<DispatchTiming>('immediate');
  const [schedDate, setSchedDate] = useState('');
  const [schedTime, setSchedTime] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const editorRef = useRef<EmailTemplateEditorHandle>(null);
  const htmlTextareaRef = useRef<HTMLTextAreaElement>(null);
  const hydratedDraftRef = useRef(false);

  const markDirty = () => {
    if (searchState !== 'idle') setSearchDirty(true);
  };

  const manualCount = manualEmails
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter((value) => value.includes('@')).length;
  const targetCount = targetType === 'all' ? (allUserTotal ?? 0) : manualCount;
  const targetCountLabel = `${targetCount.toLocaleString()}명`;
  const allUserUnsubscribedCount = allUserUnsubscribed ?? 0;

  const getGrade = (): ManualEmailGrade => {
    if (filterVip === '일반') return 'NORMAL';
    if (filterVip === 'VIP') return 'VIP';
    return 'ALL';
  };

  const buildRecipientFilterBase = (): ManualEmailFilter => ({
    ...(filterDateFrom ? { joined_from: filterDateFrom } : {}),
    ...(filterDateTo ? { joined_to: filterDateTo } : {}),
    grade: getGrade(),
    challenge_type_code: 'ALL',
    marketing_preview: optMarketing && !optEmergency,
    newsletter_filter: 'ALL',
  });

  const buildRecipientFilter = (page = searchPage): ManualEmailFilter => ({
    ...buildRecipientFilterBase(),
    page,
    page_size: DISPATCH_SEARCH_PAGE_SIZE,
  });

  const hydrateDraft = (draft: ManualEmailDraftResponse) => {
    const content = draft.content_locales.en;
    const nextHtml = content?.html_content ?? '';
    const sendAtMatch = draft.send_at?.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);

    setPendingDraft(draft);
    setSubject(content?.subject ?? '');
    setOptEmergency(draft.is_urgent);
    setOptMarketing(draft.is_marketing && !draft.is_urgent);
    setHtmlMode(false);
    setHtmlSource(nextHtml);
    setEditorInitialHtml(nextHtml);
    editorRef.current?.setHTML(nextHtml);

    if (draft.target_mode === 'filter_all') {
      const filter = draft.filter;

      setTargetType('all');
      setManualEmails('');
      setCsvFile(null);
      setFilterDateFrom(filter?.joined_from ?? '');
      setFilterDateTo(filter?.joined_to ?? '');
      setFilterVip(filter?.grade === 'VIP' ? 'VIP' : filter?.grade === 'NORMAL' ? '일반' : '전체');
      setSearchDirty(false);
    } else {
      setTargetType('manual');
      setCsvFile(null);
      setManualEmails((draft.manual_entries ?? []).join('\n'));
    }

    if (sendAtMatch) {
      setSendTiming('scheduled');
      setSchedDate(sendAtMatch[1]);
      setSchedTime(sendAtMatch[2]);
    } else {
      setSendTiming('immediate');
      setSchedDate('');
      setSchedTime('');
    }
  };

  useEffect(() => {
    if (hydratedDraftRef.current) return;

    const draft = draftListQuery.data?.items[0];
    if (!draft) return;

    hydratedDraftRef.current = true;
    hydrateDraft(draft);
  }, [draftListQuery.data]);

  useEffect(() => {
    let ignore = false;

    const fetchAllUserTotal = async () => {
      try {
        const response = await allUserTotalMutation.mutateAsync({
          ...buildRecipientFilterBase(),
          page: 1,
          page_size: 1,
        });

        if (!ignore) {
          setAllUserTotal(response.total ?? 0);
          setAllUserUnsubscribed(response.unsubscribed_count ?? 0);
        }
      } catch {
        if (!ignore) {
          setAllUserTotal(null);
          setAllUserUnsubscribed(0);
        }
      }
    };

    void fetchAllUserTotal();

    return () => {
      ignore = true;
    };
  }, [filterDateFrom, filterDateTo, filterVip, optEmergency, optMarketing]);

  const parseManualEntries = () =>
    Array.from(
      new Set(
        manualEmails
          .split(/[\n,]/)
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    );

  const buildSendAt = () =>
    sendTiming === 'scheduled' && schedDate && schedTime
      ? `${schedDate}T${schedTime}:00+09:00`
      : null;

  const buildDraftPayload = (): ManualEmailDraftPayload => {
    const basePayload = {
      is_marketing: optMarketing && !optEmergency,
      is_urgent: optEmergency,
      content_locales: {
        en: {
          subject: subject.trim(),
          html_content: getRawHtml(),
        },
      },
      preview_locale: 'en',
      sample_user_name: 'John Doe',
      send_at: buildSendAt(),
    };

    if (targetType === 'all') {
      return {
        target_mode: 'filter_all',
        filter: buildRecipientFilterBase(),
        ...basePayload,
      };
    }

    if (csvFile) {
      return {
        target_mode: 'csv_import',
        ...basePayload,
      };
    }

    if (pendingDraft?.target_mode === 'csv_import' && pendingDraft.import_id) {
      return {
        target_mode: 'csv_import',
        import_id: pendingDraft.import_id,
        ...basePayload,
      };
    }

    return {
      target_mode: 'manual_input',
      manual_entries: parseManualEntries(),
      ...basePayload,
    };
  };

  const createDraftForCurrentForm = async () => {
    const payload = buildDraftPayload();

    if (targetType === 'manual' && csvFile) {
      return createDraftWithCsvMutation.mutateAsync({ payload, file: csvFile });
    }

    return createDraftMutation.mutateAsync(payload);
  };

  const saveDraftForCurrentForm = async () => {
    const payload = buildDraftPayload();

    if (!pendingDraft) {
      return createDraftForCurrentForm();
    }

    if (targetType === 'manual' && csvFile) {
      return createDraftWithCsvMutation.mutateAsync({ payload, file: csvFile });
    }

    return updateDraftMutation.mutateAsync({
      draftId: pendingDraft.draft_id,
      payload,
    });
  };

  const runSearch = async (page = 1) => {
    const filter = buildRecipientFilter(page);

    try {
      const response = await searchRecipientsMutation.mutateAsync(filter);
      const results = response.items.map((row) => {
        const joinedAt = row.joined_at ? formatKstDateTimeParts(row.joined_at).date : '-';

        return {
          name: row.user_name ?? '-',
          email: row.email,
          accounts: row.account_count ?? 0,
          joinDate: joinedAt,
          type: row.grade === 'VIP' ? 'VIP' : '일반',
          unsubscribed: !row.subscribed_newsletter,
        };
      });

      setSearchResults(results);
      setSearchTotal(response.total ?? 0);
      setSearchPage(response.page ?? 1);
      setSearchPageSize(response.page_size ?? DISPATCH_SEARCH_PAGE_SIZE);
      setSearchTotalPages(Math.max(1, response.total_pages ?? 1));
      setSearchState(response.total > 0 ? 'results' : 'empty');
      setSearchDirty(false);
    } catch {
      onToast('조건 검색에 실패했습니다.', 'warning');
    }
  };

  const exportCsv = async () => {
    try {
      await exportRecipientsMutation.mutateAsync(buildRecipientFilterBase());
      onToast('CSV 파일이 다운로드되었습니다.', 'success');
    } catch {
      onToast('CSV 파일 다운로드에 실패했습니다.', 'warning');
    }
  };

  const handleCsvUpload = (file: File) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const text = (event.target?.result as string) ?? '';
      const emails = text
        .split(/[\n,\r]/)
        .map((value) => value.trim().replace(/^"|"$/g, ''))
        .filter((value) => value.includes('@'));

      setCsvFile(file);
      setManualEmails(Array.from(new Set(emails)).join('\n'));
      onToast(`CSV에서 ${emails.length}개 이메일을 불러왔습니다.`, 'success');
    };

    reader.readAsText(file);
  };

  const toggleHtmlMode = () => {
    if (!htmlMode) {
      setHtmlSource(editorRef.current?.getHTML() ?? '');
      setHtmlMode(true);
      return;
    }

    editorRef.current?.setHTML(htmlSource);
    setHtmlMode(false);
  };

  const getRawHtml = () => (htmlMode ? htmlSource : (editorRef.current?.getHTML() ?? ''));

  const getPreviewHtml = () => {
    return getRawHtml()
      .replace(/\{\{user_name\}\}/g, 'Jane Doe')
      .replace(/\{\{account_no\}\}/g, 'ALT-2025-123456')
      .replace(/\{\{amount\}\}/g, '$10,000')
      .replace(/\{\{challenge_name\}\}/g, '100K Standard')
      .replace(/\{\{tier\}\}/g, 'Professional')
      .replace(/\{\{profit\}\}/g, '$1,250')
      .replace(/\{\{date\}\}/g, '2026-07-20');
  };

  const handlePreview = () => {
    if (
      !subject.trim() ||
      !getRawHtml()
        .replace(/<[^>]*>/g, '')
        .trim()
    ) {
      setShowPreviewModal(true);
      return;
    }

    setShowPreviewModal(true);
  };

  const handleSaveDraft = async () => {
    if (!subject.trim()) {
      onToast('이메일 제목을 입력해주세요.', 'warning');
      return;
    }

    if (
      !getRawHtml()
        .replace(/<[^>]*>/g, '')
        .trim()
    ) {
      onToast('이메일 본문을 입력해주세요.', 'warning');
      return;
    }

    try {
      const draft = await saveDraftForCurrentForm();
      setPendingDraft(draft);
      onToast('임시 저장되었습니다.', 'success');
    } catch (error) {
      onToast(getManualEmailErrorMessage(error, '임시 저장에 실패했습니다'), 'warning');
    }
  };

  const handleSend = async () => {
    if (!subject.trim()) {
      onToast('이메일 제목을 입력해주세요.', 'warning');
      return;
    }

    if (
      !getRawHtml()
        .replace(/<[^>]*>/g, '')
        .trim()
    ) {
      onToast('이메일 본문을 입력해주세요.', 'warning');
      return;
    }

    if (sendTiming === 'scheduled' && (!schedDate || !schedTime)) {
      onToast('예약 발송 날짜와 시간을 입력해주세요.', 'warning');
      return;
    }

    if (targetType === 'manual' && !csvFile && parseManualEntries().length === 0) {
      onToast('발송 대상 이메일을 입력하거나 CSV를 업로드해주세요.', 'warning');
      return;
    }

    try {
      const draft = await saveDraftForCurrentForm();
      setPendingDraft(draft);
      setShowConfirm(true);
    } catch (error) {
      onToast(
        getManualEmailErrorMessage(error, '수동 발송 드래프트 저장에 실패했습니다.'),
        'warning',
      );
    }
  };

  const handleConfirm = async () => {
    if (!pendingDraft) {
      onToast('발송 드래프트를 먼저 생성해주세요.', 'warning');
      return;
    }

    try {
      await sendDraftMutation.mutateAsync(pendingDraft.draft_id);
      setShowConfirm(false);
      const message =
        sendTiming === 'immediate'
          ? `${targetCount.toLocaleString()}명에게 이메일 발송 요청이 생성되었습니다.`
          : `${schedDate} ${schedTime}에 발송 예약 요청이 생성되었습니다.`;

      onToast(message, 'success');
      setPendingDraft(null);
    } catch (error) {
      onToast(getManualEmailErrorMessage(error, '이메일 발송 요청에 실패했습니다.'), 'warning');
    }
  };

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
  const sendPill = (type: DispatchTargetType, label: string) => (
    <button
      key={type}
      type="button"
      onClick={() => setTargetType(type)}
      style={{
        height: 36,
        padding: '0 20px',
        borderRadius: 8,
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 500,
        border: `1px solid ${targetType === type ? t.accent : t.border2}`,
        background: targetType === type ? t.accentBg : 'transparent',
        color: targetType === type ? t.accent : t.textSec,
        fontFamily: "'Inter','DM Sans','Noto Sans KR',sans-serif",
        transition: 'all 0.12s',
      }}
    >
      {label}
    </button>
  );

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
      <SectionCard title="대상 선택" t={t}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>조건 검색</span>
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 20,
                background: t.surface3,
                color: t.textHint,
                border: `1px solid ${t.border2}`,
              }}
            >
              참고용
            </span>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={labelStyle}>가입기간</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(event) => {
                    setFilterDateFrom(event.target.value);
                    markDirty();
                  }}
                  style={{ ...inputStyle, width: 140 }}
                />
                <span style={{ color: t.textHint, fontSize: 13 }}>~</span>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(event) => {
                    setFilterDateTo(event.target.value);
                    markDirty();
                  }}
                  style={{ ...inputStyle, width: 140 }}
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>일반 / VIP</label>
              <div
                style={{
                  display: 'flex',
                  gap: 0,
                  borderRadius: 8,
                  overflow: 'hidden',
                  border: `1px solid ${t.border2}`,
                }}
              >
                {(['전체', '일반', 'VIP'] as const).map((option, index) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setFilterVip(option);
                      markDirty();
                    }}
                    style={{
                      height: 38,
                      padding: '0 16px',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 500,
                      border: 'none',
                      borderLeft: index > 0 ? `1px solid ${t.border2}` : 'none',
                      background: filterVip === option ? t.accentBg : t.surface2,
                      color: filterVip === option ? t.accent : t.textSec,
                      fontFamily: "'Inter','DM Sans','Noto Sans KR',sans-serif",
                      transition: 'all 0.12s',
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
              <button
                type="button"
                onClick={() => runSearch(1)}
                style={{
                  height: 38,
                  padding: '0 20px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  border: 'none',
                  background: t.accent,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: "'Inter','DM Sans','Noto Sans KR',sans-serif",
                  whiteSpace: 'nowrap',
                }}
              >
                검색
              </button>
              <button
                type="button"
                onClick={exportCsv}
                disabled={searchState !== 'results' || searchDirty}
                style={{
                  height: 38,
                  padding: '0 16px',
                  borderRadius: 8,
                  cursor: searchState === 'results' && !searchDirty ? 'pointer' : 'not-allowed',
                  border: `1px solid ${t.border2}`,
                  background:
                    searchState === 'results' && !searchDirty
                      ? t.surface2
                      : dark
                        ? 'rgba(255,255,255,0.04)'
                        : 'rgba(0,0,0,0.04)',
                  color: searchState === 'results' && !searchDirty ? t.text : t.textHint,
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "'Inter','DM Sans','Noto Sans KR',sans-serif",
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: 13 }}>⬇</span> 결과값 CSV 추출
              </button>
            </div>
          </div>

          {(() => {
            const totalPages = searchTotalPages;
            const pageRows = searchResults;
            const start = searchResults.length === 0 ? 0 : (searchPage - 1) * searchPageSize + 1;
            const end = searchResults.length === 0 ? 0 : start + searchResults.length - 1;
            const gridBorder: React.CSSProperties = {
              border: `1px solid ${t.border2}`,
              borderRadius: 10,
              overflow: 'hidden',
              marginTop: 4,
            };
            const thStyle: React.CSSProperties = {
              padding: '9px 14px',
              fontSize: 11,
              fontWeight: 700,
              color: t.textSec,
              textAlign: 'left',
              whiteSpace: 'nowrap',
              background: t.surface3,
              borderBottom: `1px solid ${t.border2}`,
              letterSpacing: '0.05em',
            };
            const tdStyle: React.CSSProperties = {
              padding: '10px 14px',
              fontSize: 13,
              color: t.text,
              borderBottom: `1px solid ${t.border}`,
            };

            if (searchState === 'idle') {
              return (
                <div style={{ ...gridBorder, padding: '28px 0', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>🔍</div>
                  <div style={{ fontSize: 13, color: t.textHint }}>
                    조건을 설정하고 검색 버튼을 눌러주세요.
                  </div>
                </div>
              );
            }

            if (searchDirty) {
              return (
                <div
                  style={{
                    ...gridBorder,
                    padding: '20px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <span style={{ fontSize: 16 }}>⚠️</span>
                  <span style={{ fontSize: 13, color: '#EAB308', fontWeight: 600 }}>
                    필터가 변경되었습니다. 다시 검색해주세요.
                  </span>
                </div>
              );
            }

            if (searchState === 'empty') {
              return (
                <div style={{ ...gridBorder, padding: '28px 0', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>📭</div>
                  <div style={{ fontSize: 13, color: t.textHint }}>검색 결과가 없습니다.</div>
                </div>
              );
            }

            return (
              <div style={gridBorder}>
                <div
                  style={{
                    padding: '10px 14px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: `1px solid ${t.border2}`,
                    background: t.surface2,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: t.text }}>
                    검색 결과 총{' '}
                    <span style={{ color: t.accent }}>{searchTotal.toLocaleString()}</span>명
                  </span>
                  {totalPages > 1 && (
                    <span style={{ fontSize: 11, color: t.textHint }}>
                      총 {searchTotal.toLocaleString()}개 중 {start}-{end}개 표시
                    </span>
                  )}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>이름</th>
                      <th style={thStyle}>이메일</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>계좌 수</th>
                      <th style={thStyle}>유형</th>
                      <th style={thStyle}>가입일</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>수신거부 여부</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row, index) => (
                      <tr
                        key={row.email}
                        style={{
                          background:
                            index % 2 === 0
                              ? 'transparent'
                              : dark
                                ? 'rgba(255,255,255,0.015)'
                                : 'rgba(0,0,0,0.015)',
                        }}
                      >
                        <td style={tdStyle}>{row.name}</td>
                        <td
                          style={{
                            ...tdStyle,
                            color: t.textSec,
                            fontFamily: "'DM Mono',monospace",
                            fontSize: 12,
                          }}
                        >
                          {row.email}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600 }}>
                          {row.accounts}
                        </td>
                        <td style={tdStyle}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: 12,
                              background: row.type === 'VIP' ? 'rgba(234,179,8,0.12)' : t.surface3,
                              color: row.type === 'VIP' ? '#EAB308' : t.textSec,
                            }}
                          >
                            {row.type}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, color: t.textSec, fontSize: 12 }}>
                          {row.joinDate}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          {row.unsubscribed ? (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                padding: '2px 8px',
                                borderRadius: 12,
                                background: 'rgba(220,38,38,0.08)',
                                color: '#DC2626',
                                border: '1px solid rgba(220,38,38,0.18)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              수신거부
                            </span>
                          ) : (
                            <span style={{ fontSize: 12, color: t.textHint }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {totalPages > 1 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      padding: '10px 14px',
                      borderTop: `1px solid ${t.border2}`,
                      background: t.surface2,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => runSearch(Math.max(1, searchPage - 1))}
                      disabled={searchPage === 1}
                      style={{
                        height: 28,
                        padding: '0 10px',
                        borderRadius: 6,
                        border: `1px solid ${t.border2}`,
                        background: 'transparent',
                        color: searchPage === 1 ? t.textHint : t.text,
                        cursor: searchPage === 1 ? 'default' : 'pointer',
                        fontSize: 12,
                      }}
                    >
                      이전
                    </button>
                    {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() => runSearch(page)}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          border: `1px solid ${page === searchPage ? t.accent : t.border2}`,
                          background: page === searchPage ? t.accentBg : 'transparent',
                          color: page === searchPage ? t.accent : t.text,
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: page === searchPage ? 700 : 400,
                        }}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => runSearch(Math.min(totalPages, searchPage + 1))}
                      disabled={searchPage === totalPages}
                      style={{
                        height: 28,
                        padding: '0 10px',
                        borderRadius: 6,
                        border: `1px solid ${t.border2}`,
                        background: 'transparent',
                        color: searchPage === totalPages ? t.textHint : t.text,
                        cursor: searchPage === totalPages ? 'default' : 'pointer',
                        fontSize: 12,
                      }}
                    >
                      다음
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 6,
              padding: '10px 14px',
              borderRadius: 8,
              background: dark ? 'rgba(234,179,8,0.06)' : 'rgba(234,179,8,0.08)',
              border: '1px solid rgba(234,179,8,0.2)',
            }}
          >
            <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>💡</span>
            <span style={{ fontSize: 12, color: t.textSec, lineHeight: 1.6 }}>
              검색 결과를 확인한 후 CSV로 추출할 수 있습니다. 추출한 목록은 아래{' '}
              <strong style={{ color: t.text }}>수동 입력</strong> 시 참고용으로 사용하세요.
            </span>
          </div>
        </div>

        <div style={{ height: 1, background: t.border, margin: '4px 0' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>발송 대상 선택</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {sendPill('all', '전체 발송')}
            {sendPill('manual', '수동 입력')}
          </div>
          {targetType === 'all' && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                borderRadius: 8,
                background: t.accentBg,
                border: `1px solid ${t.accentBd}`,
                alignSelf: 'flex-start',
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: t.accent,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 600, color: t.accent }}>
                전체 유저 {targetCount.toLocaleString()}명에게 발송됩니다
                {!optEmergency && (
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#DC2626', marginLeft: 8 }}>
                    (수신거부 {allUserUnsubscribedCount.toLocaleString()}명 자동 제외)
                  </span>
                )}
              </span>
            </div>
          )}
          {targetType === 'manual' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <textarea
                value={manualEmails}
                onChange={(event) => {
                  setManualEmails(event.target.value);
                  setCsvFile(null);
                }}
                placeholder="이메일을 줄바꿈 또는 쉼표로 구분하여 입력하세요"
                rows={5}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: `1px solid ${t.border2}`,
                  background: t.surface2,
                  color: t.text,
                  fontSize: 13,
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: "'Inter','DM Sans','Noto Sans KR',sans-serif",
                  lineHeight: 1.7,
                }}
              />
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setCsvDragOver(true);
                }}
                onDragLeave={() => setCsvDragOver(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setCsvDragOver(false);
                  const file = event.dataTransfer.files[0];
                  if (file) handleCsvUpload(file);
                }}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.csv,text/csv';
                  input.onchange = (event) => {
                    const file = (event.target as HTMLInputElement).files?.[0];
                    if (file) handleCsvUpload(file);
                  };
                  input.click();
                }}
                style={{
                  border: `2px dashed ${csvDragOver ? t.accent : t.border2}`,
                  borderRadius: 10,
                  padding: '22px 16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: csvDragOver ? t.accentBg : t.surface2,
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: 22, marginBottom: 6 }}>📂</div>
                <div
                  style={{ fontSize: 13, fontWeight: 600, color: csvDragOver ? t.accent : t.text }}
                >
                  CSV 파일을 드래그하거나 클릭하여 업로드
                </div>
                <div style={{ fontSize: 11, color: t.textHint, marginTop: 4 }}>
                  열: 이름, 이메일, 계좌 수 등 - 이메일 열이 자동으로 파싱됩니다
                </div>
              </div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 16px',
                  borderRadius: 8,
                  background: t.accentBg,
                  border: `1px solid ${t.accentBd}`,
                  alignSelf: 'flex-start',
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: manualCount > 0 ? t.accent : t.textHint,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: manualCount > 0 ? t.accent : t.textSec,
                  }}
                >
                  총 {manualCount.toLocaleString()}명
                </span>
                {manualCount === 0 && (
                  <span style={{ fontSize: 12, color: t.textHint }}>
                    - 이메일을 입력하거나 CSV를 업로드하세요
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard title="본문 작성 및 에디터" t={t}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: t.textSec,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            제목 (Subject)
          </label>
          <input
            type="text"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="[Altos Funding] Your Funded Account Has Been Issued 🎉"
            style={{ ...inputStyle, flex: 1, minWidth: 200, boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button
              type="button"
              onClick={handlePreview}
              style={{
                height: 36,
                padding: '0 14px',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                border: `1px solid ${t.border2}`,
                background: t.surface2,
                color: t.textSec,
                fontFamily: "'Inter','DM Sans','Noto Sans KR',sans-serif",
                whiteSpace: 'nowrap',
              }}
            >
              👁 미리보기
            </button>
            <button
              type="button"
              onClick={toggleHtmlMode}
              style={{
                height: 36,
                padding: '0 14px',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                border: `1px solid ${htmlMode ? t.accent : t.border2}`,
                background: htmlMode ? t.accentBg : t.surface2,
                color: htmlMode ? t.accent : t.textSec,
                fontFamily: "'DM Mono',monospace",
                whiteSpace: 'nowrap',
              }}
            >
              &lt;/&gt; HTML 미리보기
            </button>
            <button
              type="button"
              onClick={handleSaveDraft}
              style={{
                height: 36,
                padding: '0 18px',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 700,
                border: 'none',
                background: t.accent,
                color: '#fff',
                fontFamily: "'Inter','DM Sans','Noto Sans KR',sans-serif",
              }}
            >
              저장
            </button>
          </div>
        </div>

        <div style={{ border: `1px solid ${t.border2}`, borderRadius: 10, overflow: 'hidden' }}>
          {htmlMode && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                background: dark ? '#0d1117' : '#f6f8fa',
                borderBottom: `1px solid ${t.border2}`,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: t.accent,
                  fontFamily: "'DM Mono',monospace",
                }}
              >
                HTML 편집 모드
              </span>
              <span style={{ fontSize: 11, color: t.textHint }}>
                편집 완료 후 &lt;/&gt; 버튼을 다시 클릭하면 비주얼 모드로 전환됩니다.
              </span>
              <div style={{ marginLeft: 'auto' }}>
                <button
                  type="button"
                  onClick={toggleHtmlMode}
                  style={{
                    height: 28,
                    padding: '0 12px',
                    borderRadius: 6,
                    border: `1px solid ${t.accent}`,
                    background: t.accentBg,
                    color: t.accent,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: "'DM Mono',monospace",
                  }}
                >
                  비주얼 모드로 전환
                </button>
              </div>
            </div>
          )}
          <div
            style={{
              display: htmlMode ? 'none' : 'block',
              background: dark ? '#1A2035' : '#ffffff',
            }}
          >
            <EmailTemplateEditor
              ref={editorRef}
              dark={dark}
              initialValue={editorInitialHtml}
              onImageUpload={(blob) =>
                uploadImageMutation.mutateAsync({
                  file: blob,
                  draftId: pendingDraft?.draft_id,
                })
              }
              mode="wysiwyg"
            />
          </div>
          {htmlMode && (
            <textarea
              ref={htmlTextareaRef}
              value={htmlSource}
              onChange={(event) => setHtmlSource(event.target.value)}
              spellCheck={false}
              rows={20}
              style={{
                width: '100%',
                padding: '18px 20px',
                display: 'block',
                background: dark ? '#0d1117' : '#f6f8fa',
                color: dark ? '#79c0ff' : '#24292f',
                border: 'none',
                outline: 'none',
                resize: 'vertical',
                fontSize: 12.5,
                fontFamily: "'DM Mono',monospace",
                lineHeight: 1.65,
                boxSizing: 'border-box',
              }}
            />
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '13px 16px',
              borderRadius: 10,
              cursor: 'pointer',
              transition: 'all 0.15s',
              border: `1px solid ${optMarketing && !optEmergency ? t.accentBd : t.border2}`,
              background: optMarketing && !optEmergency ? t.accentBg : t.surface2,
            }}
            onClick={() => {
              setOptMarketing(true);
              setOptEmergency(false);
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>📧</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>마케팅 메일</div>
                <div style={{ fontSize: 11, color: t.textHint, marginTop: 1 }}>
                  수신거부 링크 자동 포함 (법적 필수)
                </div>
              </div>
            </div>
            <ToggleSwitch
              on={optMarketing && !optEmergency}
              onChange={() => {
                setOptMarketing(true);
                setOptEmergency(false);
              }}
              dark={dark}
            />
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '13px 16px',
              borderRadius: 10,
              cursor: 'pointer',
              transition: 'all 0.15s',
              border: `1px solid ${optEmergency ? 'rgba(234,179,8,0.4)' : t.border2}`,
              background: optEmergency ? 'rgba(234,179,8,0.08)' : t.surface2,
            }}
            onClick={() => {
              setOptEmergency(true);
              setOptMarketing(false);
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>🔔</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>긴급/보안 공지</div>
                <div style={{ fontSize: 11, color: t.textHint, marginTop: 1 }}>
                  수신거부 링크 제외 - 보안·운영 공지 전용
                </div>
              </div>
            </div>
            <ToggleSwitch
              on={optEmergency}
              onChange={() => {
                setOptEmergency(true);
                setOptMarketing(false);
              }}
              dark={dark}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="발송 설정" t={t}>
        <div>
          <label style={labelStyle}>발송 시점</label>
          <div style={{ display: 'flex', gap: 16 }}>
            {(
              [
                ['immediate', '즉시 발송'],
                ['scheduled', '예약 발송'],
              ] as [DispatchTiming, string][]
            ).map(([value, label]) => (
              <label
                key={value}
                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
              >
                <input
                  type="radio"
                  checked={sendTiming === value}
                  onChange={() => setSendTiming(value)}
                  style={{ accentColor: t.accent, width: 15, height: 15, cursor: 'pointer' }}
                />
                <span
                  style={{
                    fontSize: 13,
                    color: t.text,
                    fontWeight: sendTiming === value ? 600 : 400,
                  }}
                >
                  {label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {sendTiming === 'scheduled' && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={labelStyle}>예약 날짜</label>
              <input
                type="date"
                value={schedDate}
                onChange={(event) => setSchedDate(event.target.value)}
                style={{ ...inputStyle, width: 160 }}
              />
            </div>
            <div>
              <label style={labelStyle}>예약 시간 (GMT+9)</label>
              <input
                type="time"
                value={schedTime}
                onChange={(event) => setSchedTime(event.target.value)}
                style={{ ...inputStyle, width: 130 }}
              />
            </div>
          </div>
        )}

        <div
          style={{
            padding: '12px 16px',
            borderRadius: 8,
            background: t.surface2,
            border: `1px solid ${t.border}`,
            fontSize: 13,
            color: t.textSec,
            lineHeight: 1.8,
          }}
        >
          <div>
            📬 발송 대상: <strong style={{ color: t.text }}>{targetCountLabel}</strong>
          </div>
          <div>
            📧 수신거부:{' '}
            <strong style={{ color: t.text }}>
              {optEmergency ? '미포함 (긴급/보안 공지)' : '포함 (마케팅 메일)'}
            </strong>
          </div>
          <div>
            ⏱ 발송 시점:{' '}
            <strong style={{ color: t.text }}>
              {sendTiming === 'immediate'
                ? '즉시 발송'
                : schedDate && schedTime
                  ? `${schedDate} ${schedTime} (GMT+9)`
                  : '예약 시각 미설정'}
            </strong>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={handleSend}
            style={{
              height: 42,
              padding: '0 36px',
              borderRadius: 10,
              border: 'none',
              background: t.accent,
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: "'Inter','DM Sans','Noto Sans KR',sans-serif",
            }}
          >
            {sendTiming === 'immediate' ? '발송하기' : '예약 등록'}
          </button>
        </div>
      </SectionCard>

      {showPreviewModal && (
        <div
          onClick={(event) => {
            if (event.target === event.currentTarget) setShowPreviewModal(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: 24,
          }}
        >
          <div
            style={{
              width: 640,
              maxHeight: '85vh',
              background: '#ffffff',
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: '0 32px 80px rgba(0,0,0,0.45)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                background: '#7C6AF7',
                padding: '18px 24px',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                flexShrink: 0,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.65)',
                    marginBottom: 4,
                    fontFamily: "'Inter',sans-serif",
                  }}
                >
                  미리보기 - 샘플 데이터 적용됨
                </div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: '#fff',
                    fontFamily: "'Inter',sans-serif",
                  }}
                >
                  {subject || '(제목 없음)'}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.6)',
                    marginTop: 4,
                    fontFamily: "'Inter',sans-serif",
                  }}
                >
                  보내는 사람: Altos Funding &lt;no-reply@altosfunding.com&gt;
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  borderRadius: '50%',
                  width: 30,
                  height: 30,
                  cursor: 'pointer',
                  color: '#fff',
                  fontSize: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>
            <div
              className="manual-email-preview-content"
              style={{
                overflowY: 'auto',
                flex: 1,
                padding: '28px 32px',
                background: '#ffffff',
                fontFamily: "'Inter',sans-serif",
                fontSize: 14,
                lineHeight: 1.85,
                color: '#1A1A1A',
              }}
              dangerouslySetInnerHTML={{
                __html:
                  getPreviewHtml() ||
                  "<p style='color:#9CA3AF;font-style:italic'>본문 내용이 없습니다.</p>",
              }}
            />
            {!optEmergency && (
              <div
                style={{
                  background: '#F4F5F7',
                  padding: '12px 24px',
                  textAlign: 'center',
                  fontSize: 11,
                  color: '#6B7280',
                  borderTop: '1px solid #E5E7EB',
                  flexShrink: 0,
                }}
              >
                이 이메일의 수신을 원하지 않으시면{' '}
                <span style={{ color: '#7C6AF7', textDecoration: 'underline', cursor: 'pointer' }}>
                  수신거부
                </span>
                를 클릭하세요.
              </div>
            )}
          </div>
        </div>
      )}

      {showConfirm && (
        <div
          onClick={(event) => {
            if (event.target === event.currentTarget) setShowConfirm(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: 24,
          }}
        >
          <div
            style={{
              width: 460,
              background: dark ? '#1A2035' : '#ffffff',
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: '0 32px 64px rgba(0,0,0,0.35)',
            }}
          >
            <div
              style={{
                background: 'rgba(220,38,38,0.08)',
                borderBottom: '1px solid rgba(220,38,38,0.2)',
                padding: '20px 28px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'rgba(220,38,38,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  flexShrink: 0,
                }}
              >
                ⚠️
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#DC2626' }}>
                  최종 발송 확인
                </div>
                <div style={{ fontSize: 12, color: t.textSec, marginTop: 2 }}>
                  이 작업은 실행 후 취소할 수 없습니다.
                </div>
              </div>
            </div>
            <div
              style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  color: t.text,
                  lineHeight: 1.7,
                  textAlign: 'center',
                }}
              >
                총{' '}
                <strong style={{ fontSize: 18, color: t.accent }}>
                  {targetCount.toLocaleString()}명
                </strong>
                에게
                <br />
                이메일을 발송하시겠습니까?
                <br />
                <span style={{ fontSize: 12, color: t.textHint }}>
                  이 작업은 취소할 수 없습니다.
                </span>
              </p>
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 8,
                  background: t.surface2,
                  border: `1px solid ${t.border}`,
                  fontSize: 12,
                  color: t.textSec,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                  제목: <strong style={{ color: t.text }}>{subject || '(제목 없음)'}</strong>
                </div>
                <div>
                  발송 시점:{' '}
                  <strong style={{ color: t.text }}>
                    {sendTiming === 'immediate' ? '즉시 발송' : `${schedDate} ${schedTime} (GMT+9)`}
                  </strong>
                </div>
                <div>
                  수신거부 링크:{' '}
                  <strong style={{ color: t.text }}>{optEmergency ? '미포함' : '포함'}</strong>
                </div>
              </div>
            </div>
            <div
              style={{
                padding: '16px 28px 24px',
                display: 'flex',
                gap: 10,
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                style={{
                  height: 38,
                  padding: '0 20px',
                  borderRadius: 8,
                  border: `1px solid ${t.border2}`,
                  background: 'transparent',
                  color: t.text,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: "'Inter','DM Sans','Noto Sans KR',sans-serif",
                }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                style={{
                  height: 38,
                  padding: '0 24px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#DC2626',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: "'Inter','DM Sans','Noto Sans KR',sans-serif",
                }}
              >
                발송 승인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
