import { VipEntry } from '../../types/leaderboard';
import { formatSignedPercent, formatSignedUsdMoney } from '../../utils/utils';

interface VipPromotePanelProps {
  dark: boolean;
  selectedEntries: VipEntry[];
  approvedCount: number;
  notApprovedCount: number;
  onApprove: () => void;
  onClearSelection: () => void;
}

export function VipPromotePanel({
  dark,
  selectedEntries,
  approvedCount,
  notApprovedCount,
  onApprove,
  onClearSelection,
}: VipPromotePanelProps) {
  const t = {
    surface: dark ? '#0F1829' : '#ffffff',
    surface2: dark ? '#1A2035' : '#F4F5F7',
    border: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)',
    text: dark ? '#E8EAF0' : '#1A1A1A',
    textSec: dark ? '#8B8FA8' : '#4A4A58',
    textHint: dark ? '#5A6080' : '#A0A0AA',
  };

  // Filter to only show non-approved entries
  const additionalEntries = selectedEntries.filter((e) => e.approvalStatus !== 'approved');
  const hasApprovals = approvedCount > 0;

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
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          background: dark ? 'rgba(217,119,6,0.12)' : 'rgba(217,119,6,0.08)',
          borderBottom: `1px solid ${t.border}`,
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: t.text,
            marginBottom: 4,
          }}
        >
          VIP 달성자
        </div>
        <div style={{ fontSize: 11, color: t.textSec }}>수익 목표를 달성한 계좌</div>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          padding: '12px',
          overflowY: 'auto',
          maxHeight: 400,
        }}
      >
        {hasApprovals ? (
          <>
            {/* Summary Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              <div
                style={{
                  padding: '12px',
                  background: 'rgba(217,119,6,0.08)',
                  borderRadius: 8,
                  border: '1px solid rgba(217,119,6,0.2)',
                }}
              >
                <div style={{ fontSize: 11, color: '#D97706', marginBottom: 4 }}>★ 승격 완료</div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 600,
                    color: '#D97706',
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  {approvedCount}명
                </div>
              </div>
              <div
                style={{
                  padding: '12px',
                  background: t.surface2,
                  borderRadius: 8,
                  border: `1px solid ${t.border}`,
                }}
              >
                <div style={{ fontSize: 11, color: t.textSec, marginBottom: 4 }}>— 미승격</div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 600,
                    color: t.textSec,
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  {notApprovedCount}명
                </div>
              </div>
            </div>

            {/* Additional Selection */}
            {additionalEntries.length > 0 ? (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: t.textSec, marginBottom: 8 }}>
                  추가 선택 ({additionalEntries.length}명)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {additionalEntries.map((entry) => (
                    <div
                      key={entry.id}
                      style={{
                        padding: '12px',
                        background: t.surface2,
                        borderRadius: 8,
                        border: `1px solid ${t.border}`,
                      }}
                    >
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
              </>
            ) : (
              <div
                style={{
                  textAlign: 'center',
                  padding: '20px',
                  color: t.textHint,
                  fontSize: 12,
                }}
              >
                추가 선택된 계좌가 없습니다
              </div>
            )}
          </>
        ) : (
          <>
            {selectedEntries.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: t.textHint,
                  fontSize: 13,
                }}
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
                    <div
                      style={{
                        fontSize: 11,
                        color: t.textSec,
                        marginBottom: 4,
                      }}
                    >
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
                      {formatSignedUsdMoney(entry.profit)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '16px',
          borderTop: `1px solid ${t.border}`,
        }}
      >
        {hasApprovals ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={onApprove}
              disabled={additionalEntries.length === 0}
              style={{
                width: '100%',
                height: 36,
                borderRadius: 8,
                border: 'none',
                background: additionalEntries.length === 0 ? t.surface2 : '#D97706',
                color: additionalEntries.length === 0 ? t.textSec : '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: additionalEntries.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              VIP 승격 승인 ({additionalEntries.length}명 발급)
            </button>
            <button
              onClick={onClearSelection}
              style={{
                width: '100%',
                height: 32,
                borderRadius: 8,
                border: `1px solid ${t.border}`,
                background: 'transparent',
                color: t.textSec,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              전체 선택 취소
            </button>
          </div>
        ) : (
          <>
            <div
              style={{
                fontSize: 11,
                color: t.textHint,
                marginBottom: 12,
                textAlign: 'center',
              }}
            >
              선택된 계좌: {selectedEntries.length}명
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
                  background: selectedEntries.length === 0 ? t.surface2 : '#D97706',
                  color: selectedEntries.length === 0 ? t.textSec : '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: selectedEntries.length === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                VIP 승격 승인 ({selectedEntries.length}명)
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
            </div>
          </>
        )}
      </div>
    </div>
  );
}
