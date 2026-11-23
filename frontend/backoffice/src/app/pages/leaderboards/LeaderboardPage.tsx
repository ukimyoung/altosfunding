import { useCallback, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useSearchParams } from 'react-router';
import { useAppShell } from '../../layouts/AppShell';
import { Toast } from '../../components/shared/Toast';
import { LeaderboardDateNav } from '../../components/leaderboard/LeaderboardDateNav';
import { LeaderboardStatCards } from '../../components/leaderboard/LeaderboardStatCards';
import { NormalRankTable } from '../../components/leaderboard/NormalRankTable';
import { VipRankTable } from '../../components/leaderboard/VipRankTable';
import { LeaderboardEvaluationModal } from '../../components/leaderboard/LeaderboardEvaluationModal';
import { IssueFundedModal } from '../../components/accounts/IssueFundedModal';
import { useIssueFundedAccountMutation } from '../../queries/accounts';
import {
  useChallengeSummaryStatsQuery,
  useDailyLeaderboardQuery,
  useEvaluateLeaderboardAccountMutation,
} from '../../queries/challenges';
import type {
  ChallengeEvaluation,
  ChallengeSummaryStatsResponse,
  DailyLeaderboardEntry,
} from '../../../api/challenge';
import type { LeaderboardStats, LeaderboardStatus, RankEntry, VipEntry } from '../../types/leaderboard';
import { formatKstDateTime } from '../../utils/utils';
import { todayInSeoul } from '../../utils/revenue';

type ToastState = {
  message: string;
  type: 'success' | 'warning';
};

type LeaderboardTab = 'normal' | 'vip';

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

function roundRate(value: number) {
  return Math.round(value * 100) / 100;
}

/** 대회 종료 시각(cutoff_at)이 지났으면 종료 시점 기준, 아니면 최근 잔고 기준이라고 안내한다. */
function getBasisText(summary?: ChallengeSummaryStatsResponse) {
  const cutoffs = (summary?.challenges ?? [])
    .map((challenge) => challenge.cutoff_at ?? challenge.end_at)
    .filter((value): value is string => Boolean(value));
  if (!cutoffs.length) return null;

  const latest = cutoffs.reduce((a, b) => (new Date(a) > new Date(b) ? a : b));
  const label = `${formatKstDateTime(latest)} (KST)`;
  if (new Date(latest).getTime() <= Date.now()) {
    return `대회 종료 시점 ${label} 기준 수익률 순위`;
  }
  return `진행 중 · 최근 잔고 기준 수익률 순위 (종료 예정 ${label})`;
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

function mapEntry(entry: DailyLeaderboardEntry): RankEntry {
  return {
    id: entry.account_id,
    rank: entry.rank,
    accountNumber: String(entry.mt4_login),
    platform: 'MT4',
    accountStatus: entry.account_status,
    productName: entry.product_name,
    profitRate: roundRate(entry.profit_rate),
    profit: entry.profit,
    evaluationResult: entry.evaluation_result ?? null,
    evaluatedAt: entry.evaluated_at ?? null,
    fundedIssueMethod: entry.funded_issue_method ?? 'AUTO',
    fundedAccountId: entry.funded_account_id ?? null,
    fundedMt4Login: entry.funded_mt4_login ?? null,
    fundedProvisionStatus: entry.funded_provision_status ?? null,
    fundedStartAt: entry.funded_start_at ?? null,
  };
}

function mapVipEntry(entry: DailyLeaderboardEntry): VipEntry {
  return { ...mapEntry(entry), profitTarget: null };
}

export function LeaderboardPage() {
  const { dark } = useAppShell();
  const [searchParams, setSearchParams] = useSearchParams();
  // 날짜 = 대회 종료일(한국 시간). 메뉴로 들어와 ?date가 없으면 오늘(한국 시간)을 보여 준다.
  // 대회 목록에서 행을 누르면 ?date=종료일로 들어오므로 그 날짜를 그대로 쓴다.
  const currentDate = toInputDate(searchParams.get('date') ?? '') || todayInSeoul();
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('normal');
  const [toast, setToast] = useState<ToastState | null>(null);
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);
  const [evaluationView, setEvaluationView] = useState<{
    accountNumber: string;
    evaluation: ChallengeEvaluation;
  } | null>(null);
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

  const { data: summaryData } = useChallengeSummaryStatsQuery({ target_date: currentDate });
  const { data: normalData, isLoading: isNormalLoading, isError: isNormalError } =
    useDailyLeaderboardQuery({ date: apiDate, grade: 'NORMAL' });
  const { data: vipData, isLoading: isVipLoading, isError: isVipError } = useDailyLeaderboardQuery({
    date: apiDate,
    grade: 'VIP',
  });
  const evaluateMutation = useEvaluateLeaderboardAccountMutation();
  const issueFundedMutation = useIssueFundedAccountMutation();
  const [issueTarget, setIssueTarget] = useState<RankEntry | null>(null);
  const [issuingId, setIssuingId] = useState<string | null>(null);

  const normalRows = useMemo(() => (normalData?.entries ?? []).map(mapEntry), [normalData?.entries]);
  const vipRows = useMemo(() => (vipData?.entries ?? []).map(mapVipEntry), [vipData?.entries]);

  const stats = useMemo(() => mapSummaryStats(summaryData), [summaryData]);
  const status = useMemo(() => mapSummaryStatus(summaryData), [summaryData]);
  const basisText = useMemo(() => getBasisText(summaryData), [summaryData]);

  const handleEvaluate = (accountId: string) => {
    const row = [...normalRows, ...vipRows].find((entry) => entry.id === accountId);
    setEvaluatingId(accountId);
    evaluateMutation.mutate(accountId, {
      onSuccess: (evaluation) => {
        setEvaluationView({ accountNumber: row?.accountNumber ?? '', evaluation });
      },
      onError: (error) => {
        setToast({
          message: getApiErrorMessage(error, '통과 여부 확인에 실패했습니다'),
          type: 'warning',
        });
      },
      onSettled: () => setEvaluatingId(null),
    });
  };

  // '펀디드계좌' 열의 '펀디드 계좌 발급' → 확인 팝업 → 지금 발급
  const handleIssueFunded = (entry: RankEntry) => {
    setIssueTarget(null);
    setIssuingId(entry.id);
    issueFundedMutation.mutate(entry.id, {
      onSuccess: () => {
        setToast({ message: `${entry.accountNumber} 펀디드 계좌 발급을 시작했습니다`, type: 'success' });
      },
      onError: (error) => {
        setToast({
          message: getApiErrorMessage(error, '펀디드 계좌 발급에 실패했습니다'),
          type: 'warning',
        });
      },
      onSettled: () => setIssuingId(null),
    });
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

  const tabStyle = (tab: LeaderboardTab) => ({
    padding: '12px 20px',
    background: activeTab === tab ? t.tabActive : 'transparent',
    border: 'none',
    borderBottom: activeTab === tab ? `2px solid ${t.accent}` : 'none',
    color: activeTab === tab ? t.text : t.textSec,
    fontSize: 14,
    fontWeight: activeTab === tab ? 600 : 500,
    cursor: 'pointer',
    borderRadius: '8px 8px 0 0',
  });

  return (
    <div style={{ background: t.pageBg, minHeight: '100vh' }}>
      <LeaderboardDateNav
        dark={dark}
        currentDate={currentDate}
        status={status}
        participantCount={stats.totalParticipants}
        basisText={basisText}
        onDateChange={handleDateChange}
        onInvalidDateSelect={handleInvalidDateSelect}
      />

      <LeaderboardStatCards dark={dark} stats={stats} />

      <div style={{ padding: '0 24px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, borderBottom: `1px solid ${t.border}` }}>
          <button onClick={() => setActiveTab('normal')} style={tabStyle('normal')}>
            일반 순위
          </button>
          <button onClick={() => setActiveTab('vip')} style={tabStyle('vip')}>
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

        {/* 오른쪽 '승격 대상 목록' 영역은 삭제 (2026-11-20 요청). 통과 여부는 행의 '확인하기'로 판정 */}
        {activeTab === 'normal' ? (
          <NormalRankTable
            dark={dark}
            data={normalRows}
            evaluatingId={evaluatingId}
            onEvaluate={handleEvaluate}
            issuingId={issuingId}
            onIssueFunded={setIssueTarget}
          />
        ) : (
          <VipRankTable
            dark={dark}
            data={vipRows}
            evaluatingId={evaluatingId}
            onEvaluate={handleEvaluate}
            issuingId={issuingId}
            onIssueFunded={setIssueTarget}
          />
        )}
      </div>

      {evaluationView && (
        <LeaderboardEvaluationModal
          dark={dark}
          accountNumber={evaluationView.accountNumber}
          evaluation={evaluationView.evaluation}
          onClose={() => setEvaluationView(null)}
        />
      )}
      {issueTarget && (
        <IssueFundedModal
          dark={dark}
          accountNumber={issueTarget.accountNumber}
          manual={issueTarget.fundedIssueMethod === 'MANUAL'}
          onCancel={() => setIssueTarget(null)}
          onConfirm={() => handleIssueFunded(issueTarget)}
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
