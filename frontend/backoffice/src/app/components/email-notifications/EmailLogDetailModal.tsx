import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useGetNotificationLogQuery } from '../../queries/eventTemplates';
import { formatKstDateTime } from '../../utils/utils';

interface EmailLogDetailModalProps {
  logId: number;
  t: any;
  templateName?: string;
  onClose: () => void;
}

const LOCALE_LABELS: Record<string, string> = { en: 'English', ko: '한국어' };

/** 발송 이력 한 건의 상세. 본문·인증코드 같은 변수는 서버에 저장하지 않으므로 보여 주지 않는다. */
export function EmailLogDetailModal({ logId, t, templateName, onClose }: EmailLogDetailModalProps) {
  const { data: log, isLoading, isError } = useGetNotificationLogQuery(logId);

  const row = (label: string, value: ReactNode) => (
    <div style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: `1px solid ${t.border}` }}>
      <div style={{ width: 120, flexShrink: 0, fontSize: 12, color: t.textSec }}>{label}</div>
      <div style={{ flex: 1, fontSize: 13, color: t.text, wordBreak: 'break-all' }}>{value}</div>
    </div>
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
          width: 560,
          maxWidth: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
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
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>발송 이력 상세</div>
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: t.textSec, display: 'flex' }}
          >
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: '8px 24px 20px' }}>
          {isLoading && <div style={{ padding: '24px 0', fontSize: 13, color: t.textSec }}>불러오는 중...</div>}
          {isError && (
            <div style={{ padding: '24px 0', fontSize: 13, color: '#DC2626' }}>발송 이력을 불러오지 못했습니다.</div>
          )}
          {log && (
            <>
              {row(
                '상태',
                <span
                  style={{
                    display: 'inline-flex',
                    padding: '3px 10px',
                    borderRadius: 9999,
                    fontSize: 11,
                    fontWeight: 600,
                    background: log.status === 'FAILED' ? 'rgba(220,38,38,0.12)' : 'rgba(22,163,74,0.12)',
                    color: log.status === 'FAILED' ? '#DC2626' : '#16A34A',
                  }}
                >
                  {log.status === 'FAILED' ? '실패' : '성공'}
                </span>,
              )}
              {log.status === 'FAILED' && row('실패 사유', <span style={{ color: '#DC2626' }}>{log.error_message || '-'}</span>)}
              {row('발송일시', formatKstDateTime(log.sent_at))}
              {row('수신자', log.recipient || '-')}
              {row('회원 UID', log.user_uid || '-')}
              {row('템플릿', `${log.template_name ?? templateName ?? '-'} (${log.event_type})`)}
              {row('제목', log.subject || '-')}
              {row('언어', log.locale ? LOCALE_LABELS[log.locale] ?? log.locale : '-')}
              {row('발송 방식', log.provider === 'ses' ? 'AWS SES' : log.provider === 'console' ? '로그만 기록 (실제 발송 안 함)' : log.provider ?? '-')}
              {row('메시지 ID', log.provider_message_id || '-')}
              <div style={{ marginTop: 14, fontSize: 11, color: t.textHint }}>
                보안을 위해 메일 본문과 인증코드·링크 같은 내용은 저장하지 않습니다.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
