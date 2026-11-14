import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useSearchParams } from 'react-router';
import type { AxiosError } from 'axios';
import type {
  AdminReferralReward,
  AdminTradingBonus,
  ReferralRewardCondition,
  RewardStatus,
} from '@/api/reward';
import { Toast } from '../../components/shared/Toast';
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
import { useAppShell } from '../../layouts/AppShell';
import {
  useApproveReferralRewardMutation,
  useApproveTradingBonusMutation,
  useReferralRewardStatsQuery,
  useReferralRewardsQuery,
  useRejectReferralRewardMutation,
  useRejectTradingBonusMutation,
  useRewardPolicyQuery,
  useTradingBonusesQuery,
  useTradingBonusStatsQuery,
  useUpdateRewardPolicyMutation,
} from '../../queries/rewards';
import { formatKstDateTime } from '../../utils/utils';

type TabType = 'referral' | 'trading' | 'settings';
type PaymentStatus = '대기' | '지급완료' | '반려';
type PaymentStatusDisplay = PaymentStatus | null;
type RewardStatusFilter = RewardStatus | '전체';
type RewardItemKind = 'reward' | 'bonus';
type RewardModalState = {
  type: 'approval' | 'reject' | 'ineligible';
  itemKind: RewardItemKind;
  itemId?: number;
} | null;
type ToastState = {
  message: string;
  type: 'success' | 'warning';
};

const PAGE_SIZE = 20;
const REWARD_STATUS_VALUES: RewardStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];

const parsePageParam = (value: string | null) => {
  const page = Number(value ?? '1');

  return Number.isInteger(page) && page > 0 ? page : 1;
};

interface ReferralReward {
  id: number;
  referrer: string;
  referrerEmail: string;
  referralCode: string;
  referee: string;
  refereeEmail: string;
  payoutDate: string | null;
  reward: string;
  status: PaymentStatusDisplay;
  rejectionReason: string | null;
}

interface TradingBonus {
  id: number;
  userName: string;
  userEmail: string;
  accountNumber: string;
  traderProfit: string;
  baseDistribution: string;
  bonusRate: string;
  actualBonus: string;
  status: PaymentStatusDisplay;
  rejectionReason: string | null;
}

const REJECT_REASONS = [
  '챌린지 구매 이력 없음',
  '자기 추천(어뷰징) 의심',
  '조건 미충족',
  '중복 적립',
  '직접 입력',
];

const getRewardItemLabel = (itemKind: RewardItemKind) =>
  itemKind === 'bonus' ? '보너스' : '리워드';

const toRewardStatusFilter = (status: string | null): RewardStatusFilter => {
  if (!status) return '전체';
  if (REWARD_STATUS_VALUES.includes(status as RewardStatus)) return status as RewardStatus;
  if (status === '대기') return 'PENDING';
  if (status === '지급완료') return 'APPROVED';
  if (status === '반려') return 'REJECTED';
  return '전체';
};

const toRewardStatusParam = (status: RewardStatusFilter): RewardStatus | null => {
  if (status === '전체') return null;
  return status;
};

const toRewardStatusLabel = (status: RewardStatusFilter): string => {
  if (status === 'PENDING') return '대기';
  if (status === 'APPROVED') return '지급완료';
  if (status === 'REJECTED') return '반려';
  return '지급 상태: 전체';
};

const toPaymentStatus = (
  status: RewardStatus | string | null | undefined,
): PaymentStatusDisplay => {
  if (status === 'PENDING') return '대기';
  if (status === 'APPROVED') return '지급완료';
  if (status === 'REJECTED') return '반려';
  return null;
};

const formatMoney = (value: number | string | null | undefined, currency = '') => {
  const amount = typeof value === 'number' ? value : Number(value ?? 0);
  const formatted = Number.isFinite(amount) ? amount.toLocaleString() : '0';

  return currency ? `${formatted} ${currency}` : `$${formatted}`;
};

const formatPercentPoint = (value: number | string | null | undefined) => {
  const numeric = typeof value === 'number' ? value : Number(value ?? 0);

  return `+${Number.isFinite(numeric) ? (numeric * 100).toLocaleString() : '0'}%p`;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  const axiosError = error as AxiosError<{ message?: unknown; detail?: unknown; error?: unknown }>;
  const data = axiosError.response?.data;

  if (typeof data?.message === 'string') return data.message;
  if (typeof data?.detail === 'string') return data.detail;
  if (typeof data?.error === 'string') return data.error;

  return fallback;
};

const mapReferralReward = (reward: AdminReferralReward): ReferralReward => ({
  id: reward.id,
  referrer: reward.user_name || '',
  referrerEmail: reward.user_email ?? '',
  referralCode: reward.referral_code ?? '',
  referee: reward.source_user_name || '',
  refereeEmail: reward.source_user_email ?? '',
  payoutDate: reward.approved_at ? `${formatKstDateTime(reward.approved_at)} (GMT+9)` : null,
  reward: formatMoney(reward.amount, reward.currency),
  status: toPaymentStatus(reward.status),
  rejectionReason: reward.rejection_reason,
});

const mapTradingBonus = (bonus: AdminTradingBonus): TradingBonus => ({
  id: bonus.id,
  userName: bonus.user_name || '',
  userEmail: bonus.user_email ?? '',
  accountNumber: bonus.mt4_login ? String(bonus.mt4_login) : '',
  traderProfit: typeof bonus.trader_profit === 'number' ? formatMoney(bonus.trader_profit) : '',
  baseDistribution:
    typeof bonus.trader_profit === 'number' && typeof bonus.company_share === 'number'
      ? formatMoney(bonus.trader_profit - bonus.company_share)
      : '',
  bonusRate: formatPercentPoint(bonus.bonus_rate),
  actualBonus: formatMoney(bonus.bonus_amount),
  status: toPaymentStatus(bonus.status),
  rejectionReason: bonus.rejection_reason,
});

function ModalCloseBtn({ onClick, t }: { onClick: () => void; t: any }) {
  return (
    <button
      onClick={onClick}
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
        flexShrink: 0,
      }}
    >
      <X size={14} style={{ color: t.textSec }} />
    </button>
  );
}

// 리워드 지급 승인 모달
function ApprovalModal({
  dark,
  itemLabel,
  itemKind,
  onCancel,
  onConfirm,
}: {
  dark: boolean;
  itemLabel: string;
  itemKind: RewardItemKind;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = {
    surface: dark ? '#0F1829' : '#ffffff',
    border: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)',
    border2: dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)',
    text: dark ? '#E8EAF0' : '#1A1A1A',
    textSec: dark ? '#8B8FA8' : '#4A4A58',
    textHint: dark ? '#5A6080' : '#A0A0AA',
    accent: '#7C6AF7',
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 110,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 420,
          background: t.surface,
          borderRadius: 16,
          padding: 28,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          fontFamily: "'Noto Sans KR','DM Sans',sans-serif",
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'rgba(124,106,247,0.08)',
              border: '1px solid rgba(124,106,247,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#7C6AF7"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <ModalCloseBtn onClick={onCancel} t={t} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 10 }}>
          {itemLabel} 지급 승인
        </div>
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.8,
            marginBottom: 20,
            color: t.textSec,
            textAlign: 'center',
          }}
        >
          해당 {itemLabel}를 지급 승인하시겠습니까?
          <br />
          승인 즉시 유저의 총 자산(Total Assets)에 반영되며,
          <br />
          지급 상태가 '지급완료'로 변경됩니다.
          <br />
          {itemKind === 'reward' && (
            <span style={{ color: t.textHint, fontSize: 12, marginTop: 8, display: 'block' }}>
              ※ 챌린지 구매 이력이 1회 이상인 경우에만 지급됩니다.
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              height: 36,
              padding: '0 20px',
              borderRadius: 8,
              border: `1px solid ${t.border2}`,
              background: 'transparent',
              color: t.textSec,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            style={{
              height: 36,
              padding: '0 20px',
              borderRadius: 8,
              border: 'none',
              background: t.accent,
              color: '#fff',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            지급 승인
          </button>
        </div>
      </div>
    </div>
  );
}

// 리워드 반려 모달
function RejectModal({
  dark,
  itemLabel,
  onCancel,
  onConfirm,
}: {
  dark: boolean;
  itemLabel: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [error, setError] = useState('');

  const t = {
    surface: dark ? '#0F1829' : '#ffffff',
    surface2: dark ? '#1A2035' : '#F4F5F7',
    border: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)',
    border2: dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)',
    text: dark ? '#E8EAF0' : '#1A1A1A',
    textSec: dark ? '#8B8FA8' : '#4A4A58',
    textHint: dark ? '#5A6080' : '#A0A0AA',
  };

  const handleConfirm = () => {
    if (!reason) {
      setError('반려 사유를 선택하세요.');
      return;
    }
    if (reason === '직접 입력' && !customReason.trim()) {
      setError('반려 사유를 직접 입력하세요.');
      return;
    }
    onConfirm(reason === '직접 입력' ? customReason.trim() : reason);
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 110,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 400,
          background: t.surface,
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          fontFamily: "'Noto Sans KR','DM Sans',sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: `1px solid ${t.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{itemLabel} 반려</span>
          <ModalCloseBtn onClick={onCancel} t={t} />
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 13, color: t.textSec, textAlign: 'center', lineHeight: 1.7 }}>
            해당 {itemLabel}를 반려 처리하시겠습니까?
            <br />
            <span style={{ fontSize: 12, color: t.textHint }}>
              반려 사유를 입력하면 유저에게 함께 전달됩니다.
            </span>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 600,
                color: t.textSec,
                marginBottom: 6,
              }}
            >
              반려 사유 <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError('');
              }}
              style={{
                width: '100%',
                height: 38,
                padding: '0 12px',
                borderRadius: 8,
                border: `1px solid ${error && !reason ? '#DC2626' : t.border2}`,
                background: t.surface2,
                color: reason ? t.text : t.textHint,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              <option value="">사유를 선택하세요</option>
              {REJECT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {reason === '직접 입력' && (
            <textarea
              value={customReason}
              onChange={(e) => {
                setCustomReason(e.target.value);
                setError('');
              }}
              placeholder="반려 사유를 직접 입력하세요"
              rows={3}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${error && !customReason.trim() ? '#DC2626' : t.border2}`,
                background: t.surface2,
                color: t.text,
                fontSize: 13,
                fontFamily: "'Noto Sans KR',sans-serif",
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          )}

          {error && <div style={{ fontSize: 11, color: '#DC2626' }}>{error}</div>}
        </div>

        {/* Footer */}
        <div
          style={{ padding: '12px 24px 20px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}
        >
          <button
            onClick={onCancel}
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
            onClick={handleConfirm}
            style={{
              height: 36,
              padding: '0 18px',
              borderRadius: 8,
              border: 'none',
              background: '#DC2626',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            반려
          </button>
        </div>
      </div>
    </div>
  );
}

function RewardActionCell({
  status,
  t,
  onApprove,
  onReject,
}: {
  status: PaymentStatusDisplay;
  t: any;
  onApprove: () => void;
  onReject: () => void;
}) {
  if (status !== '대기') {
    return <span style={{ fontSize: 13, color: t.textHint }}>—</span>;
  }

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <button
        onClick={onApprove}
        style={{
          height: 32,
          padding: '0 14px',
          borderRadius: 6,
          border: `1px solid ${t.border}`,
          background: 'transparent',
          color: t.text,
          fontSize: 12,
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        승인
      </button>
      <button
        onClick={onReject}
        style={{
          height: 30,
          padding: '0 12px',
          borderRadius: 6,
          border: '1px solid rgba(220,38,38,0.35)',
          background: 'transparent',
          color: '#DC2626',
          fontSize: 11,
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        반려
      </button>
    </div>
  );
}
// 리워드 지급 불가 모달
function IneligibleModal({ dark, onClose }: { dark: boolean; onClose: () => void }) {
  const t = {
    surface: dark ? '#0F1829' : '#ffffff',
    border: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)',
    text: dark ? '#E8EAF0' : '#1A1A1A',
    textSec: dark ? '#8B8FA8' : '#4A4A58',
    textHint: dark ? '#5A6080' : '#A0A0AA',
    accent: '#7C6AF7',
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 110,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 420,
          background: t.surface,
          borderRadius: 16,
          padding: 28,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          fontFamily: "'Noto Sans KR','DM Sans',sans-serif",
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'rgba(217,119,6,0.08)',
              border: '1px solid rgba(217,119,6,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#D97706"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <ModalCloseBtn onClick={onClose} t={t} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 10 }}>
          리워드 지급 불가
        </div>
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.8,
            marginBottom: 20,
            color: t.textSec,
            textAlign: 'center',
          }}
        >
          챌린지 구매 이력이 없어 리워드를 지급할 수 없습니다.
          <br />
          <span style={{ color: t.textHint, fontSize: 12, marginTop: 8, display: 'block' }}>
            피추천인/유저의 챌린지 구매가 1회 이상 확인되어야 지급 가능합니다.
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              height: 36,
              padding: '0 20px',
              borderRadius: 8,
              border: 'none',
              background: t.accent,
              color: '#fff',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

function RejectionReasonTooltip({ dark, reason }: { dark: boolean; reason: string }) {
  const background = '#374151';
  const color = '#F3F4F6';
  const border = 'rgba(255,255,255,0.14)';

  return (
    <span
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 'calc(100% + 8px)',
        transform: 'translateX(-50%)',
        zIndex: 20,
        minWidth: 120,
        maxWidth: 240,
        padding: '7px 9px',
        borderRadius: 6,
        background,
        color,
        border: `1px solid ${border}`,
        boxShadow: dark ? '0 8px 18px rgba(0,0,0,0.24)' : '0 8px 18px rgba(17,24,39,0.12)',
        fontSize: 11,
        fontWeight: 500,
        lineHeight: 1.45,
        whiteSpace: 'normal',
        textAlign: 'left',
        pointerEvents: 'none',
      }}
    >
      {reason}
      <span
        style={{
          position: 'absolute',
          left: '50%',
          top: '100%',
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: `5px solid ${background}`,
        }}
      />
    </span>
  );
}

export function RewardReferralPage() {
  const { dark } = useAppShell();
  const [searchParams, setSearchParams] = useSearchParams();
  const [modal, setModal] = useState<RewardModalState>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [activeRejectionTooltip, setActiveRejectionTooltip] = useState<string | null>(null);

  const tabParam = searchParams.get('tab');
  const activeTab: TabType =
    tabParam === 'trading' || tabParam === 'settings' ? tabParam : 'referral';
  const referralStatusParam = searchParams.get('referralStatus');
  const referralStatusFilter = toRewardStatusFilter(referralStatusParam);
  const referralSearchTerm = searchParams.get('referralSearch') ?? '';
  const referralPage = parsePageParam(searchParams.get('referralPage'));
  const tradingStatusParam = searchParams.get('tradingStatus');
  const tradingStatusFilter = toRewardStatusFilter(tradingStatusParam);
  const tradingSearchTerm = searchParams.get('tradingSearch') ?? '';
  const tradingPage = parsePageParam(searchParams.get('tradingPage'));
  const [referralSearchDraft, setReferralSearchDraft] = useState(referralSearchTerm);
  const [tradingSearchDraft, setTradingSearchDraft] = useState(tradingSearchTerm);
  const [policyCondition, setPolicyCondition] = useState<ReferralRewardCondition>('FIRST_PURCHASE');
  const [policyAmount, setPolicyAmount] = useState('');
  const [policyBonusRate, setPolicyBonusRate] = useState('');

  const referralParams = useMemo(
    () => ({
      status: toRewardStatusParam(referralStatusFilter),
      keyword: referralSearchTerm.trim().length >= 2 ? referralSearchTerm.trim() : null,
      page: referralPage,
      size: PAGE_SIZE,
    }),
    [referralPage, referralSearchTerm, referralStatusFilter],
  );
  const tradingParams = useMemo(
    () => ({
      status: toRewardStatusParam(tradingStatusFilter),
      keyword: tradingSearchTerm.trim().length >= 2 ? tradingSearchTerm.trim() : null,
      page: tradingPage,
      size: PAGE_SIZE,
    }),
    [tradingPage, tradingSearchTerm, tradingStatusFilter],
  );

  const referralsQuery = useReferralRewardsQuery(referralParams);
  const referralStatsQuery = useReferralRewardStatsQuery();
  const tradingBonusesQuery = useTradingBonusesQuery(tradingParams);
  const tradingStatsQuery = useTradingBonusStatsQuery();
  const policyQuery = useRewardPolicyQuery();
  const updatePolicyMutation = useUpdateRewardPolicyMutation();
  const approveReferralMutation = useApproveReferralRewardMutation();
  const rejectReferralMutation = useRejectReferralRewardMutation();
  const approveTradingBonusMutation = useApproveTradingBonusMutation();
  const rejectTradingBonusMutation = useRejectTradingBonusMutation();

  const updateParams = (updates: Record<string, string | number | null | undefined>) => {
    const next = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '' || value === '전체') {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });

    setSearchParams(next, { replace: true });
  };

  const onToast = (message: string, type: ToastState['type'] = 'success') => {
    setToast({ message, type });
  };

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
    tabActive: dark ? '#1A2035' : '#E8EAF0',
  };

  const referralRows = useMemo(
    () => (referralsQuery.data?.items ?? []).map(mapReferralReward),
    [referralsQuery.data?.items],
  );
  const tradingRows = useMemo(
    () => (tradingBonusesQuery.data?.items ?? []).map(mapTradingBonus),
    [tradingBonusesQuery.data?.items],
  );

  const referralTotal = referralsQuery.data?.total ?? 0;
  const referralPageSize = referralsQuery.data?.size ?? PAGE_SIZE;
  const referralTotalPages = Math.max(
    1,
    referralsQuery.data?.pages ?? Math.ceil(referralTotal / referralPageSize),
  );
  const responseReferralPage =
    !referralsQuery.isPlaceholderData && referralsQuery.data
      ? referralsQuery.data.page
      : referralPage;
  const safeReferralPage = Math.min(Math.max(1, responseReferralPage), referralTotalPages);
  const referralRange = getPaginationRange({
    totalItems: referralTotal,
    currentPage: safeReferralPage,
    pageSize: referralPageSize,
    currentPageItemCount: referralRows.length,
  });

  const tradingTotal = tradingBonusesQuery.data?.total ?? 0;
  const tradingPageSize = tradingBonusesQuery.data?.size ?? PAGE_SIZE;
  const tradingTotalPages = Math.max(
    1,
    tradingBonusesQuery.data?.pages ?? Math.ceil(tradingTotal / tradingPageSize),
  );
  const responseTradingPage =
    !tradingBonusesQuery.isPlaceholderData && tradingBonusesQuery.data
      ? tradingBonusesQuery.data.page
      : tradingPage;
  const safeTradingPage = Math.min(Math.max(1, responseTradingPage), tradingTotalPages);
  const tradingRange = getPaginationRange({
    totalItems: tradingTotal,
    currentPage: safeTradingPage,
    pageSize: tradingPageSize,
    currentPageItemCount: tradingRows.length,
  });

  useEffect(() => {
    if (
      referralsQuery.data &&
      !referralsQuery.isPlaceholderData &&
      referralPage !== safeReferralPage
    ) {
      updateParams({ referralPage: safeReferralPage });
    }
  }, [referralPage, referralsQuery.data, referralsQuery.isPlaceholderData, safeReferralPage]);

  useEffect(() => {
    if (
      tradingBonusesQuery.data &&
      !tradingBonusesQuery.isPlaceholderData &&
      tradingPage !== safeTradingPage
    ) {
      updateParams({ tradingPage: safeTradingPage });
    }
  }, [
    safeTradingPage,
    tradingBonusesQuery.data,
    tradingBonusesQuery.isPlaceholderData,
    tradingPage,
  ]);

  useEffect(() => {
    setReferralSearchDraft(referralSearchTerm);
  }, [referralSearchTerm]);

  useEffect(() => {
    setTradingSearchDraft(tradingSearchTerm);
  }, [tradingSearchTerm]);

  useEffect(() => {
    const query = referralSearchDraft.trim();
    if (query === referralSearchTerm) return;

    const timer = window.setTimeout(() => {
      updateParams({ referralSearch: query.length >= 2 ? query : null, referralPage: 1 });
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [referralSearchDraft, referralSearchTerm]);

  useEffect(() => {
    const query = tradingSearchDraft.trim();
    if (query === tradingSearchTerm) return;

    const timer = window.setTimeout(() => {
      updateParams({ tradingSearch: query.length >= 2 ? query : null, tradingPage: 1 });
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [tradingSearchDraft, tradingSearchTerm]);

  const resetPolicyForm = (policy = policyQuery.data) => {
    if (!policy) return;

    setPolicyCondition(policy.referral_reward_condition);
    setPolicyAmount(String(policy.referral_reward_amount ?? ''));
    setPolicyBonusRate(String(Number(policy.trading_bonus_rate ?? 0) * 100));
  };

  useEffect(() => {
    resetPolicyForm();
  }, [policyQuery.data]);

  useEffect(() => {
    if (activeTab === 'referral') {
      referralsQuery.refetch();
      referralStatsQuery.refetch();
      return;
    }

    if (activeTab === 'trading') {
      tradingBonusesQuery.refetch();
      tradingStatsQuery.refetch();
      return;
    }

    resetPolicyForm();
    policyQuery.refetch().then(({ data }) => {
      resetPolicyForm(data);
    });
  }, [activeTab]);

  const getStatusBadge = (
    status: PaymentStatusDisplay,
    rejectionReason?: string | null,
    tooltipKey?: string,
  ) => {
    if (!status) {
      return <span style={{ fontSize: 13, color: t.textHint }}>-</span>;
    }

    const isRejected = status === '반려';
    const showTooltip =
      isRejected &&
      Boolean(rejectionReason) &&
      Boolean(tooltipKey) &&
      activeRejectionTooltip === tooltipKey;
    const configs = {
      대기: { bg: 'rgba(217,119,6,0.1)', color: '#D97706', border: 'rgba(217,119,6,0.2)' },
      지급완료: { bg: 'rgba(22,163,74,0.1)', color: '#16A34A', border: 'rgba(22,163,74,0.2)' },
      반려: { bg: 'rgba(107,114,128,0.1)', color: '#6B7280', border: 'rgba(107,114,128,0.2)' },
    };
    const config = configs[status];
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '4px 10px',
          borderRadius: 9999,
          fontSize: 11,
          fontWeight: 600,
          background: config.bg,
          color: config.color,
          border: `1px solid ${config.border}`,
          cursor: 'default',
          position: 'relative',
        }}
        onMouseEnter={() => {
          if (isRejected && rejectionReason && tooltipKey) {
            setActiveRejectionTooltip(tooltipKey);
          }
        }}
        onMouseLeave={() => {
          if (tooltipKey) {
            setActiveRejectionTooltip((current) => (current === tooltipKey ? null : current));
          }
        }}
      >
        {status}
        {showTooltip && rejectionReason ? (
          <RejectionReasonTooltip dark={dark} reason={rejectionReason} />
        ) : null}
      </span>
    );
  };

  const openRewardModal = (
    type: NonNullable<RewardModalState>['type'],
    itemKind: RewardItemKind,
    itemId?: number,
  ) => {
    setModal({ type, itemKind, itemId });
  };

  const handleApproval = () => {
    const itemLabel = modal ? getRewardItemLabel(modal.itemKind) : '리워드';
    if (!modal?.itemId) return;

    const options = {
      onSuccess: () => {
        setModal(null);
        onToast(`${itemLabel} 지급이 승인되었습니다`, 'success');
      },
      onError: (error: unknown) => {
        onToast(getErrorMessage(error, `${itemLabel} 지급 승인에 실패했습니다`), 'warning');
      },
    };

    if (modal.itemKind === 'reward') {
      approveReferralMutation.mutate(modal.itemId, options);
      return;
    }

    approveTradingBonusMutation.mutate(modal.itemId, options);
  };

  const handleReject = (reason: string) => {
    const itemLabel = modal ? getRewardItemLabel(modal.itemKind) : '리워드';
    if (!modal?.itemId) return;

    const options = {
      onSuccess: () => {
        setModal(null);
        onToast(`${itemLabel}가 반려되었습니다 (${reason})`, 'warning');
      },
      onError: (error: unknown) => {
        onToast(getErrorMessage(error, `${itemLabel} 반려에 실패했습니다`), 'warning');
      },
    };
    const payload = { rejection_reason: reason };

    if (modal.itemKind === 'reward') {
      rejectReferralMutation.mutate({ rewardId: modal.itemId, payload }, options);
      return;
    }

    rejectTradingBonusMutation.mutate({ bonusId: modal.itemId, payload }, options);
  };

  const handleSaveReferralPolicy = () => {
    const referral_reward_amount = Number(policyAmount);

    updatePolicyMutation.mutate(
      {
        referral_reward_condition: policyCondition,
        referral_reward_amount: Number.isFinite(referral_reward_amount)
          ? referral_reward_amount
          : undefined,
      },
      {
        onSuccess: () => {
          onToast('추천인 리워드 설정이 저장되었습니다', 'success');
        },
        onError: (error) => {
          onToast(getErrorMessage(error, '추천인 리워드 설정 저장에 실패했습니다'), 'warning');
        },
      },
    );
  };

  const handleSaveTradingBonusPolicy = () => {
    const trading_bonus_rate = Number(policyBonusRate) / 100;

    updatePolicyMutation.mutate(
      {
        trading_bonus_rate: Number.isFinite(trading_bonus_rate) ? trading_bonus_rate : undefined,
      },
      {
        onSuccess: () => {
          onToast('트레이딩 보너스 설정이 저장되었습니다', 'success');
        },
        onError: (error) => {
          onToast(getErrorMessage(error, '트레이딩 보너스 설정 저장에 실패했습니다'), 'warning');
        },
      },
    );
  };

  return (
    <div style={{ background: t.pageBg, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ padding: '32px 24px 24px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: t.text, margin: 0, marginBottom: 8 }}>
          리워드/레퍼럴 관리
        </h1>
        <p style={{ fontSize: 13, color: t.textSec, margin: 0 }}>
          추천인 리워드와 트레이딩 보너스를 관리하고 지급합니다. (모든 리워드는 USD로 지급, 승인 시
          유저 총 자산에 반영)
        </p>
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
            onClick={() => updateParams({ tab: null })}
            style={{
              padding: '12px 20px',
              background: activeTab === 'referral' ? t.tabActive : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'referral' ? `2px solid ${t.accent}` : 'none',
              color: activeTab === 'referral' ? t.text : t.textSec,
              fontSize: 14,
              fontWeight: activeTab === 'referral' ? 600 : 500,
              cursor: 'pointer',
              borderRadius: '8px 8px 0 0',
            }}
          >
            추천인 리워드
          </button>
          <button
            onClick={() => updateParams({ tab: 'trading' })}
            style={{
              padding: '12px 20px',
              background: activeTab === 'trading' ? t.tabActive : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'trading' ? `2px solid ${t.accent}` : 'none',
              color: activeTab === 'trading' ? t.text : t.textSec,
              fontSize: 14,
              fontWeight: activeTab === 'trading' ? 600 : 500,
              cursor: 'pointer',
              borderRadius: '8px 8px 0 0',
            }}
          >
            트레이딩 보너스
          </button>
          <button
            onClick={() => updateParams({ tab: 'settings' })}
            style={{
              padding: '12px 20px',
              background: activeTab === 'settings' ? t.tabActive : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'settings' ? `2px solid ${t.accent}` : 'none',
              color: activeTab === 'settings' ? t.text : t.textSec,
              fontSize: 14,
              fontWeight: activeTab === 'settings' ? 600 : 500,
              cursor: 'pointer',
              borderRadius: '8px 8px 0 0',
            }}
          >
            리워드 정책 설정
          </button>
        </div>
      </div>

      {/* Tab 1: 추천인 리워드 */}
      {activeTab === 'referral' && (
        <>
          {/* Stat Cards */}
          <div style={{ padding: '0 24px 20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              {[
                {
                  label: '추천 리워드 총 적립',
                  value: formatMoney(referralStatsQuery.data?.total_accumulated),
                  color: t.text,
                },
                {
                  label: '지급 완료',
                  value: formatMoney(referralStatsQuery.data?.total_approved),
                  color: '#16A34A',
                },
                {
                  label: '지급 대기',
                  value: formatMoney(referralStatsQuery.data?.total_pending),
                  color: '#D97706',
                },
                {
                  label: '활성 레퍼럴',
                  value: referralStatsQuery.data?.active_referrals?.toLocaleString() ?? '',
                  color: t.text,
                },
              ].map((card) => (
                <div
                  key={card.label}
                  style={{
                    background: t.surface,
                    borderRadius: 12,
                    border: `1px solid ${t.border}`,
                    padding: '20px 18px',
                  }}
                >
                  <div style={{ fontSize: 11, color: t.textSec, marginBottom: 8 }}>
                    {card.label}
                  </div>
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 700,
                      color: card.color,
                      fontFamily: "'DM Mono',monospace",
                    }}
                  >
                    {card.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Filter Bar */}
          <div style={{ padding: '0 24px 20px' }}>
            <TableFilterBar
              background={t.surface}
              borderColor={t.border}
              containerStyle={{ marginBottom: 0, padding: '16px 20px' }}
            >
              <SelectFilter
                value={referralStatusFilter}
                onChange={(value) => {
                  updateParams({ referralStatus: value, referralPage: 1 });
                }}
                width={140}
                background={t.surface2}
                borderColor={t.border}
                textColor={t.text}
                iconColor={t.text}
                options={[
                  { value: '전체', label: '지급 상태: 전체' },
                  ...REWARD_STATUS_VALUES.map((status) => ({
                    value: status,
                    label: toRewardStatusLabel(status),
                  })),
                ]}
              />
              <SearchField
                value={referralSearchDraft}
                onChange={setReferralSearchDraft}
                placeholder="추천인 / 피추천인 / 레퍼럴 코드 검색"
                minWidth={260}
                height={36}
                background={t.surface2}
                borderColor={t.border}
                textColor={t.text}
                iconColor={t.textHint}
              />
            </TableFilterBar>
          </div>

          {/* Table */}
          <div style={{ padding: '0 24px 32px' }}>
            <DataTable
              columns={[
                { key: 'referrer', label: '추천인' },
                { key: 'referralCode', label: '레퍼럴 코드' },
                { key: 'referee', label: '피추천인 (가입자)' },
                { key: 'payoutDate', label: '지급일' },
                { key: 'reward', label: '리워드' },
                { key: 'status', label: '지급 상태' },
                { key: 'actions', label: '관리' },
              ]}
              rows={referralRows}
              isLoading={referralsQuery.isLoading}
              rowKey={(reward) => reward.id}
              shellStyle={{
                background: t.surface,
                borderRadius: 12,
                border: `1px solid ${t.border}`,
                overflow: 'hidden',
              }}
              tableStyle={{ width: '100%', borderCollapse: 'collapse' }}
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
                borderBottom: index < referralRows.length - 1 ? `1px solid ${t.border}` : 'none',
              })}
              emptyState={
                <div style={{ textAlign: 'center', color: t.textHint, fontSize: 13 }}>
                  {referralsQuery.isLoading
                    ? '추천인 리워드 목록을 불러오는 중입니다.'
                    : referralsQuery.isError
                      ? '추천인 리워드 목록을 불러오지 못했습니다.'
                      : '조회 결과가 없습니다.'}
                </div>
              }
              rowRenderer={(reward) => (
                <>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 2 }}>
                      {reward.referrer}
                    </div>
                    <div style={{ fontSize: 10, color: t.textHint }}>{reward.referrerEmail}</div>
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
                        color: t.text,
                        fontFamily: "'DM Mono',monospace",
                      }}
                    >
                      {reward.referralCode}
                    </span>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 2 }}>
                      {reward.referee}
                    </div>
                    <div style={{ fontSize: 10, color: t.textHint }}>{reward.refereeEmail}</div>
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
                    {reward.status === '지급완료' ? reward.payoutDate : '-'}
                  </td>
                  <td
                    style={{
                      padding: '16px',
                      fontSize: 14,
                      fontWeight: 600,
                      color: t.text,
                      fontFamily: "'DM Mono',monospace",
                    }}
                  >
                    {reward.reward}
                  </td>
                  <td style={{ padding: '16px' }}>
                    {getStatusBadge(reward.status, reward.rejectionReason, `reward-${reward.id}`)}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <RewardActionCell
                      status={reward.status}
                      t={t}
                      onApprove={() => openRewardModal('approval', 'reward', reward.id)}
                      onReject={() => openRewardModal('reject', 'reward', reward.id)}
                    />
                  </td>
                </>
              )}
              footer={
                <TablePagination
                  summary={buildPaginationSummary({
                    totalItems: referralTotal,
                    start: referralRange.start,
                    end: referralRange.end,
                  })}
                  items={buildPaginationItems({
                    currentPage: safeReferralPage,
                    totalPages: referralTotalPages,
                    onPageChange: (page) => updateParams({ referralPage: page }),
                  })}
                  borderColor={t.border}
                  textColor={t.textSec}
                  activeBackground={t.accent}
                  inactiveBackground={t.surface2}
                  inactiveBorderColor={t.border}
                />
              }
            />
          </div>
        </>
      )}

      {/* Tab 2: 트레이딩 보너스 */}
      {activeTab === 'trading' && (
        <>
          {/* Stat Cards */}
          <div style={{ padding: '0 24px 20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              {[
                {
                  label: '보너스 총 적립',
                  value: formatMoney(tradingStatsQuery.data?.total_accumulated),
                  color: t.text,
                },
                {
                  label: '지급 완료',
                  value: formatMoney(tradingStatsQuery.data?.total_approved),
                  color: '#16A34A',
                },
                {
                  label: '지급 대기',
                  value: formatMoney(tradingStatsQuery.data?.total_pending),
                  color: '#D97706',
                },
                {
                  label: '보너스 비율',
                  value: formatPercentPoint(tradingStatsQuery.data?.trading_bonus_rate),
                  color: t.text,
                },
              ].map((card) => (
                <div
                  key={card.label}
                  style={{
                    background: t.surface,
                    borderRadius: 12,
                    border: `1px solid ${t.border}`,
                    padding: '20px 18px',
                  }}
                >
                  <div style={{ fontSize: 11, color: t.textSec, marginBottom: 8 }}>
                    {card.label}
                  </div>
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 700,
                      color: card.color,
                      fontFamily: "'DM Mono',monospace",
                    }}
                  >
                    {card.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Filter Bar */}
          <div style={{ padding: '0 24px 20px' }}>
            <TableFilterBar
              background={t.surface}
              borderColor={t.border}
              containerStyle={{ marginBottom: 0, padding: '16px 20px' }}
            >
              <SelectFilter
                value={tradingStatusFilter}
                onChange={(value) => {
                  updateParams({ tradingStatus: value, tradingPage: 1 });
                }}
                width={140}
                background={t.surface2}
                borderColor={t.border}
                textColor={t.text}
                iconColor={t.text}
                options={[
                  { value: '전체', label: '지급 상태: 전체' },
                  ...REWARD_STATUS_VALUES.map((status) => ({
                    value: status,
                    label: toRewardStatusLabel(status),
                  })),
                ]}
              />
              <SearchField
                value={tradingSearchDraft}
                onChange={setTradingSearchDraft}
                placeholder="유저 / 계좌번호 검색"
                minWidth={260}
                height={36}
                background={t.surface2}
                borderColor={t.border}
                textColor={t.text}
                iconColor={t.textHint}
              />
            </TableFilterBar>
          </div>

          {/* Table */}
          <div style={{ padding: '0 24px 32px' }}>
            <DataTable
              columns={[
                { key: 'user', label: '유저' },
                { key: 'accountNumber', label: '계좌번호' },
                { key: 'traderProfit', label: '트레이더 수익' },
                { key: 'baseDistribution', label: '기본 배분 (80%)' },
                { key: 'bonusRate', label: '보너스 (+1%p)' },
                { key: 'actualBonus', label: '실지급 보너스' },
                { key: 'status', label: '지급 상태' },
                { key: 'actions', label: '관리' },
              ]}
              rows={tradingRows}
              isLoading={tradingBonusesQuery.isLoading}
              rowKey={(bonus) => bonus.id}
              shellStyle={{
                background: t.surface,
                borderRadius: 12,
                border: `1px solid ${t.border}`,
                overflow: 'hidden',
              }}
              tableStyle={{ width: '100%', borderCollapse: 'collapse' }}
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
                borderBottom: index < tradingRows.length - 1 ? `1px solid ${t.border}` : 'none',
              })}
              emptyState={
                <div style={{ textAlign: 'center', color: t.textHint, fontSize: 13 }}>
                  {tradingBonusesQuery.isLoading
                    ? '트레이딩 보너스 목록을 불러오는 중입니다.'
                    : tradingBonusesQuery.isError
                      ? '트레이딩 보너스 목록을 불러오지 못했습니다.'
                      : '조회 결과가 없습니다.'}
                </div>
              }
              rowRenderer={(bonus) => (
                <>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 2 }}>
                      {bonus.userName}
                    </div>
                    <div style={{ fontSize: 10, color: t.textHint }}>{bonus.userEmail}</div>
                  </td>
                  <td
                    style={{
                      padding: '16px',
                      fontSize: 11,
                      color: t.textSec,
                      fontFamily: "'DM Mono',monospace",
                    }}
                  >
                    {bonus.accountNumber}
                  </td>
                  <td
                    style={{
                      padding: '16px',
                      fontSize: 13,
                      color: t.text,
                      fontFamily: "'DM Mono',monospace",
                    }}
                  >
                    {bonus.traderProfit}
                  </td>
                  <td
                    style={{
                      padding: '16px',
                      fontSize: 13,
                      color: t.textSec,
                      fontFamily: "'DM Mono',monospace",
                    }}
                  >
                    {bonus.baseDistribution}
                  </td>
                  <td
                    style={{
                      padding: '16px',
                      fontSize: 13,
                      color: t.accent,
                      fontWeight: 600,
                    }}
                  >
                    {bonus.bonusRate}
                  </td>
                  <td
                    style={{
                      padding: '16px',
                      fontSize: 14,
                      fontWeight: 600,
                      color: t.text,
                      fontFamily: "'DM Mono',monospace",
                    }}
                  >
                    {bonus.actualBonus}
                  </td>
                  <td style={{ padding: '16px' }}>
                    {getStatusBadge(bonus.status, bonus.rejectionReason, `bonus-${bonus.id}`)}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <RewardActionCell
                      status={bonus.status}
                      t={t}
                      onApprove={() => openRewardModal('approval', 'bonus', bonus.id)}
                      onReject={() => openRewardModal('reject', 'bonus', bonus.id)}
                    />
                  </td>
                </>
              )}
              footer={
                <TablePagination
                  summary={buildPaginationSummary({
                    totalItems: tradingTotal,
                    start: tradingRange.start,
                    end: tradingRange.end,
                  })}
                  items={buildPaginationItems({
                    currentPage: safeTradingPage,
                    totalPages: tradingTotalPages,
                    onPageChange: (page) => updateParams({ tradingPage: page }),
                  })}
                  borderColor={t.border}
                  textColor={t.textSec}
                  activeBackground={t.accent}
                  inactiveBackground={t.surface2}
                  inactiveBorderColor={t.border}
                />
              }
            />
          </div>
        </>
      )}

      {/* Tab 3: 리워드 정책 설정 */}
      {activeTab === 'settings' && (
        <div style={{ padding: '0 24px 32px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 740 }}>
            {/* Card 1: 추천인 리워드 */}
            <div
              style={{
                background: t.surface,
                borderRadius: 12,
                border: `1px solid ${t.border}`,
                padding: 24,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 600, color: t.text }}>추천인 리워드</div>
                <button
                  onClick={handleSaveReferralPolicy}
                  disabled={updatePolicyMutation.isPending || policyQuery.isLoading}
                  style={{
                    height: 30,
                    padding: '0 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: t.accent,
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: updatePolicyMutation.isPending ? 'not-allowed' : 'pointer',
                    opacity: updatePolicyMutation.isPending ? 0.7 : 1,
                  }}
                >
                  저장
                </button>
              </div>
              <div style={{ fontSize: 12, color: t.textSec, marginBottom: 20 }}>
                레퍼럴 코드/링크로 가입한 유저가 조건 충족 시 추천인에게 지급 (수동 승인, 챌린지
                구매 이력 1회 이상 필요)
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
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
                    지급액 (USD)
                  </label>
                  <input
                    type="number"
                    value={policyAmount}
                    onChange={(event) => setPolicyAmount(event.target.value)}
                    style={{
                      width: '100%',
                      height: 38,
                      padding: '0 12px',
                      borderRadius: 8,
                      border: `1px solid ${t.border}`,
                      background: t.surface2,
                      color: t.text,
                      fontSize: 13,
                      fontFamily: "'DM Mono',monospace",
                    }}
                  />
                </div>
                <div style={{ flex: 2 }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 11,
                      fontWeight: 600,
                      color: t.textSec,
                      marginBottom: 8,
                    }}
                  >
                    지급 조건
                  </label>
                  <select
                    value={policyCondition}
                    onChange={(event) =>
                      setPolicyCondition(event.target.value as ReferralRewardCondition)
                    }
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
                    <option value="FIRST_PURCHASE">피추천인 첫 챌린지 구매 시</option>
                    <option value="FUNDED_UPGRADE">피추천인 펀디드 승급 시</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Card 2: 트레이딩 보너스 */}
            <div
              style={{
                background: t.surface,
                borderRadius: 12,
                border: `1px solid ${t.border}`,
                padding: 24,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 600, color: t.text }}>트레이딩 보너스</div>
                <button
                  onClick={handleSaveTradingBonusPolicy}
                  disabled={updatePolicyMutation.isPending || policyQuery.isLoading}
                  style={{
                    height: 30,
                    padding: '0 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: t.accent,
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: updatePolicyMutation.isPending ? 'not-allowed' : 'pointer',
                    opacity: updatePolicyMutation.isPending ? 0.7 : 1,
                  }}
                >
                  저장
                </button>
              </div>
              <div style={{ fontSize: 12, color: t.textSec, marginBottom: 20 }}>
                펀디드 수익 배분에서 회사 몫의 일부를 트레이더에게 추가 지급
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
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
                    보너스 추가율
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      value={policyBonusRate}
                      onChange={(event) => setPolicyBonusRate(event.target.value)}
                      style={{
                        width: '100%',
                        height: 38,
                        padding: '0 36px 0 12px',
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
                        fontSize: 13,
                        color: t.textSec,
                      }}
                    >
                      %p
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    flex: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    paddingBottom: 1,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 600, color: t.textSec, marginBottom: 6 }}>
                    적용 예시
                  </div>
                  <div style={{ fontSize: 12, color: t.textHint, lineHeight: 1.5 }}>
                    회사 몫 20% 중 1%p를 추가 지급 → 트레이더 실수령 81%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {modal?.type === 'approval' && (
        <ApprovalModal
          dark={dark}
          itemLabel={getRewardItemLabel(modal.itemKind)}
          itemKind={modal.itemKind}
          onCancel={() => setModal(null)}
          onConfirm={handleApproval}
        />
      )}
      {modal?.type === 'reject' && (
        <RejectModal
          dark={dark}
          itemLabel={getRewardItemLabel(modal.itemKind)}
          onCancel={() => setModal(null)}
          onConfirm={handleReject}
        />
      )}
      {modal?.type === 'ineligible' && (
        <IneligibleModal dark={dark} onClose={() => setModal(null)} />
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
