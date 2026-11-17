import { X } from 'lucide-react';
import { useState } from 'react';
import { useListNotificationLogsQuery } from '../../queries/eventTemplates';
import { formatKstDateTime } from '../../utils/utils';

interface EmailBatchDetailModalProps {
  traceId: string;
  subject: string;
  templateName?: string | null;
  t: any;
  onClose: () => void;
  onSelectLog: (logId: number) => void;
}

const PAGE_SIZE = 20;
type StatusFilter = '' | 'SENT' | 'FAILED';

/** 여러 명에게 보낸 묶음(수동 발송 등)의 수신자별 결과. 줄을 누르면 한 통의 상세를 연다. */
export function EmailBatchDetailModal({
  traceId,
  subject,
  templateName,
  t,
  onClose,
  onSelectLog,
}: EmailBatchDetailModalProps) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>('');
  const { data, isLoading, isError } = useListNotificationLogsQuery({
    trace_id: traceId,
    status: status || undefined,
    page,
    page_size: PAGE_SIZE,
  });
  const items = data?.items ?? [];
  const summary = data?.summary;
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  const filterButton = (value: StatusFilter, label: string) => (
    <button
      type="button"
      onClick={() => {
        setStatus(value);
        setPage(1);
      }}
      style={{
        height: 28,
        padding: '0 12px',
        borderRadius: 9999,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        border: `1px solid ${status === value ? t.accent : t.border2}`,
        background: status === value ? t.accentBg : 'transparent',
        color: status === value ? t.accent : t.textSec,
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 720,
          maxWidth: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: t.surface,
          borderRadius: 16,
          border: `1px solid ${t.border}`,
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        }}
      >
        <div
          style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${t.border}`,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>묶음 발송 상세</div>
            <div style={{ marginTop: 4, fontSize: 12, color: t.textSec, wordBreak: 'break-all' }}>
              {templateName ? `${templateName} · ` : ''}
              {subject || '-'}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: t.textSec, display: 'flex' }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {filterButton('', `전체 ${summary && !status ? summary.total.toLocaleString() : ''}`.trim())}
          {filterButton('SENT', '성공')}
          {filterButton('FAILED', '실패')}
          {summary && !status && (
            <span style={{ marginLeft: 'auto', fontSize: 12, color: t.textSec }}>
              성공 <strong style={{ color: '#16A34A' }}>{summary.sent.toLocaleString()}</strong> · 실패{' '}
              <strong style={{ color: '#DC2626' }}>{summary.failed.toLocaleString()}</strong>
            </span>
          )}
        </div>

        <div style={{ padding: '0 24px', overflowY: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: t.surface2 }}>
                {['수신자', '언어', '상태', '발송일시'].map((h) => (
                  <th
                    key={h}
                    style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: t.textSec }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={4} style={{ padding: '24px 12px', fontSize: 13, color: t.textSec }}>
                    불러오는 중...
                  </td>
                </tr>
              )}
              {isError && (
                <tr>
                  <td colSpan={4} style={{ padding: '24px 12px', fontSize: 13, color: '#DC2626' }}>
                    수신자 목록을 불러오지 못했습니다.
                  </td>
                </tr>
              )}
              {!isLoading && !isError && items.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '24px 12px', fontSize: 13, color: t.textSec, textAlign: 'center' }}>
                    해당하는 수신자가 없습니다.
                  </td>
                </tr>
              )}
              {items.map((item) => {
                const failed = item.status === 'FAILED';
                return (
                  <tr
                    key={item.id ?? item.recipient}
                    onClick={() => item.id && onSelectLog(item.id)}
                    style={{ borderBottom: `1px solid ${t.border}`, cursor: item.id ? 'pointer' : 'default' }}
                  >
                    <td style={{ padding: '12px', fontSize: 13, color: t.text, wordBreak: 'break-all' }}>
                      {item.recipient ?? '-'}
                      {failed && item.error_message && (
                        <div style={{ marginTop: 4, fontSize: 11, color: '#DC2626' }}>{item.error_message}</div>
                      )}
                    </td>
                    <td style={{ padding: '12px', fontSize: 12, color: t.textSec }}>
                      {item.locale === 'ko' ? '한국어' : item.locale === 'en' ? 'English' : item.locale ?? '-'}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          padding: '3px 10px',
                          borderRadius: 9999,
                          fontSize: 11,
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          background: failed ? 'rgba(220,38,38,0.12)' : 'rgba(22,163,74,0.12)',
                          color: failed ? '#DC2626' : '#16A34A',
                        }}
                      >
                        {failed ? '실패' : '성공'}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '12px',
                        fontSize: 11,
                        color: t.textSec,
                        fontFamily: "'DM Mono',monospace",
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatKstDateTime(item.sent_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div
          style={{
            padding: '14px 24px',
            borderTop: `1px solid ${t.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 12,
            color: t.textSec,
          }}
        >
          <span>수신자를 누르면 한 통의 상세를 볼 수 있습니다.</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={{
                height: 28,
                padding: '0 10px',
                borderRadius: 6,
                border: `1px solid ${t.border2}`,
                background: t.surface2,
                color: t.text,
                cursor: page <= 1 ? 'default' : 'pointer',
                opacity: page <= 1 ? 0.5 : 1,
              }}
            >
              이전
            </button>
            <span>
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              style={{
                height: 28,
                padding: '0 10px',
                borderRadius: 6,
                border: `1px solid ${t.border2}`,
                background: t.surface2,
                color: t.text,
                cursor: page >= totalPages ? 'default' : 'pointer',
                opacity: page >= totalPages ? 0.5 : 1,
              }}
            >
              다음
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
