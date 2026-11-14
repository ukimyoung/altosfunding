import { RankEntry } from '../../types/leaderboard';
import { formatSignedPercent } from '../../utils/utils';

interface NormalPromotePanelProps {
  dark: boolean;
  selectedEntries: RankEntry[];
  approvedCount: number;
  notApprovedCount: number;
  onApprove: () => void;
  onMarkFailed: () => void;
  onClearSelection: () => void;
  isClosed: boolean;
}

export function NormalPromotePanel({
  dark,
  selectedEntries,
  approvedCount,
  notApprovedCount,
  onApprove,
  onMarkFailed,
  onClearSelection,
  isClosed,
}: NormalPromotePanelProps) {
  const t = {
    surface: dark ? '#0F1829' : '#ffffff',
    surface2: dark ? '#1A2035' : '#F4F5F7',
    border: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)',
    text: dark ? '#E8EAF0' : '#1A1A1A',
    textSec: dark ? '#8B8FA8' : '#4A4A58',
    textHint: dark ? '#5A6080' : '#A0A0AA',
  };

  const hasApprovals = approvedCount > 0;
  const newSelectionCount = selectedEntries.filter(
    (e) => e.approvalStatus !== 'approved' && e.approvalStatus !== 'failed',
  ).length;

  // State 3: Closed
  if (isClosed) {
    return (
      <div
        style={{
          width: 280,
          background: t.surface,
          borderRadius: 12,
          border: `1px solid ${t.border}`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            background: dark ? 'rgba(59,109,17,0.12)' : 'rgba(59,109,17,0.08)',
            borderBottom: `1px solid ${t.border}`,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 4 }}>
            최종 결과
          </div>
        </div>
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              padding: '12px',
              borderRadius: 8,
              background: 'rgba(22,163,74,0.1)',
              border: '1px solid rgba(22,163,74,0.2)',
            }}
          >
            <div style={{ fontSize: 11, color: '#16A34A', marginBottom: 4 }}>● 승격 완료</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#16A34A' }}>{approvedCount}명</div>
          </div>
          <div
            style={{
              padding: '12px',
              borderRadius: 8,
              background: 'rgba(113,113,122,0.1)',
              border: '1px solid rgba(113,113,122,0.2)',
            }}
          >
            <div style={{ fontSize: 11, color: '#71717A', marginBottom: 4 }}>— 미승격</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#71717A' }}>
              {notApprovedCount}명
            </div>
          </div>
        </div>
      </div>
    );
  }

  // State 2: After partial approval
  if (hasApprovals) {
    return (
      <div
        style={{
          width: 280,
          background: t.surface,
          borderRadius: 12,
          border: `1px solid ${t.border}`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              padding: '12px',
              borderRadius: 8,
              background: 'rgba(22,163,74,0.1)',
              border: '1px solid rgba(22,163,74,0.2)',
            }}
          >
            <div style={{ fontSize: 11, color: '#16A34A', marginBottom: 4 }}>● 승격 완료</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#16A34A' }}>{approvedCount}명</div>
          </div>
          <div
            style={{
              padding: '12px',
              borderRadius: 8,
              background: 'rgba(113,113,122,0.1)',
              border: '1px solid rgba(113,113,122,0.2)',
            }}
          >
            <div style={{ fontSize: 11, color: '#71717A', marginBottom: 4 }}>— 미승격</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#71717A' }}>
              {notApprovedCount}명
            </div>
          </div>
        </div>

        <div style={{ padding: '0 16px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 12 }}>
            추가 선택 ({newSelectionCount}명)
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 12 }}>
            {newSelectionCount === 0 ? (
              <div
                style={{ textAlign: 'center', padding: '20px', color: t.textHint, fontSize: 12 }}
              >
                추가 선택된 계좌가 없습니다
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedEntries
                  .filter((e) => e.approvalStatus !== 'approved' && e.approvalStatus !== 'failed')
                  .map((entry) => (
                    <div
                      key={entry.id}
                      style={{
                        padding: '10px',
                        background: t.surface2,
                        borderRadius: 8,
                        border: `1px solid ${t.border}`,
                      }}
                    >
                      <div style={{ fontSize: 11, color: t.textSec, marginBottom: 2 }}>
                        {entry.rank}위
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          color: t.text,
                          fontFamily: "'DM Mono', monospace",
                          marginBottom: 2,
                        }}
                      >
                        {entry.accountNumber}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: entry.profit > 0 ? '#16A34A' : entry.profit < 0 ? '#DC2626' : t.textSec,
                          fontFamily: "'DM Mono', monospace",
                        }}
                      >
                        {formatSignedPercent(entry.profitRate)}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={onApprove}
              disabled={newSelectionCount === 0}
              style={{
                width: '100%',
                height: 36,
                borderRadius: 8,
                border: 'none',
                background: newSelectionCount === 0 ? t.surface2 : '#16A34A',
                color: newSelectionCount === 0 ? t.textSec : '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: newSelectionCount === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              최종 승인 ({newSelectionCount}명 발급)
            </button>
            <button
              onClick={onClearSelection}
              disabled={newSelectionCount === 0}
              style={{
                width: '100%',
                height: 32,
                borderRadius: 8,
                border: `1px solid ${t.border}`,
                background: 'transparent',
                color: t.textSec,
                fontSize: 12,
                fontWeight: 500,
                cursor: newSelectionCount === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              전체 선택 취소
            </button>
            <button
              onClick={onMarkFailed}
              disabled={newSelectionCount === 0}
              style={{
                width: '100%',
                height: 36,
                borderRadius: 8,
                border: `1px solid ${newSelectionCount === 0 ? t.border : 'rgba(220,38,38,0.35)'}`,
                background: newSelectionCount === 0 ? 'transparent' : 'rgba(220,38,38,0.06)',
                color: newSelectionCount === 0 ? t.textHint : '#DC2626',
                fontSize: 13,
                fontWeight: 600,
                cursor: newSelectionCount === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              불합격 처리 ({newSelectionCount}명)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // State 1: Before any approval
  return (
    <div
      style={{
        width: 280,
        background: t.surface,
        borderRadius: 12,
        border: `1px solid ${t.border}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '16px 20px',
          background: dark ? 'rgba(59,109,17,0.12)' : 'rgba(59,109,17,0.08)',
          borderBottom: `1px solid ${t.border}`,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 4 }}>
          승격 대상 목록
        </div>
        <div style={{ fontSize: 11, color: t.textSec }}>체크된 계좌에 펀디드 발급</div>
      </div>

      <div style={{ flex: 1, padding: '12px', overflowY: 'auto', maxHeight: 400 }}>
        {selectedEntries.length === 0 ? (
          <div
            style={{ textAlign: 'center', padding: '40px 20px', color: t.textHint, fontSize: 13 }}
          >
            선택된 계좌가 없습니다
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {selectedEntries.map((entry) => (
              <div
                key={entry.id}
                style={{
                  padding: '12px',
                  background: t.surface2,
                  borderRadius: 8,
                  border: `1px solid ${t.border}`,
                }}
              >
                <div style={{ fontSize: 11, color: t.textSec, marginBottom: 4 }}>
                  {entry.rank}위
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: t.text,
                    fontFamily: "'DM Mono', monospace",
                    marginBottom: 4,
                  }}
                >
                  {entry.accountNumber}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: entry.profit > 0 ? '#16A34A' : entry.profit < 0 ? '#DC2626' : t.textSec,
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  {formatSignedPercent(entry.profitRate)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: '16px', borderTop: `1px solid ${t.border}` }}>
        <div style={{ fontSize: 11, color: t.textHint, marginBottom: 12, textAlign: 'center' }}>
          승인 후 펀디드 계좌가 자동 발급됩니다
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={onApprove}
            disabled={selectedEntries.length === 0}
            style={{
              width: '100%',
              height: 36,
              borderRadius: 8,
              border: 'none',
              background: selectedEntries.length === 0 ? t.surface2 : '#16A34A',
              color: selectedEntries.length === 0 ? t.textSec : '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: selectedEntries.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            최종 승인 ({selectedEntries.length}명 발급)
          </button>
          <button
            onClick={onClearSelection}
            disabled={selectedEntries.length === 0}
            style={{
              width: '100%',
              height: 32,
              borderRadius: 8,
              border: `1px solid ${t.border}`,
              background: 'transparent',
              color: t.textSec,
              fontSize: 12,
              fontWeight: 500,
              cursor: selectedEntries.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            전체 선택 취소
          </button>
          <button
            onClick={onMarkFailed}
            disabled={selectedEntries.length === 0}
            style={{
              width: '100%',
              height: 36,
              borderRadius: 8,
              border: `1px solid ${selectedEntries.length === 0 ? t.border : 'rgba(220,38,38,0.35)'}`,
              background: selectedEntries.length === 0 ? 'transparent' : 'rgba(220,38,38,0.06)',
              color: selectedEntries.length === 0 ? t.textHint : '#DC2626',
              fontSize: 13,
              fontWeight: 600,
              cursor: selectedEntries.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            불합격 처리 ({selectedEntries.length}명)
          </button>
        </div>
      </div>
    </div>
  );
}
