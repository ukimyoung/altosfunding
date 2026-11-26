import { useEffect, useMemo, useState } from 'react';
import type { Account } from '../../types/account';
import { ModalCloseBtn } from '../shared/ModalCloseButton';
import { tok } from '../../theme/tokens';
import {
  useBanAccountMutation,
  useFreezeAccountMutation,
  useGetAccountDetailQuery,
  useGetAccountEvaluationQuery,
  useListAccountTradesQuery,
  useUnfreezeAccountMutation,
} from '../../queries/accounts';
import type { AccountEvaluationCheck, AccountStatus, AccountTrade } from '@/api/account';
import {
  copyTextToClipboard,
  formatKstDateTimeParts,
  formatSignedUsdMoney,
  formatUsdMoney,
} from '../../utils/utils';
import {
  TablePagination,
  buildPaginationItems,
  buildPaginationSummary,
  getPaginationRange,
} from '../shared/DataTable';

const emptyValue = '-';
const tradePageSize = 20;

const asDisplay = (value: unknown, fallback = emptyValue) => {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
};

const formatRuleUsd = (value: unknown) =>
  typeof value === 'number'
    ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : emptyValue;

const formatRulePlain = (value: unknown) =>
  typeof value === 'number' ? value.toLocaleString('en-US', { maximumFractionDigits: 2 }) : emptyValue;

/** 챌린지 결과 한 줄 ('이름', '내용'). 웹 Account Detail(한국어)과 같은 문구. 숫자 값이 없는 이전 판정은 Core가 저장한 문구를 쓴다. */
const describeRuleCheck = (check: AccountEvaluationCheck): [string, string | null] => {
  const v = check.values ?? null;
  switch (check.key) {
    case 'profit_target':
      return [
        '수익 목표',
        v ? `수익 ${formatRuleUsd(v.profit)} / 목표 ${formatRuleUsd(v.target)}` : check.detail,
      ];
    case 'min_trading_days':
      return [
        '최소 거래일',
        v ? `거래일 ${formatRulePlain(v.days)}일 / 최소 ${formatRulePlain(v.required)}일` : check.detail,
      ];
    case 'max_drawdown': {
      const name = '최대 손실 한도 (Max Drawdown)';
      if (!v) return [name, check.detail];
      if (typeof v.violated_at === 'string') {
        const at = formatKstDateTimeParts(v.violated_at);
        return [
          name,
          `${at.date} ${at.time} (GMT+9) 위반 (평가금액 ${formatRuleUsd(v.equity)} / 기준선 ${formatRuleUsd(v.floor)})`,
        ];
      }
      return [
        name,
        typeof v.floor === 'number'
          ? `위반 없음 (DD ${formatRuleUsd(v.dd)}, 마지막 기준선 ${formatRuleUsd(v.floor)})`
          : `위반 없음 (DD ${formatRuleUsd(v.dd)})`,
      ];
    }
    case 'consistency': {
      const name = '일관성 (Consistency)';
      if (!v) return [name, check.detail];
      if (v.skipped) return [name, `전체 순수익 ${formatRuleUsd(v.total)} — 비율 계산 안 함`];
      const bestDay = typeof v.best_day === 'string' ? ` (${v.best_day})` : '';
      const ratio = typeof v.ratio === 'number' ? v.ratio.toFixed(2) : emptyValue;
      return [
        name,
        `하루 최대 수익 ${formatRuleUsd(v.best)}${bestDay} / 전체 순수익 ${formatRuleUsd(v.total)} = ${ratio}% (기준 ${formatRulePlain(v.limit)}%)`,
      ];
    }
    default:
      return [check.label, check.detail];
  }
};

const getMt4Login = (acct: Account) => {
  if (acct.mt4Login !== undefined && acct.mt4Login !== null && acct.mt4Login !== '')
    return acct.mt4Login;

  const match = acct.id.match(/^MT4-(.+)$/i);
  return match?.[1] ?? acct.id;
};

const getRequestAccountId = (acct: Account) => {
  if (acct.accountId) return acct.accountId;
  return null;
};

export function AccountInactiveModal({
  dark,
  onCancel,
  onConfirm,
}: {
  dark: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = tok(dark);
  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 120,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 380,
          background: t.surface,
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          fontFamily: "'Noto Sans KR','DM Sans',sans-serif",
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 14,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: '#FEF3C7',
              border: '1px solid rgba(217,119,6,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
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
          <ModalCloseBtn onClick={onCancel} t={t} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 8 }}>
          계좌 비활성 (INACTIVE)
        </div>
        <div style={{ fontSize: 13, color: t.textSec, lineHeight: 1.8 }}>
          해당 계좌를 비활성 처리하시겠습니까?
          <br />
          <br />
          <span style={{ fontWeight: 600, color: t.text }}>처리 후 상태:</span>
          <br />
          • Altos Funding 사이트 — 접속 유지
          <br />
          • MT4 접속 — 유지
          <br />• MT4 거래 —{' '}
          <span style={{ fontWeight: 600, color: '#DC2626' }}>전체 불가 (ReadOnly)</span>
          <br />
          <br />
          재활성화는 어드민이 직접 처리해야 합니다.
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
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
              background: 'rgba(217,119,6,0.12)',
              color: '#D97706',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            비활성 처리
          </button>
        </div>
      </div>
    </div>
  );
}

export const fundedProvisionLabel = (status?: string | null) =>
  status === 'DONE' ? '발급 완료' : status === 'QUEUED' ? '발급 대기' : asDisplay(status);

// Account Banned modal (account drawer)

export function AccountBannedModal({
  dark,
  onCancel,
  onConfirm,
}: {
  dark: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const t = tok(dark);
  const [reason, setReason] = useState('');
  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 120,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 360,
          background: t.surface,
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          fontFamily: "'Noto Sans KR','DM Sans',sans-serif",
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: '#FEE2E2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#DC2626"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#DC2626' }}>영구정지 확인</span>
          <div style={{ flex: 1 }} />
          <ModalCloseBtn onClick={onCancel} t={t} />
        </div>
        <div
          style={{
            fontSize: 12,
            color: t.textSec,
            lineHeight: 1.6,
            paddingLeft: 36,
            marginBottom: 16,
          }}
        >
          <span style={{ fontWeight: 600, color: t.text }}>이 작업은 취소할 수 없습니다.</span> MT4
          즉시 차단 및 모든 활성 포지션이 강제 종료됩니다.
        </div>
        <div style={{ height: 1, background: t.border, marginBottom: 14 }} />
        <div style={{ marginBottom: 10 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: t.text,
              marginBottom: 6,
              display: 'flex',
              gap: 6,
            }}
          >
            영구정지 사유 <span style={{ fontWeight: 400, color: t.textHint }}>(선택)</span>
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={'영구정지 사유를 입력하세요\n입력하지 않아도 처리됩니다.'}
            style={{
              width: '100%',
              height: 72,
              background: t.surface2,
              border: `1px solid ${t.border2}`,
              borderRadius: 8,
              fontSize: 12,
              padding: '10px 12px',
              color: t.text,
              outline: 'none',
              resize: 'none',
              boxSizing: 'border-box' as const,
              fontFamily: "'Noto Sans KR',sans-serif",
              marginBottom: 10,
            }}
          />
          <div
            style={{
              background: dark ? 'rgba(220,38,38,0.08)' : '#FFF5F5',
              border: '1px solid #FECACA',
              borderRadius: 6,
              padding: '8px 10px',
              display: 'flex',
              gap: 6,
              alignItems: 'flex-start',
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#DC2626"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0, marginTop: 1 }}
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span style={{ fontSize: 11, color: '#DC2626', lineHeight: 1.5 }}>
              복구 불가 — 처리 후 어드민 권한자의 별도 프로세스 없이는 해제할 수 없습니다.
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14 }}>
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
            onClick={() => onConfirm(reason.trim())}
            style={{
              height: 36,
              padding: '0 20px',
              borderRadius: 8,
              border: 'none',
              background: '#DC2626',
              color: '#fff',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            영구정지 처리
          </button>
        </div>
      </div>
    </div>
  );
}

// KYC Approve modal

export function AccountDetailDrawer({
  acct,
  dark,
  useApi = true,
  showTradeHistory = true,
  onStatusChanged,
  onClose,
}: {
  acct: Account;
  dark: boolean;
  useApi?: boolean;
  showTradeHistory?: boolean;
  onStatusChanged?: (accountId: string, status: AccountStatus) => void | Promise<void>;
  onClose: () => void;
}) {
  const t = tok(dark);
  const mt4Login = getMt4Login(acct);
  const requestAccountId = getRequestAccountId(acct);
  const [tradePage, setTradePage] = useState(1);
  const [drawerConfirm, setDrawerConfirm] = useState<'inactive' | 'banned' | null>(null);
  const [drawerToast, setDrawerToast] = useState<string | null>(null);
  const [copyHov, setCopyHov] = useState<string | null>(null);
  const unfreezeAccountMutation = useUnfreezeAccountMutation();
  const freezeAccountMutation = useFreezeAccountMutation();
  const banAccountMutation = useBanAccountMutation();
  const { data: detail, refetch: refetchDetail } = useGetAccountDetailQuery(
    useApi ? requestAccountId : null,
  );
  // 챌린지 결과: 대회가 끝나고 판정이 난 뒤에만 값이 온다 (웹 Account Detail과 같은 기준)
  const { data: evaluation } = useGetAccountEvaluationQuery(
    useApi && detail?.tier === 'CHALLENGE' ? requestAccountId : null,
  );
  const tradeParams = useMemo(() => ({ page: tradePage, size: tradePageSize }), [tradePage]);
  const { data: tradeData, isPlaceholderData } = useListAccountTradesQuery(
    useApi && showTradeHistory ? requestAccountId : null,
    tradeParams,
  );
  const tradeRows = tradeData?.items ?? [];
  const totalTradeRows = tradeData?.total ?? tradeRows.length;
  const responseTradePageSize = tradeData?.size ?? tradePageSize;
  const totalTradePages = Math.max(
    1,
    tradeData?.pages ?? Math.ceil(totalTradeRows / responseTradePageSize),
  );
  const responseTradePage = !isPlaceholderData && tradeData ? tradeData.page : tradePage;
  const safeTradePage = Math.min(Math.max(1, responseTradePage), totalTradePages);
  const tradePaginationRange = getPaginationRange({
    totalItems: totalTradeRows,
    currentPage: safeTradePage,
    pageSize: responseTradePageSize,
    currentPageItemCount: tradeRows.length,
  });
  const accountId = detail?.mt4_login ? String(detail.mt4_login) : acct.id;
  const capital = detail ? formatUsdMoney(detail.capital) : acct.size;
  const balance = detail ? formatUsdMoney(detail.balance) : asDisplay(acct.balance);
  const totalProfit = detail ? formatSignedUsdMoney(detail.total_profit) : acct.profit;
  const login = asDisplay(detail?.mt4_login ?? mt4Login);
  const password = asDisplay(detail?.mt4_password);
  const server = asDisplay(detail?.mt4_server);

  const showDrawerToast = (msg: string, duration = 3000) => {
    setDrawerToast(msg);
    setTimeout(() => setDrawerToast(null), duration);
  };

  const refreshStatusData = async (status: AccountStatus) => {
    if (!requestAccountId) return;
    await Promise.allSettled([
      refetchDetail(),
      Promise.resolve(onStatusChanged?.(requestAccountId, status)),
    ]);
  };

  const runAccountAction = async (
    mutation: { mutateAsync: (accountId: string) => Promise<void> },
    status: AccountStatus,
    successMessage: string,
  ) => {
    if (!requestAccountId) {
      showDrawerToast('계좌 ID를 확인할 수 없습니다');
      return;
    }

    try {
      await mutation.mutateAsync(requestAccountId);
      showDrawerToast(successMessage);
    } catch {
      showDrawerToast('계좌 상태 변경 요청에 실패했습니다');
      return;
    }

    await refreshStatusData(status);
  };

  const handleCopyCredential = async (value: string) => {
    if (value === emptyValue) {
      showDrawerToast('복사할 값이 없습니다', 2000);
      return;
    }

    const copied = await copyTextToClipboard(value);
    showDrawerToast(copied ? '복사되었습니다' : '복사에 실패했습니다', 2000);
  };

  const actionBadge = (action: string) => {
    const normalized = action.toUpperCase();
    if (normalized === 'BUY')
      return (
        <span
          style={{
            display: 'inline-flex',
            padding: '1px 8px',
            borderRadius: 20,
            fontSize: 10,
            fontWeight: 600,
            background: 'rgba(22,163,74,0.15)',
            color: '#16A34A',
          }}
        >
          {action}
        </span>
      );
    if (normalized === 'SELL')
      return (
        <span
          style={{
            display: 'inline-flex',
            padding: '1px 8px',
            borderRadius: 20,
            fontSize: 10,
            fontWeight: 600,
            background: 'rgba(220,38,38,0.15)',
            color: '#DC2626',
          }}
        >
          {action}
        </span>
      );
    return (
      <span
        style={{
          display: 'inline-flex',
          padding: '1px 8px',
          borderRadius: 20,
          fontSize: 10,
          fontWeight: 500,
          border: `1px solid ${t.border2}`,
          color: t.textSec,
        }}
      >
        {action}
      </span>
    );
  };

  const profitColor = (p: string) =>
    p.startsWith('+') && p !== '+$0.00' ? '#16A34A' : p.startsWith('-') ? '#DC2626' : t.textSec;

  const footerBtn = (
    label: string,
    bg: string,
    color: string,
    onClick: () => void,
    border?: string,
  ) => (
    <button
      onClick={onClick}
      style={{
        height: 30,
        padding: '0 14px',
        borderRadius: 6,
        border: border ? `1px solid ${border}` : 'none',
        background: bg,
        color,
        fontSize: 11,
        fontWeight: 500,
        fontFamily: "'Noto Sans KR',sans-serif",
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );

  useEffect(() => {
    if (!showTradeHistory) return;

    if (tradeData && !isPlaceholderData && tradePage !== safeTradePage) {
      setTradePage(safeTradePage);
    }
  }, [isPlaceholderData, safeTradePage, showTradeHistory, tradeData, tradePage]);

  return (
    <>
      <style>{`@keyframes slideUpFade{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.3)' }}
      />
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 820,
          zIndex: 95,
          background: t.surface,
          borderLeft: `1px solid ${t.border}`,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-4px 0 32px rgba(0,0,0,0.15)',
          fontFamily: "'DM Sans','Noto Sans KR',sans-serif",
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
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 600, color: t.text }}>
            계좌 상세 — {accountId}
          </span>
          <ModalCloseBtn onClick={onClose} t={t} />
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none', padding: 22 }}>
          {/* Summary cards */}
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}
          >
            {[
              { label: '자본금', value: capital, color: t.text },
              { label: '계좌잔고', value: balance, color: t.text },
              { label: '총 수익', value: totalProfit, color: profitColor(totalProfit) },
            ].map((c) => (
              <div key={c.label} style={{ background: t.surface2, borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 11, color: t.textHint, marginBottom: 6 }}>{c.label}</div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: c.color,
                    fontFamily: "'DM Mono',monospace",
                  }}
                >
                  {c.value}
                </div>
              </div>
            ))}
          </div>

          {/* Platform Credentials */}
          <div
            style={{
              background: t.surface2,
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: t.textSec,
                marginBottom: 10,
              }}
            >
              Platform Credentials
            </div>
            {[
              ['Platform', 'MT4'],
              ['Server', server],
              ['Login', login],
              ['Password', password],
            ].map(([label, value], i, arr) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '7px 0',
                  borderBottom: i < arr.length - 1 ? `1px solid ${t.border}` : 'none',
                }}
              >
                <span style={{ fontSize: 11, color: t.textHint }}>{label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{ fontSize: 12, fontFamily: "'DM Mono',monospace", color: t.textSec }}
                  >
                    {value}
                  </span>
                  {(label === 'Login' || label === 'Password') && (
                    <button
                      onClick={() => void handleCopyCredential(value)}
                      onMouseEnter={() => setCopyHov(label)}
                      onMouseLeave={() => setCopyHov(null)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: copyHov === label ? t.accent : t.textHint,
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        transition: 'color 0.15s',
                      }}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Challenge Result (웹 Account Detail '챌린지 결과'와 같은 내용, 대회 종료 후 판정이 있을 때만) */}
          {evaluation && evaluation.checks.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>챌린지 결과</span>
                <span
                  style={{
                    display: 'inline-flex',
                    padding: '1px 8px',
                    borderRadius: 20,
                    fontSize: 10,
                    fontWeight: 600,
                    background:
                      evaluation.result === 'PASSED' ? 'rgba(22,163,74,0.15)' : 'rgba(220,38,38,0.15)',
                    color: evaluation.result === 'PASSED' ? '#16A34A' : '#DC2626',
                  }}
                >
                  {evaluation.result === 'PASSED' ? '통과' : '실패'}
                </span>
              </div>
              <div style={{ border: `1px solid ${t.border}`, borderRadius: 10, overflow: 'hidden' }}>
                {evaluation.checks.map((check, i, arr) => {
                  const [name, detailText] = describeRuleCheck(check);
                  return (
                    <div
                      key={check.key}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 12,
                        padding: '9px 12px',
                        fontSize: 12,
                        borderBottom: i < arr.length - 1 ? `1px solid ${t.border}` : 'none',
                      }}
                    >
                      <span style={{ color: t.text, fontWeight: 500 }}>
                        {name}
                        {detailText ? (
                          <span style={{ color: t.textSec, fontWeight: 400 }}> : {detailText}</span>
                        ) : null}
                      </span>
                      <span
                        style={{
                          flexShrink: 0,
                          fontSize: 11,
                          fontWeight: 600,
                          color: check.passed ? '#16A34A' : '#DC2626',
                        }}
                      >
                        {check.passed ? '통과' : '위반'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Funded Account: 이 챌린지 계좌로 발급된 펀디드 계좌 (발급 버튼은 Leaderboard '펀디드계좌' 열) */}
          {detail?.tier === 'CHALLENGE' && detail.funded_account_id && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>펀디드 계좌</span>
                <span style={{ fontSize: 10, color: t.textHint }}>
                  {detail.funded_issue_method === 'MANUAL' ? '수동 발급 상품' : '자동 발급 상품'}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '10px 12px',
                  border: `1px solid ${t.border}`,
                  borderRadius: 10,
                  fontSize: 12,
                }}
              >
                <>
                  <span style={{ color: t.text }}>
                    MT4{' '}
                    <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 600 }}>
                      {asDisplay(detail.funded_mt4_login, '번호 할당 전')}
                    </span>
                    {detail.funded_start_at && detail.funded_provision_status !== 'DONE' ? (
                      <span style={{ color: t.textSec }}>
                        {' '}
                        · 발급 예정 {formatKstDateTimeParts(detail.funded_start_at).date}{' '}
                        {formatKstDateTimeParts(detail.funded_start_at).time}
                      </span>
                    ) : null}
                  </span>
                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: 11,
                      fontWeight: 600,
                      color: detail.funded_provision_status === 'DONE' ? '#16A34A' : '#D97706',
                    }}
                  >
                    {fundedProvisionLabel(detail.funded_provision_status)}
                  </span>
                </>
              </div>
            </div>
          )}

          {showTradeHistory && (
            <>
              {/* Trade History */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>거래 내역</span>
                <span style={{ fontSize: 10, color: t.textHint }}>
                  {buildPaginationSummary({
                    totalItems: totalTradeRows,
                    start: tradePaginationRange.start,
                    end: tradePaginationRange.end,
                    unit: '건',
                  })}
                </span>
              </div>

              <div
                style={{
                  background: t.surface,
                  border: `1px solid ${t.border}`,
                  borderRadius: 12,
                  overflow: 'hidden',
                  marginBottom: 12,
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: 72 }} />
                    <col style={{ width: 130 }} />
                    <col style={{ width: 72 }} />
                    <col style={{ width: 72 }} />
                    <col style={{ width: 50 }} />
                    <col style={{ width: 64 }} />
                    <col style={{ width: 72 }} />
                    <col />
                  </colgroup>
                  <thead>
                    <tr style={{ background: t.surface2, borderBottom: `1px solid ${t.border}` }}>
                      {[
                        'DEAL',
                        '날짜 / 시간',
                        'SYMBOL',
                        'ACTION',
                        'ENTRY',
                        'VOLUME',
                        'PRICE',
                        'PROFIT',
                      ].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: '8px 8px',
                            textAlign: 'left',
                            fontSize: 10,
                            fontWeight: 600,
                            color: t.textHint,
                            letterSpacing: '0.07em',
                            textTransform: 'uppercase',
                            fontFamily: "'DM Sans',sans-serif",
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tradeRows.map((row: AccountTrade, i) => {
                      const tradeDate = formatKstDateTimeParts(row.date);
                      const netProfit = row.profit + row.fee + row.swap;
                      const profit = formatSignedUsdMoney(netProfit);

                      return (
                        <tr
                          key={row.deal_id}
                          style={{
                            borderBottom:
                              i < tradeRows.length - 1 ? `1px solid ${t.border}` : 'none',
                            height: 44,
                          }}
                        >
                          <td style={{ padding: '0 8px' }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontFamily: "'DM Mono',monospace",
                                color: t.textSec,
                              }}
                            >
                              {row.deal_id}
                            </span>
                          </td>
                          <td style={{ padding: '0 8px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              <span style={{ fontSize: 11, color: t.textSec }}>
                                {tradeDate.date}
                              </span>
                              <span
                                style={{ fontSize: 9, color: t.textHint, fontStyle: 'italic' }}
                              >
                                {tradeDate.time} (GMT+9)
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '0 8px' }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontFamily: "'DM Mono',monospace",
                                color: t.textSec,
                              }}
                            >
                              {asDisplay(row.symbol)}
                            </span>
                          </td>
                          <td style={{ padding: '0 8px' }}>
                            {actionBadge(asDisplay(row.action))}
                          </td>
                          <td style={{ padding: '0 8px' }}>
                            <span style={{ fontSize: 11, color: t.textSec }}>
                              {asDisplay(row.entry)}
                            </span>
                          </td>
                          <td style={{ padding: '0 8px' }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontFamily: "'DM Mono',monospace",
                                color: t.textSec,
                              }}
                            >
                              {asDisplay(row.volume)}
                            </span>
                          </td>
                          <td style={{ padding: '0 8px' }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontFamily: "'DM Mono',monospace",
                                color: t.textSec,
                              }}
                            >
                              {asDisplay(row.price)}
                            </span>
                          </td>
                          <td style={{ padding: '0 8px', textAlign: 'right' }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontFamily: "'DM Mono',monospace",
                                color: profitColor(profit),
                                fontWeight: 500,
                              }}
                            >
                              {profit}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <TablePagination
                summary={buildPaginationSummary({
                  totalItems: totalTradeRows,
                  start: tradePaginationRange.start,
                  end: tradePaginationRange.end,
                })}
                containerStyle={{ padding: '12px 0 0', borderTop: 'none' }}
                borderColor="transparent"
                textColor={t.textHint}
                activeBackground={t.accent}
                inactiveBackground={t.surface2}
                inactiveBorderColor={t.border2}
                items={buildPaginationItems({
                  currentPage: safeTradePage,
                  totalPages: totalTradePages,
                  onPageChange: setTradePage,
                })}
              />
            </>
          )}
        </div>

        {/* Sticky footer */}
        <div
          style={{
            borderTop: `1px solid ${t.border}`,
            padding: '12px 22px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            flexShrink: 0,
          }}
        >
          {footerBtn(
            '활성 복귀',
            t.surface2,
            t.textSec,
            () => runAccountAction(unfreezeAccountMutation, 'ACTIVE', '계좌가 활성 복귀되었습니다'),
            t.border2,
          )}
          {footerBtn('비활성', 'rgba(217,119,6,0.1)', '#D97706', () =>
            setDrawerConfirm('inactive'),
          )}
          {footerBtn('영구정지', 'rgba(220,38,38,0.1)', '#DC2626', () =>
            setDrawerConfirm('banned'),
          )}
        </div>
      </div>

      {/* Drawer confirmation modals */}
      {drawerConfirm === 'inactive' && (
        <AccountInactiveModal
          dark={dark}
          onCancel={() => setDrawerConfirm(null)}
          onConfirm={async () => {
            setDrawerConfirm(null);
            await runAccountAction(freezeAccountMutation, 'INACTIVE', '계좌가 비활성 처리되었습니다');
          }}
        />
      )}
      {drawerConfirm === 'banned' && (
        <AccountBannedModal
          dark={dark}
          onCancel={() => setDrawerConfirm(null)}
          onConfirm={async (reason) => {
            setDrawerConfirm(null);
            if (!requestAccountId) {
              showDrawerToast('계좌 ID를 확인할 수 없습니다');
              return;
            }

            try {
              await banAccountMutation.mutateAsync({
                accountId: requestAccountId,
                payload: { reason },
              });
              showDrawerToast('영구정지 처리되었습니다');
            } catch {
              showDrawerToast('계좌 상태 변경 요청에 실패했습니다');
              return;
            }

            await refreshStatusData('BANNED');
          }}
        />
      )}

      {/* Drawer-local toast */}
      {drawerToast && (
        <div
          style={{
            position: 'fixed',
            bottom: 32,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 120,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: dark ? '#E8EAF0' : '#1A1A1A',
            color: dark ? '#1A1A1A' : '#ffffff',
            borderRadius: 12,
            padding: '12px 16px',
            fontSize: 13,
            fontWeight: 500,
            fontFamily: "'Noto Sans KR','DM Sans',sans-serif",
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
            animation: 'slideUpFade 0.22s ease',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#16A34A',
              flexShrink: 0,
            }}
          />
          {drawerToast}
        </div>
      )}
    </>
  );
}
