import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useSearchParams } from 'react-router';
import { useAppShell } from '../../layouts/AppShell';
import { Toast } from '../../components/shared/Toast';
import { LeaderboardDateNav } from '../../components/leaderboard/LeaderboardDateNav';
import { LeaderboardStatCards } from '../../components/leaderboard/LeaderboardStatCards';
import { NormalRankTable } from '../../components/leaderboard/NormalRankTable';
import { NormalPromotePanel } from '../../components/leaderboard/NormalPromotePanel';
import { VipRankTable } from '../../components/leaderboard/VipRankTable';
import { VipPromotePanel } from '../../components/leaderboard/VipPromotePanel';
import { LeaderboardConfirmModal } from '../../components/leaderboard/LeaderboardConfirmModal';
import {
  useChallengeSummaryStatsQuery,
  useDailyLeaderboardQuery,
  useNotifyFailedByAccountsMutation,
  usePromoteByAccountsMutation,
} from '../../queries/challenges';
import type { ChallengeSummaryStatsResponse, DailyLeaderboardEntry } from '../../../api/challenge';
import type { LeaderboardStats, LeaderboardStatus, RankEntry, VipEntry } from '../../types/leaderboard';

type ToastState = {
  message: string;
  type: 'success' | 'warning';
};

type LeaderboardTab = 'normal' | 'vip';
type ConfirmModalState =
  | { type: 'approve-normal'; count: number }
  | { type: 'approve-vip'; count: number }
  | { type: 'fail-normal'; count: number }
  | null;

const EMPTY_DATE_KEY = '__empty__';
const INVALID_DATE_MESSAGE = '대회 조회 데이터가 없습니다';
const LEADERBOARD_STATUS_PRIORITY: LeaderboardStatus[] = ['ACTIVE', 'CLOSED'];

function toApiDate(value: string) {
  return value.replace(/-/g, '');
}

function toInputDate(value: string) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
  return '';
}

function toApprovalStatus(
  accountStatus: string,
  approvedIds: string[],
  failedIds: string[],
  accountId: string,
) {
  if (approvedIds.includes(accountId) || accountStatus === 'PASSED') {
    return 'approved' as const;
  }
  if (failedIds.includes(accountId) || accountStatus === 'FAILED') {
    return 'failed' as const;
  }
  if (accountStatus === 'CLOSED') {
    return 'not-approved' as const;
  }

  return null;
}

function mapNormalEntries(
  entries: DailyLeaderboardEntry[],
  approvedIds: string[],
  failedIds: string[],
): RankEntry[] {
  return entries.map((entry) => ({
    id: entry.account_id,
    rank: entry.rank,
    accountNumber: String(entry.mt4_login),
    platform: 'MT4',
    accountStatus: entry.account_status,
    productName: entry.product_name,
    profitRate: entry.profit_rate,
    profit: entry.profit,
    isPassed: entry.is_passed,
    approvalStatus: toApprovalStatus(entry.account_status, approvedIds, failedIds, entry.account_id),
  }));
}

function mapVipEntries(entries: DailyLeaderboardEntry[], approvedIds: string[]): VipEntry[] {
  return entries.map((entry) => ({
    id: entry.account_id,
    rank: entry.rank,
    accountNumber: String(entry.mt4_login),
    platform: 'MT4',
    accountStatus: entry.account_status,
    productName: entry.product_name,
    profitRate: entry.profit_rate,
    profit: entry.profit,
    profitTarget: null,
    isPassed: entry.is_passed,
    approvalStatus: toApprovalStatus(entry.account_status, approvedIds, [], entry.account_id),
  }));
}

function getServerApprovedIds(entries: DailyLeaderboardEntry[]) {
  return entries
    .filter((entry) => entry.account_status === 'PASSED')
    .map((entry) => entry.account_id);
}

function getDefaultNormalSelection(entries: DailyLeaderboardEntry[]) {
  const passedIds = getServerApprovedIds(entries);
  const eligibleEntries = entries
    .filter((entry) => entry.account_status !== 'PASSED' && entry.account_status !== 'FAILED' && entry.is_passed)
    .sort((a, b) => a.rank - b.rank);
  const topCount = Math.floor(entries.length * 0.1);

  return mergeUnique([
    ...passedIds,
    ...eligibleEntries.slice(0, topCount).map((entry) => entry.account_id),
  ]);
}

function getDefaultVipSelection(entries: DailyLeaderboardEntry[]) {
  return mergeUnique([
    ...getServerApprovedIds(entries),
    ...entries.filter((entry) => entry.is_passed).map((entry) => entry.account_id),
  ]);
}

function mergeUnique(ids: string[]) {
  return Array.from(new Set(ids));
}

function toNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function mapSummaryStats(summary?: ChallengeSummaryStatsResponse): LeaderboardStats {
  const stats = summary?.stats;

  return {
    totalParticipants: toNumber(stats?.total_active_participants),
    normalPromotionCandidates: toNumber(stats?.passed_count),
    vipAchievers: toNumber(stats?.vip_count),
    eliminated: toNumber(stats?.failed_count) + toNumber(stats?.withdrawn_count),
  };
}

function mapSummaryStatus(summary?: ChallengeSummaryStatsResponse): LeaderboardStatus | null {
  if (!summary?.challenges?.length) {
    return null;
  }

  const statuses = summary?.challenges
    .map((challenge) => challenge.status)
    .filter((status): status is LeaderboardStatus =>
      LEADERBOARD_STATUS_PRIORITY.includes(status as LeaderboardStatus),
    );

  return LEADERBOARD_STATUS_PRIORITY.find((status) => statuses?.includes(status)) ?? null;
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (!axios.isAxiosError(error)) {
    return fallback;
  }

  const data = error.response?.data;

  if (typeof data === 'string') {
    return data || fallback;
  }

  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    const message = record.message;

    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return fallback;
}

export function LeaderboardPage() {
  const { dark } = useAppShell();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentDate = toInputDate(searchParams.get('date') ?? '');
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('normal');
  const [normalSelectedByDate, setNormalSelectedByDate] = useState<Record<string, string[]>>({});
  const [vipSelectedByDate, setVipSelectedByDate] = useState<Record<string, string[]>>({});
  const [normalApprovedByDate, setNormalApprovedByDate] = useState<Record<string, string[]>>({});
  const [vipApprovedByDate, setVipApprovedByDate] = useState<Record<string, string[]>>({});
  const [normalFailedByDate, setNormalFailedByDate] = useState<Record<string, string[]>>({});
  const [toast, setToast] = useState<ToastState | null>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>(null);
  const lastInvalidDateRef = useRef<string | null>(null);

  const t = {
    surface: dark ? '#0F1829' : '#ffffff',
    border: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)',
    text: dark ? '#E8EAF0' : '#1A1A1A',
    textSec: dark ? '#8B8FA8' : '#4A4A58',
    textHint: dark ? '#5A6080' : '#A0A0AA',
    pageBg: dark ? '#0A0F1E' : '#F4F5F7',
    accent: '#7C6AF7',
    tabActive: dark ? '#1A2035' : '#E8EAF0',
  };

  const apiDate = currentDate ? toApiDate(currentDate) : '';
  const dateKey = currentDate || EMPTY_DATE_KEY;

  const { data: summaryData } = useChallengeSummaryStatsQuery({ target_date: currentDate });
  const { data: normalData, isLoading: isNormalLoading, isError: isNormalError } =
    useDailyLeaderboardQuery({ date: apiDate, grade: 'NORMAL' });
  const { data: vipData, isLoading: isVipLoading, isError: isVipError } = useDailyLeaderboardQuery({
    date: apiDate,
    grade: 'VIP',
  });
  const promoteByAccountsMutation = usePromoteByAccountsMutation();
  const notifyFailedByAccountsMutation = useNotifyFailedByAccountsMutation();

  const localNormalApprovedIds = normalApprovedByDate[dateKey] ?? [];
  const localVipApprovedIds = vipApprovedByDate[dateKey] ?? [];
  const localNormalFailedIds = normalFailedByDate[dateKey] ?? [];
  const serverNormalApprovedIds = useMemo(
    () => getServerApprovedIds(normalData?.entries ?? []),
    [normalData?.entries],
  );
  const serverVipApprovedIds = useMemo(
    () => getServerApprovedIds(vipData?.entries ?? []),
    [vipData?.entries],
  );
  const normalApprovedIds = useMemo(
    () => mergeUnique([...serverNormalApprovedIds, ...localNormalApprovedIds]),
    [localNormalApprovedIds, serverNormalApprovedIds],
  );
  const vipApprovedIds = useMemo(
    () => mergeUnique([...serverVipApprovedIds, ...localVipApprovedIds]),
    [localVipApprovedIds, serverVipApprovedIds],
  );

  const normalRows = useMemo(
    () => mapNormalEntries(normalData?.entries ?? [], normalApprovedIds, localNormalFailedIds),
    [localNormalFailedIds, normalApprovedIds, normalData?.entries],
  );
  const vipRows = useMemo(
    () => mapVipEntries(vipData?.entries ?? [], vipApprovedIds),
    [vipApprovedIds, vipData?.entries],
  );

  useEffect(() => {
    if (!currentDate || !normalData) return;

    setNormalSelectedByDate((prev) => {
      if (dateKey in prev) {
        return prev;
      }

      return {
        ...prev,
        [dateKey]: mergeUnique([
          ...normalApprovedIds,
          ...getDefaultNormalSelection(normalData.entries),
        ]),
      };
    });
  }, [currentDate, dateKey, normalApprovedIds, normalData]);

  useEffect(() => {
    if (!currentDate || !vipData) return;

    setVipSelectedByDate((prev) => {
      if (dateKey in prev) {
        return prev;
      }

      return {
        ...prev,
        [dateKey]: mergeUnique([...vipApprovedIds, ...getDefaultVipSelection(vipData.entries)]),
      };
    });
  }, [currentDate, dateKey, vipApprovedIds, vipData]);

  const normalSelected = normalSelectedByDate[dateKey] ?? [];
  const vipSelected = vipSelectedByDate[dateKey] ?? [];

  const selectedNormalEntries = normalRows.filter((entry) => normalSelected.includes(entry.id));
  const selectedVipEntries = vipRows.filter((entry) => vipSelected.includes(entry.id));

  const approvedCount = normalRows.filter((entry) => entry.approvalStatus === 'approved').length;
  const notApprovedCount = normalRows.filter(
    (entry) => entry.approvalStatus === 'not-approved' || entry.approvalStatus === 'failed',
  ).length;
  const vipApprovedCount = vipRows.filter((entry) => entry.approvalStatus === 'approved').length;
  const vipNotApprovedCount = vipRows.filter((entry) => entry.approvalStatus === 'not-approved').length;

  const stats = useMemo(() => mapSummaryStats(summaryData), [summaryData]);
  const status = useMemo(() => mapSummaryStatus(summaryData), [summaryData]);

  const updateNormalSelected = (nextValue: string[] | ((prev: string[]) => string[])) => {
    setNormalSelectedByDate((prev) => {
      const current = prev[dateKey] ?? [];
      const next = typeof nextValue === 'function' ? nextValue(current) : nextValue;

      return {
        ...prev,
        [dateKey]: next,
      };
    });
  };

  const updateVipSelected = (nextValue: string[] | ((prev: string[]) => string[])) => {
    setVipSelectedByDate((prev) => {
      const current = prev[dateKey] ?? [];
      const next = typeof nextValue === 'function' ? nextValue(current) : nextValue;

      return {
        ...prev,
        [dateKey]: next,
      };
    });
  };

  const handleToggleNormalSelect = (id: string) => {
    const entry = normalRows.find((row) => row.id === id);
    if (entry?.approvalStatus === 'approved' || entry?.approvalStatus === 'failed') {
      return;
    }

    updateNormalSelected((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    );
  };

  const handleToggleNormalAll = () => {
    const unapprovedEntries = normalRows.filter(
      (entry) => entry.approvalStatus !== 'approved' && entry.approvalStatus !== 'failed',
    );
    const allUnapprovedSelected = unapprovedEntries.every((entry) => normalSelected.includes(entry.id));

    if (allUnapprovedSelected) {
      updateNormalSelected(normalApprovedIds);
      return;
    }

    updateNormalSelected(mergeUnique([...normalApprovedIds, ...unapprovedEntries.map((entry) => entry.id)]));
  };

  const handleToggleVipSelect = (id: string) => {
    const entry = vipRows.find((row) => row.id === id);
    if (entry?.approvalStatus === 'approved') {
      return;
    }

    updateVipSelected((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    );
  };

  const handleToggleVipAll = () => {
    const unapprovedEntries = vipRows.filter((entry) => entry.approvalStatus !== 'approved');
    const allUnapprovedSelected = unapprovedEntries.every((entry) => vipSelected.includes(entry.id));

    if (allUnapprovedSelected) {
      updateVipSelected(vipApprovedIds);
      return;
    }

    updateVipSelected(vipRows.map((entry) => entry.id));
  };

  const handleApproveNormal = () => {
    const pendingCount = selectedNormalEntries.filter(
      (entry) => entry.approvalStatus !== 'approved' && entry.approvalStatus !== 'failed',
    ).length;
    setConfirmModal({ type: 'approve-normal', count: pendingCount });
  };

  const handleConfirmApproveNormal = () => {
    const newlyApprovedIds = selectedNormalEntries
      .filter((entry) => entry.approvalStatus !== 'approved' && entry.approvalStatus !== 'failed')
      .map((entry) => entry.id);

    promoteByAccountsMutation.mutate({
      account_ids: newlyApprovedIds,
      note: '',
    }, {
      onSuccess: () => {
        setConfirmModal(null);
        setNormalApprovedByDate((prev) => ({
          ...prev,
          [dateKey]: mergeUnique([...(prev[dateKey] ?? []), ...newlyApprovedIds]),
        }));
        setToast({
          message: `${newlyApprovedIds.length}명의 펀디드 계좌 발급이 승인되었습니다`,
          type: 'success',
        });
      },
      onError: (error) => {
        setConfirmModal(null);
        setToast({
          message: getApiErrorMessage(error, '펀디드 계좌 발급 승인에 실패했습니다'),
          type: 'warning',
        });
      },
    });
  };

  const handleClearNormalSelection = () => {
    updateNormalSelected(normalApprovedIds);
  };

  const handleMarkFailedNormal = () => {
    const pendingCount = selectedNormalEntries.filter(
      (entry) => entry.approvalStatus !== 'approved' && entry.approvalStatus !== 'failed',
    ).length;
    setConfirmModal({ type: 'fail-normal', count: pendingCount });
  };

  const handleConfirmMarkFailedNormal = () => {
    const failedIds = selectedNormalEntries
      .filter((entry) => entry.approvalStatus !== 'approved' && entry.approvalStatus !== 'failed')
      .map((entry) => entry.id);

    notifyFailedByAccountsMutation.mutate({
      account_ids: failedIds,
      note: '',
    }, {
      onSuccess: () => {
        setConfirmModal(null);
        setNormalFailedByDate((prev) => ({
          ...prev,
          [dateKey]: mergeUnique([...(prev[dateKey] ?? []), ...failedIds]),
        }));
        updateNormalSelected((prev) => prev.filter((id) => !failedIds.includes(id)));
        setToast({
          message: `${failedIds.length}명이 불합격 처리되었습니다`,
          type: 'warning',
        });
      },
      onError: (error) => {
        setConfirmModal(null);
        setToast({
          message: getApiErrorMessage(error, '불합격 처리에 실패했습니다'),
          type: 'warning',
        });
      },
    });
  };

  const handleApproveVip = () => {
    const pendingCount = selectedVipEntries.filter((entry) => entry.approvalStatus !== 'approved').length;
    setConfirmModal({ type: 'approve-vip', count: pendingCount });
  };

  const handleConfirmApproveVip = () => {
    const newlyApprovedIds = selectedVipEntries
      .filter((entry) => entry.approvalStatus !== 'approved')
      .map((entry) => entry.id);

    promoteByAccountsMutation.mutate({
      account_ids: newlyApprovedIds,
      note: '',
    }, {
      onSuccess: () => {
        setConfirmModal(null);
        setVipApprovedByDate((prev) => ({
          ...prev,
          [dateKey]: mergeUnique([...(prev[dateKey] ?? []), ...newlyApprovedIds]),
        }));
        setToast({
          message: `${newlyApprovedIds.length}명의 VIP 승격이 승인되었습니다`,
          type: 'success',
        });
      },
      onError: (error) => {
        setConfirmModal(null);
        setToast({
          message: getApiErrorMessage(error, 'VIP 승격 승인에 실패했습니다'),
          type: 'warning',
        });
      },
    });
  };

  const handleClearVipSelection = () => {
    updateVipSelected(vipApprovedIds);
  };

  const handleDateChange = useCallback((date: string) => {
    lastInvalidDateRef.current = null;
    setSearchParams((prev) => {
      const nextApiDate = toApiDate(date);

      if (prev.get('date') === nextApiDate) {
        return prev;
      }

      const next = new URLSearchParams(prev);
      if (nextApiDate) {
        next.set('date', nextApiDate);
      } else {
        next.delete('date');
      }

      return next;
    }, { replace: true });
    setToast((prev) => (prev?.message === INVALID_DATE_MESSAGE ? null : prev));
  }, [setSearchParams]);

  const handleInvalidDateSelect = useCallback((date: string) => {
    setToast((prev) => {
      if (prev?.message === INVALID_DATE_MESSAGE && lastInvalidDateRef.current === date) {
        return prev;
      }

      lastInvalidDateRef.current = date;
      return { message: INVALID_DATE_MESSAGE, type: 'warning' };
    });
  }, []);

  const isCurrentTabLoading = activeTab === 'normal' ? isNormalLoading : isVipLoading;
  const isCurrentTabError = activeTab === 'normal' ? isNormalError : isVipError;

  return (
    <div style={{ background: t.pageBg, minHeight: '100vh' }}>
      <LeaderboardDateNav
        dark={dark}
        currentDate={currentDate}
        status={status}
        participantCount={stats.totalParticipants}
        onDateChange={handleDateChange}
        onInvalidDateSelect={handleInvalidDateSelect}
      />

      <LeaderboardStatCards dark={dark} stats={stats} />

      <div style={{ padding: '0 24px', marginBottom: 16 }}>
        <div
          style={{
            display: 'flex',
            gap: 8,
            borderBottom: `1px solid ${t.border}`,
          }}
        >
          <button
            onClick={() => setActiveTab('normal')}
            style={{
              padding: '12px 20px',
              background: activeTab === 'normal' ? t.tabActive : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'normal' ? `2px solid ${t.accent}` : 'none',
              color: activeTab === 'normal' ? t.text : t.textSec,
              fontSize: 14,
              fontWeight: activeTab === 'normal' ? 600 : 500,
              cursor: 'pointer',
              borderRadius: '8px 8px 0 0',
            }}
          >
            일반 순위
          </button>
          <button
            onClick={() => setActiveTab('vip')}
            style={{
              padding: '12px 20px',
              background: activeTab === 'vip' ? t.tabActive : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'vip' ? `2px solid ${t.accent}` : 'none',
              color: activeTab === 'vip' ? t.text : t.textSec,
              fontSize: 14,
              fontWeight: activeTab === 'vip' ? 600 : 500,
              cursor: 'pointer',
              borderRadius: '8px 8px 0 0',
            }}
          >
            VIP 현황
          </button>
        </div>
      </div>

      <div style={{ padding: '0 24px 32px' }}>
        {(isCurrentTabLoading || isCurrentTabError) && (
          <div
            style={{
              marginBottom: 12,
              padding: '12px 16px',
              borderRadius: 10,
              background: t.surface,
              border: `1px solid ${t.border}`,
              color: isCurrentTabError ? '#DC2626' : t.textSec,
              fontSize: 13,
            }}
          >
            {isCurrentTabLoading
              ? '리더보드 데이터를 불러오는 중입니다.'
              : '리더보드 데이터를 불러오지 못했습니다.'}
          </div>
        )}

        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ flex: 1 }}>
            {activeTab === 'normal' ? (
              <NormalRankTable
                dark={dark}
                data={normalRows}
                selectedIds={normalSelected}
                onToggleSelect={handleToggleNormalSelect}
                onToggleAll={handleToggleNormalAll}
                isClosed={false}
              />
            ) : (
              <VipRankTable
                dark={dark}
                data={vipRows}
                selectedIds={vipSelected}
                onToggleSelect={handleToggleVipSelect}
                onToggleAll={handleToggleVipAll}
              />
            )}
          </div>

          {activeTab === 'normal' ? (
            <NormalPromotePanel
              dark={dark}
              selectedEntries={selectedNormalEntries}
              approvedCount={approvedCount}
              notApprovedCount={notApprovedCount}
              onApprove={handleApproveNormal}
              onMarkFailed={handleMarkFailedNormal}
              onClearSelection={handleClearNormalSelection}
              isClosed={false}
            />
          ) : (
            <VipPromotePanel
              dark={dark}
              selectedEntries={selectedVipEntries}
              approvedCount={vipApprovedCount}
              notApprovedCount={vipNotApprovedCount}
              onApprove={handleApproveVip}
              onClearSelection={handleClearVipSelection}
            />
          )}
        </div>
      </div>

      {confirmModal?.type === 'approve-normal' && (
        <LeaderboardConfirmModal
          dark={dark}
          title="펀디드 계좌 발급 최종 승인"
          message={`총 ${confirmModal.count}명에게 MT4 펀디드 계좌가 자동 발급됩니다. 이 작업은 되돌릴 수 없습니다.`}
          confirmLabel="승인 확정"
          confirmColor="#16A34A"
          onCancel={() => setConfirmModal(null)}
          onConfirm={handleConfirmApproveNormal}
        />
      )}
      {confirmModal?.type === 'approve-vip' && (
        <LeaderboardConfirmModal
          dark={dark}
          title="VIP 승격 최종 승인"
          message={`총 ${confirmModal.count}명의 VIP 승격이 확정됩니다. 이 작업은 되돌릴 수 없습니다.`}
          confirmLabel="승인 확정"
          confirmColor="#D97706"
          onCancel={() => setConfirmModal(null)}
          onConfirm={handleConfirmApproveVip}
        />
      )}
      {confirmModal?.type === 'fail-normal' && (
        <LeaderboardConfirmModal
          dark={dark}
          title="불합격 처리 확인"
          message={`선택된 ${confirmModal.count}명을 불합격 처리하시겠습니까? 불합격 처리된 계좌는 읽기 전용으로 변경되며, 해당 회원에게 불합격 안내 이메일이 발송됩니다. 이 작업은 되돌릴 수 없습니다.`}
          confirmLabel="불합격 처리"
          confirmColor="#DC2626"
          onCancel={() => setConfirmModal(null)}
          onConfirm={handleConfirmMarkFailedNormal}
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
