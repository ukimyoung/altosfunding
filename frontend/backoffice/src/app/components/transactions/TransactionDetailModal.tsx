import { useState } from 'react';
import { X, Copy } from 'lucide-react';
import type { WalletTransaction } from '../../../api/wallet';
import { REJECT_REASONS } from '../../constants/status';
import { Toast } from '../shared/Toast';
import { copyTextToClipboard, formatKstDateTime, formatUsdMoney } from '../../utils/utils';
import { getWalletStatusBadge } from '../../utils/walletDisplay';

interface TransactionDetailModalProps {
  transfer: WalletTransaction;
  dark: boolean;
  mode: 'readonly' | 'approval';
  onClose: () => void;
  onApprove?: (requestId: string | number, txHash?: string) => void | Promise<void>;
  onReject?: (requestId: string | number, reason: string) => void | Promise<void>;
}

export function TransactionDetailModal({
  transfer,
  dark,
  mode,
  onClose,
  onApprove,
  onReject,
}: TransactionDetailModalProps) {
  const [showRejectSection, setShowRejectSection] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [txHashInput, setTxHashInput] = useState(transfer.tx_hash ?? '');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);

  const t = {
    surface: dark ? '#0F1829' : '#ffffff',
    surface2: dark ? '#1A2035' : '#F4F5F7',
    border: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)',
    text: dark ? '#E8EAF0' : '#1A1A1A',
    textSec: dark ? '#8B8FA8' : '#4A4A58',
    textHint: dark ? '#5A6080' : '#A0A0AA',
    accent: '#7C6AF7',
  };

  const typeBadge = {
    Reward: { bg: 'rgba(22,163,74,0.1)', color: '#16A34A', border: 'rgba(22,163,74,0.2)' },
    'External Wallet': {
      bg: 'rgba(217,119,6,0.1)',
      color: '#D97706',
      border: 'rgba(217,119,6,0.2)',
    },
    Payout: { bg: 'rgba(37,99,235,0.1)', color: '#2563EB', border: 'rgba(37,99,235,0.2)' },
    'Live Trading Account': {
      bg: 'rgba(220,38,38,0.1)',
      color: '#DC2626',
      border: 'rgba(220,38,38,0.2)',
    },
  }[transfer.display_tx_type] || {
    bg: 'rgba(255,255,255,0.08)',
    color: '#8B8FA8',
    border: 'rgba(255,255,255,0.08)',
  };

  const statusLabel = transfer.display_status ?? transfer.status;
  const statusBadge = getWalletStatusBadge(statusLabel);

  const isWithdrawal = transfer.direction === 'OUT';
  const showExternalWalletWithdrawalBreakdown =
    isWithdrawal && transfer.display_tx_type === 'External Wallet';
  const withdrawalAmount = Math.abs(transfer.amount);
  const withdrawalFee = Math.abs(transfer.fee);
  const withdrawalNetAmount = withdrawalAmount - withdrawalFee;
  const shouldShowTxHash = transfer.source !== 'PAYOUT_REQ';
  const requiresTxHash = isWithdrawal && transfer.source !== 'PAYOUT_REQ';
  const txHashValue = requiresTxHash ? txHashInput : (transfer.tx_hash ?? '');
  const txHashBadge = requiresTxHash
    ? {
        label: '어드민 입력 필요',
        bg: 'rgba(217,119,6,0.1)',
        color: '#D97706',
        border: 'rgba(217,119,6,0.2)',
      }
    : {
        label: '유저 입력값',
        bg: 'rgba(124,106,247,0.12)',
        color: '#7C6AF7',
        border: 'rgba(124,106,247,0.2)',
      };

  const handleCopyTxid = async () => {
    if (txHashValue) {
      const copied = await copyTextToClipboard(txHashValue);
      setToast({
        message: copied ? '복사되었습니다' : '복사에 실패했습니다',
        type: copied ? 'success' : 'warning',
      });
    }
  };

  const handleApproveClick = () => {
    if (mode === 'approval') {
      setShowApproveConfirm(true);
    }
  };

  const handleRejectClick = () => {
    setShowRejectSection(true);
  };

  const handleCancelReject = () => {
    setShowRejectSection(false);
    setRejectReason('');
    setCustomReason('');
  };

  const isRejectConfirmDisabled =
    !rejectReason || (rejectReason === '직접 입력' && !customReason.trim());

  const isApproveConfirmDisabled = mode === 'approval' && requiresTxHash && !txHashInput.trim();

  const handleConfirmApprove = () => {
    setShowApproveConfirm(false);
    void onApprove?.(transfer.id, requiresTxHash ? txHashInput.trim() : undefined);
  };

  const handleConfirmReject = () => {
    if (!rejectReason || (rejectReason === '직접 입력' && !customReason.trim())) {
      return;
    }
    setShowRejectConfirm(false);
    void onReject?.(transfer.id, rejectReason === '직접 입력' ? customReason : rejectReason);
  };

  if (showApproveConfirm) {
    return (
      <div
        onClick={() => setShowApproveConfirm(false)}
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
          zIndex: 1001,
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: t.surface,
            borderRadius: 12,
            width: 400,
            padding: 24,
            border: `1px solid ${t.border}`,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 12 }}>
            입출금 승인
          </div>
          <div style={{ fontSize: 13, color: t.textSec, lineHeight: 1.6, marginBottom: 24 }}>
            해당 입출금 요청을 승인하시겠습니까?
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setShowApproveConfirm(false)}
              style={{
                height: 36,
                padding: '0 16px',
                borderRadius: 8,
                border: 'none',
                background: t.surface2,
                color: t.textSec,
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              취소
            </button>
            <button
              onClick={handleConfirmApprove}
              disabled={isApproveConfirmDisabled}
              style={{
                height: 36,
                padding: '0 16px',
                borderRadius: 8,
                border: 'none',
                background: isApproveConfirmDisabled ? t.surface2 : '#16A34A',
                color: isApproveConfirmDisabled ? t.textSec : '#fff',
                fontSize: 13,
                fontWeight: 500,
                cursor: isApproveConfirmDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              승인 확정
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showRejectConfirm) {
    return (
      <div
        onClick={() => setShowRejectConfirm(false)}
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
          zIndex: 1001,
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: t.surface,
            borderRadius: 12,
            width: 400,
            padding: 24,
            border: `1px solid ${t.border}`,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 12 }}>
            입출금 반려
          </div>
          <div style={{ fontSize: 13, color: t.textSec, lineHeight: 1.6, marginBottom: 24 }}>
            해당 입출금 요청을 반려하시겠습니까?
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setShowRejectConfirm(false)}
              style={{
                height: 36,
                padding: '0 16px',
                borderRadius: 8,
                border: 'none',
                background: t.surface2,
                color: t.textSec,
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              취소
            </button>
            <button
              onClick={handleConfirmReject}
              style={{
                height: 36,
                padding: '0 16px',
                borderRadius: 8,
                border: 'none',
                background: '#DC2626',
                color: '#fff',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              반려 확정
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClose}
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
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: t.surface,
          borderRadius: 12,
          width: 560,
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: `1px solid ${t.border}`,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${t.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 600, color: t.text }}>입출금 상세</span>
          <button
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: 'none',
              background: t.surface2,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: t.textSec,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {/* User Info Card */}
          <div
            style={{
              padding: 16,
              borderRadius: 8,
              background: t.surface2,
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 11, color: t.textSec, marginBottom: 8 }}>유저 정보</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: t.text, marginBottom: 4 }}>
              {transfer.user_nickname}
            </div>
            <div style={{ fontSize: 12, color: t.textHint }}>{transfer.user_email}</div>
          </div>

          {/* Amount Cards */}
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}
          >
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: transfer.direction === 'IN' ? 'rgba(22,163,74,0.1)' : t.surface2,
                border:
                  transfer.direction === 'IN'
                    ? '1px solid rgba(22,163,74,0.2)'
                    : `1px solid ${t.border}`,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: transfer.direction === 'IN' ? '#16A34A' : t.textSec,
                  marginBottom: 4,
                }}
              >
                입금
              </div>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 600,
                  color: transfer.direction === 'IN' ? '#16A34A' : t.textHint,
                  fontFamily: "'DM Mono', monospace",
                }}
              >
                {transfer.direction === 'IN' ? formatUsdMoney(transfer.amount) : '—'}
              </div>
            </div>
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: transfer.direction === 'OUT' ? 'rgba(220,38,38,0.1)' : t.surface2,
                border:
                  transfer.direction === 'OUT'
                    ? '1px solid rgba(220,38,38,0.2)'
                    : `1px solid ${t.border}`,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: transfer.direction === 'OUT' ? '#DC2626' : t.textSec,
                  marginBottom: 4,
                }}
              >
                출금
              </div>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 600,
                  color: transfer.direction === 'OUT' ? '#DC2626' : t.textHint,
                  fontFamily: "'DM Mono', monospace",
                  textAlign: 'left',
                }}
              >
                {transfer.direction === 'OUT'
                  ? `-${formatUsdMoney(withdrawalAmount)}`
                  : '—'}
              </div>
              {showExternalWalletWithdrawalBreakdown && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 12,
                    marginTop: 10,
                    paddingTop: 10,
                    borderTop: '1px solid rgba(220,38,38,0.2)',
                  }}
                >
                  <div>
                    <div style={{ marginBottom: 5, fontSize: 10, color: t.textSec }}>수수료</div>
                    <div
                      style={{
                        fontSize: 11,
                        color: '#DC2626',
                        fontFamily: "'DM Mono', monospace",
                      }}
                    >
                      -{formatUsdMoney(withdrawalFee)}
                    </div>
                  </div>
                  <div>
                    <div style={{ marginBottom: 5, fontSize: 10, color: t.textSec }}>실수령액</div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: t.text,
                        fontFamily: "'DM Mono', monospace",
                      }}
                    >
                      {formatUsdMoney(withdrawalNetAmount)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Detail Fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
            <DetailField label="유형" value={transfer.display_tx_type} badge={typeBadge} t={t} />
            <DetailField label="출처 계좌" value={transfer.source_account || '—'} t={t} />
            {shouldShowTxHash && (
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: t.textSec,
                    marginBottom: 4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>TXID</span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '2px 8px',
                      borderRadius: 9999,
                      fontSize: 10,
                      fontWeight: 600,
                      background: txHashBadge.bg,
                      color: txHashBadge.color,
                      border: `1px solid ${txHashBadge.border}`,
                    }}
                  >
                    {txHashBadge.label}
                  </span>
                </div>
                {requiresTxHash && mode === 'approval' ? (
                  <input
                    type="text"
                    value={txHashInput}
                    onChange={(e) => setTxHashInput(e.target.value)}
                    placeholder="송금 완료 후 TXID를 입력하세요"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: `1px solid ${t.border}`,
                      background: t.surface2,
                      color: t.text,
                      fontSize: 12,
                      fontFamily: "'DM Mono', monospace",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: t.surface2,
                    }}
                  >
                    <span
                      style={{
                        flex: 1,
                        fontSize: 12,
                        color: txHashValue ? t.text : t.textHint,
                        fontFamily: "'DM Mono', monospace",
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {txHashValue || '—'}
                    </span>
                    {txHashValue && (
                      <button
                        onClick={() => void handleCopyTxid()}
                        style={{
                          padding: 6,
                          borderRadius: 6,
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          color: t.textHint,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <Copy size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            <DetailField label="상태" value={statusLabel} badge={statusBadge} t={t} />
            {transfer.reject_reason && (
              <DetailField label="반려 사유" value={transfer.reject_reason} t={t} />
            )}
            <DetailField label="네트워크" value={transfer.network || '—'} t={t} />
            <DetailField label="지갑 주소" value={transfer.wallet_address || '—'} t={t} mono />
            <DetailField label="일시" value={formatKstDateTime(transfer.created_at)} t={t} />
          </div>

          {/* Reject Section (Approval mode only) */}
          {mode === 'approval' && showRejectSection && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 12 }}>
                반려 사유 선택 <span style={{ color: '#DC2626' }}>*</span>
              </div>
              <select
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                style={{
                  width: '100%',
                  height: 36,
                  padding: '0 12px',
                  borderRadius: 8,
                  border: `1px solid ${t.border}`,
                  background: t.surface2,
                  color: t.text,
                  fontSize: 13,
                  marginBottom: 12,
                }}
              >
                <option value="">사유를 선택하세요</option>
                {REJECT_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              {rejectReason === '직접 입력' && (
                <textarea
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="반려 사유를 입력하세요"
                  rows={3}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: `1px solid ${t.border}`,
                    background: t.surface2,
                    color: t.text,
                    fontSize: 13,
                    fontFamily: "'Noto Sans KR', sans-serif",
                    resize: 'vertical',
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: `1px solid ${t.border}`,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <button
            onClick={onClose}
            style={{
              height: 36,
              padding: '0 16px',
              borderRadius: 8,
              border: `1px solid ${t.border}`,
              background: 'transparent',
              color: t.textSec,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            닫기
          </button>

          {mode === 'approval' && !showRejectSection && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleRejectClick}
                style={{
                  height: 36,
                  padding: '0 16px',
                  borderRadius: 8,
                  border: '1px solid #DC2626',
                  background: 'transparent',
                  color: '#DC2626',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                반려
              </button>
              <button
                onClick={handleApproveClick}
                disabled={isApproveConfirmDisabled}
                style={{
                  height: 36,
                  padding: '0 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: isApproveConfirmDisabled ? t.surface2 : '#16A34A',
                  color: isApproveConfirmDisabled ? t.textSec : '#fff',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: isApproveConfirmDisabled ? 'not-allowed' : 'pointer',
                }}
              >
                승인
              </button>
            </div>
          )}

          {mode === 'approval' && showRejectSection && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleCancelReject}
                style={{
                  height: 36,
                  padding: '0 16px',
                  borderRadius: 8,
                  border: `1px solid ${t.border}`,
                  background: 'transparent',
                  color: t.textSec,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                취소
              </button>
              <button
                onClick={() => setShowRejectConfirm(true)}
                disabled={isRejectConfirmDisabled}
                style={{
                  height: 36,
                  padding: '0 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: isRejectConfirmDisabled ? t.surface2 : '#DC2626',
                  color: isRejectConfirmDisabled ? t.textSec : '#fff',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: isRejectConfirmDisabled ? 'not-allowed' : 'pointer',
                }}
              >
                반려 확정
              </button>
            </div>
          )}
        </div>
      </div>
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

function DetailField({
  label,
  value,
  badge,
  t,
  mono,
}: {
  label: string;
  value: string;
  badge?: { bg: string; color: string; border: string };
  t: any;
  mono?: boolean;
}) {
  return (
    <div>
      <div style={{ fontSize: 11, color: t.textSec, marginBottom: 4 }}>{label}</div>
      {badge ? (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '4px 10px',
            borderRadius: 9999,
            fontSize: 11,
            fontWeight: 600,
            background: badge.bg,
            color: badge.color,
            border: `1px solid ${badge.border}`,
          }}
        >
          {value}
        </span>
      ) : (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            background: t.surface2,
            fontSize: 13,
            color: t.text,
            fontFamily: mono ? "'DM Mono', monospace" : 'inherit',
            wordBreak: mono ? 'break-all' : 'normal',
          }}
        >
          {value}
        </div>
      )}
    </div>
  );
}
