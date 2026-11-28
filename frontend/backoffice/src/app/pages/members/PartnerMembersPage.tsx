// 트레이더 관리 > 제휴사 회원 — 제휴사(10Power·xnsoft)에서 가져온 회원 목록과 가져오기 실행·이력.
// Core: /api/v1/admin/partner-members (목록·요약·가져오기 상태·실행·이력)
// 가져오기는 Worker가 작업 큐에서 실행한다. 실행 중에는 3초마다 상태를 다시 읽는다.
// 회원사전가입: Member ID 앞 체크박스로 고른 회원만 Altos 계정을 활성화 전 상태로 미리 만든다 (자동 실행 없음).
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CloudDownload, History, RefreshCw, Search, UserPlus, Users, X } from 'lucide-react';
import { useAppShell } from '../../layouts/AppShell';
import { Toast } from '../../components/shared/Toast';
import {
  TablePagination,
  buildPaginationItems,
  buildPaginationSummary,
  getPaginationRange,
} from '../../components/shared/DataTable';
import { getMemberDetailRoute } from '../../config/navigation';
import { apiErrorMessage, formatKst } from '../../../api/affiliate';
import {
  getPartnerMemberSummary,
  getPartnerMembers,
  getSyncRun,
  getSyncRuns,
  getSyncState,
  preRegisterPartnerMembers,
  resyncPartnerNetwork,
  startSync,
} from '../../../api/partnerMembers';
import type {
  NetworkResult,
  PartnerMember,
  PartnerMemberParams,
  PreRegisterSkipReason,
  PartnerSite,
  PartnerStatus,
  SyncMode,
  SyncRun,
} from '../../../api/partnerMembers';

const PAGE_SIZES = [20, 50, 100] as const;
const PRE_REGISTER_MAX = 1000;
const SKIP_LABEL: Record<PreRegisterSkipReason, string> = {
  already_exists: '이미 계정 있음',
  no_email: '이메일 없음',
  withdrawn: '탈퇴한 계정 있음',
  not_found: '회원 없음',
};
const SPONSOR_SKIP_LABEL: Record<string, string> = {
  sponsor_not_found: '제휴사 추천인 없음',
  sponsor_no_account: '추천인 계정 없음',
  relation_cycle: '순환 관계',
  already_set: '이미 다른 추천인',
};
const networkSummary = (n: NetworkResult) => {
  const skipped = Object.entries(n.sponsor_skipped).filter(([, v]) => v);
  return [
    `IB 등록 ${n.ib_created.toLocaleString()}명`,
    `추천인 연결 ${n.sponsors_linked.toLocaleString()}명`,
    ...(skipped.length ? [`미연결 ${skipped.map(([k, v]) => `${SPONSOR_SKIP_LABEL[k] ?? k} ${v}`).join(', ')}`] : []),
  ].join(' · ');
};
// 사전 가입할 수 있는 회원: 아직 Altos 계정이 없고 이메일이 있는 회원
const canPreRegister = (m: PartnerMember) => !m.user_id && Boolean(m.email);
const KEY = ['partner-members'] as const;

const STATUS_LABEL: Record<PartnerStatus, string> = {
  active: '정상',
  unconfirmed: '이메일 확인 대기',
  suspended: '정지',
  deleted: '삭제',
};
const STATUS_COLOR: Record<PartnerStatus, string> = {
  active: '#16A34A',
  unconfirmed: '#2563EB',
  suspended: '#D97706',
  deleted: '#DC2626',
};
const RUN_LABEL: Record<string, string> = { QUEUED: '대기', RUNNING: '가져오는 중', SUCCEEDED: '성공', FAILED: '실패' };
const RUN_COLOR: Record<string, string> = { QUEUED: '#2563EB', RUNNING: '#2563EB', SUCCEEDED: '#16A34A', FAILED: '#DC2626' };
const MODE_LABEL: Record<SyncMode, string> = { INCREMENTAL: '변경분', FULL: '전체' };

export function PartnerMembersPage() {
  const { dark } = useAppShell();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'members' | 'runs'>('members');
  const [keywordInput, setKeywordInput] = useState('');
  const [filters, setFilters] = useState<PartnerMemberParams>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  // 회원사전가입 대상 (페이지를 넘겨도 유지). member_id → 제휴사 삭제 회원 여부
  const [selected, setSelected] = useState<Map<string, boolean>>(new Map());
  const [confirmPre, setConfirmPre] = useState(false);
  const [runsPage, setRunsPage] = useState(1);
  const [confirmFull, setConfirmFull] = useState(false);
  const [detailRunId, setDetailRunId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);

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
    accentBg: dark ? 'rgba(124,106,247,0.12)' : 'rgba(124,106,247,0.08)',
  };

  const syncState = useQuery({
    queryKey: [...KEY, 'sync'],
    queryFn: getSyncState,
    refetchInterval: (query) => (query.state.data?.running ? 3000 : 30000),
  });
  const running = syncState.data?.running ?? null;

  // 실행 중이던 회차가 끝나면 목록·요약·이력을 다시 읽는다.
  const [lastRunningId, setLastRunningId] = useState<number | null>(null);
  useEffect(() => {
    if (running) {
      setLastRunningId(running.id);
      return;
    }
    if (lastRunningId !== null) {
      setLastRunningId(null);
      void queryClient.invalidateQueries({ queryKey: KEY });
      getSyncRun(lastRunningId)
        .then((run) =>
          setToast(
            run.status === 'SUCCEEDED'
              ? { message: `가져오기 완료: ${run.fetched.toLocaleString()}건 (신규 ${run.inserted}, 변경 ${run.updated}, 실패 ${run.failed})`, type: 'success' }
              : { message: `가져오기 실패: ${run.error ?? '알 수 없는 오류'}`, type: 'warning' },
          ),
        )
        .catch(() => undefined);
    }
  }, [running, lastRunningId, queryClient]);

  const summary = useQuery({ queryKey: [...KEY, 'summary'], queryFn: getPartnerMemberSummary });
  const members = useQuery({
    queryKey: [...KEY, 'list', filters, page, pageSize],
    queryFn: () => getPartnerMembers({ ...filters, page, size: pageSize }),
    placeholderData: keepPreviousData,
  });
  const runs = useQuery({
    queryKey: [...KEY, 'runs', runsPage],
    queryFn: () => getSyncRuns(runsPage),
    placeholderData: keepPreviousData,
    enabled: tab === 'runs',
  });
  const runDetail = useQuery({
    queryKey: [...KEY, 'run', detailRunId],
    queryFn: () => getSyncRun(detailRunId as number),
    enabled: detailRunId !== null,
  });

  const start = useMutation({
    mutationFn: startSync,
    onSuccess: (run) => {
      setConfirmFull(false);
      setToast({ message: `${MODE_LABEL[run.mode]} 가져오기를 시작했습니다.`, type: 'success' });
      void queryClient.invalidateQueries({ queryKey: [...KEY, 'sync'] });
      void queryClient.invalidateQueries({ queryKey: [...KEY, 'runs'] });
    },
    onError: (error) => {
      setConfirmFull(false);
      setToast({ message: apiErrorMessage(error, '가져오기를 시작하지 못했습니다.'), type: 'warning' });
    },
  });

  const preRegister = useMutation({
    mutationFn: preRegisterPartnerMembers,
    onSuccess: (result) => {
      setConfirmPre(false);
      setSelected(new Map());
      const made = result.created.length + result.created_inactive.length;
      const parts = [`${made.toLocaleString()}명 사전 가입 완료`];
      if (result.created_inactive.length) parts.push(`제휴사 삭제 회원 ${result.created_inactive.length}명은 비활성으로 생성`);
      if (result.skipped.length) {
        const counts = new Map<string, number>();
        result.skipped.forEach((x) => counts.set(SKIP_LABEL[x.reason] ?? x.reason, (counts.get(SKIP_LABEL[x.reason] ?? x.reason) ?? 0) + 1));
        parts.push(`제외 ${result.skipped.length}명 (${[...counts].map(([k, v]) => `${k} ${v}`).join(', ')})`);
      }
      parts.push(networkSummary(result.network));
      setToast({ message: parts.join(' · '), type: result.skipped.length ? 'warning' : 'success' });
      void queryClient.invalidateQueries({ queryKey: KEY });
    },
    onError: (error) => {
      setConfirmPre(false);
      setToast({ message: apiErrorMessage(error, '사전 가입을 실행하지 못했습니다.'), type: 'warning' });
    },
  });

  const [confirmResync, setConfirmResync] = useState(false);
  const resync = useMutation({
    mutationFn: resyncPartnerNetwork,
    onSuccess: (result) => {
      setConfirmResync(false);
      setToast({ message: `다시 맞추기 완료: ${networkSummary(result)}`, type: 'success' });
      void queryClient.invalidateQueries({ queryKey: KEY });
    },
    onError: (error) => {
      setConfirmResync(false);
      setToast({ message: apiErrorMessage(error, 'IB 등록·추천인 연결을 실행하지 못했습니다.'), type: 'warning' });
    },
  });

  const toggle = (m: PartnerMember) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(m.member_id)) next.delete(m.member_id);
      else next.set(m.member_id, m.status === 'deleted');
      return next;
    });
  const pageEligible = (members.data?.items ?? []).filter(canPreRegister);
  const allPageSelected = pageEligible.length > 0 && pageEligible.every((m) => selected.has(m.member_id));
  const togglePage = () =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (allPageSelected) pageEligible.forEach((m) => next.delete(m.member_id));
      else pageEligible.forEach((m) => next.set(m.member_id, m.status === 'deleted'));
      return next;
    });
  const selectedDeleted = [...selected.values()].filter(Boolean).length;

  const setFilter = (patch: PartnerMemberParams) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };

  const card = { background: t.surface, borderRadius: 14, border: `1px solid ${t.border}`, padding: '18px 22px' };
  const select = {
    height: 36, padding: '0 10px', borderRadius: 8, border: `1px solid ${t.border2}`, background: t.surface2,
    color: t.text, fontSize: 12, outline: 'none',
  };
  const th = { padding: '10px 12px', textAlign: 'left' as const, fontSize: 11, fontWeight: 600, color: t.textSec, borderBottom: `1px solid ${t.border}`, whiteSpace: 'nowrap' as const };
  const td = { padding: '10px 12px', fontSize: 12, color: t.text, borderBottom: `1px solid ${t.border}`, whiteSpace: 'nowrap' as const };
  const mono = { fontFamily: "'DM Mono',monospace" };
  const button = (primary: boolean, disabled: boolean) => ({
    height: 36, padding: '0 14px', borderRadius: 8, border: primary ? 'none' : `1px solid ${t.border2}`,
    background: primary ? t.accent : t.surface, color: primary ? '#fff' : t.text, fontSize: 12, fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1,
    display: 'inline-flex', alignItems: 'center', gap: 6,
  });
  const pill = (color: string, label: string) => (
    <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: `${color}1A`, color }}>{label}</span>
  );

  const state = syncState.data;
  const canRun = Boolean(state?.configured) && !running && !start.isPending;
  const last = state?.last_succeeded;
  const s = summary.data;

  // 회원 목록과 같은 공용 페이지 이동 ('총 N명 중 a - b명 표시' + < 1 … 8 9 10 … 136 >)
  const pager = (
    data: { total: number; page: number; size: number; pages: number; items: unknown[] } | undefined,
    current: number,
    onChange: (p: number) => void,
    unit: string,
  ) => {
    const total = data?.total ?? 0;
    const pages = Math.max(1, data?.pages ?? 1);
    const safe = Math.min(Math.max(1, current), pages);
    const range = getPaginationRange({
      totalItems: total,
      currentPage: safe,
      pageSize: data?.size ?? pageSize,
      currentPageItemCount: data?.items.length ?? 0,
    });
    return (
      <TablePagination
        summary={buildPaginationSummary({ totalItems: total, start: range.start, end: range.end, unit })}
        containerStyle={{ padding: '12px 4px 0', marginTop: 4 }}
        borderColor={t.border}
        textColor={t.textHint}
        activeBackground={t.accent}
        inactiveBackground={t.surface2}
        inactiveBorderColor={t.border2}
        items={buildPaginationItems({ currentPage: safe, totalPages: pages, onPageChange: onChange })}
      />
    );
  };

  return (
    <div style={{ padding: 32, background: t.pageBg, minHeight: 'calc(100vh - 52px)' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: t.text, margin: 0, marginBottom: 8 }}>제휴사 회원</h1>
        <p style={{ fontSize: 13, color: t.textSec, margin: 0 }}>
          제휴사(10Power·xnsoft) 회원 조회 API에서 가져온 회원입니다. 회원은 Member ID로 처음 로그인할 때 등록 이메일 인증으로 Altos 계정을 활성화합니다.
        </p>
      </div>

      {/* 가져오기 상태·버튼 */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 18, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: t.accentBg, color: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CloudDownload size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: t.text }}>
            회원 가져오기
            {state && !state.configured && pill('#DC2626', '제휴사 API 미설정')}
            {state?.mock && pill('#D97706', '가짜 데이터(mock)')}
            {running && pill('#2563EB', `${RUN_LABEL[running.status]} · ${running.fetched.toLocaleString()}건`)}
          </div>
          <div style={{ fontSize: 12, color: t.textSec }}>
            마지막 성공: {last ? `${formatKst(last.finished_at)} (GMT+9) · ${MODE_LABEL[last.mode]} ${last.fetched.toLocaleString()}건` : '없음'}
            {state && state.configured && state.interval_minutes > 0 && (
              <> · 자동 실행 {state.interval_minutes}분마다{state.next_auto_at ? `, 다음 ${formatKst(state.next_auto_at)}` : ''}</>
            )}
          </div>
          {state && !state.configured && (
            <div style={{ fontSize: 11, color: t.textHint }}>
              제휴사가 API 주소·전용 키를 발급하면 Render Core 환경변수 PARTNER_MEMBERS_API_URL·PARTNER_MEMBERS_API_KEY에 넣습니다.
            </div>
          )}
        </div>
        <button type="button" disabled={!canRun} onClick={() => start.mutate('INCREMENTAL')} style={button(true, !canRun)}>
          <RefreshCw size={14} /> 지금 가져오기
        </button>
        <button type="button" disabled={!canRun} onClick={() => setConfirmFull(true)} style={button(false, !canRun)}>
          전체 다시 가져오기
        </button>
      </div>

      {/* 요약 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
        {[
          { label: '전체 회원', value: s?.total },
          { label: '계정 활성화', value: s ? s.linked - s.pending : undefined },
          { label: '사전 가입 (활성화 전)', value: s?.pending },
          { label: '구독 활성', value: s?.membership_active },
          { label: '정지·삭제', value: s ? s.status.suspended + s.status.deleted : undefined },
          { label: '이메일 없음', value: s?.no_email },
        ].map((item) => (
          <div key={item.label} style={{ ...card, padding: '14px 18px' }}>
            <div style={{ fontSize: 12, color: t.textSec, marginBottom: 6 }}>{item.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: t.text, ...mono }}>{item.value?.toLocaleString() ?? '-'}</div>
          </div>
        ))}
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {([
          ['members', '회원 목록', Users],
          ['runs', '가져오기 이력', History],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            style={{
              height: 34, padding: '0 14px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
              background: tab === id ? t.accentBg : 'transparent', color: tab === id ? t.accent : t.textSec,
            }}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === 'members' ? (
        <div style={card}>
          {/* 회원사전가입 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={selected.size === 0 || preRegister.isPending}
              onClick={() => setConfirmPre(true)}
              style={button(true, selected.size === 0 || preRegister.isPending)}
            >
              <UserPlus size={14} /> 회원사전가입
            </button>
            <span style={{ fontSize: 12, color: selected.size ? t.text : t.textHint }}>
              {selected.size ? `${selected.size.toLocaleString()}명 선택됨` : '사전 가입할 회원을 Member ID 앞 체크박스로 선택하세요. (계정이 없고 이메일이 있는 회원만 선택할 수 있습니다)'}
            </span>
            {selected.size > 0 && (
              <button type="button" onClick={() => setSelected(new Map())} style={{ border: 'none', background: 'none', color: t.accent, fontSize: 12, cursor: 'pointer', padding: 0 }}>
                선택 해제
              </button>
            )}
            <button
              type="button"
              disabled={resync.isPending}
              onClick={() => setConfirmResync(true)}
              style={{ ...button(false, resync.isPending), marginLeft: 'auto' }}
              title="계정이 있는 모든 제휴 회원을 IB(레벨 1)로 등록하고 제휴사 추천인을 연결합니다"
            >
              <RefreshCw size={14} /> IB 등록·추천인 연결 다시 맞추기
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setFilter({ keyword: keywordInput.trim() || undefined });
              }}
              style={{ position: 'relative', flex: 1, minWidth: 240 }}
            >
              <Search size={14} color={t.textHint} style={{ position: 'absolute', left: 10, top: 11 }} />
              <input
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                placeholder="Member ID, 이름, 이메일, 전화, 추천인 ID로 검색"
                style={{ ...select, width: '100%', paddingLeft: 30, boxSizing: 'border-box' }}
              />
            </form>
            <select value={filters.site ?? ''} onChange={(e) => setFilter({ site: (e.target.value || undefined) as PartnerSite | undefined })} style={select}>
              <option value="">사이트 전체</option>
              <option value="10power">10power</option>
              <option value="xnsoft">xnsoft</option>
            </select>
            <select value={filters.status ?? ''} onChange={(e) => setFilter({ status: (e.target.value || undefined) as PartnerStatus | undefined })} style={select}>
              <option value="">상태 전체</option>
              {(Object.keys(STATUS_LABEL) as PartnerStatus[]).map((key) => (
                <option key={key} value={key}>{STATUS_LABEL[key]}</option>
              ))}
            </select>
            <select
              value={filters.account ?? ''}
              onChange={(e) => setFilter({ account: (e.target.value || undefined) as PartnerMemberParams['account'] })}
              style={select}
            >
              <option value="">Altos 계정 전체</option>
              <option value="none">계정 없음</option>
              <option value="pending">사전 가입 (활성화 전)</option>
              <option value="activated">활성화됨</option>
            </select>
            <select value={filters.membership ?? ''} onChange={(e) => setFilter({ membership: (e.target.value || undefined) as PartnerMemberParams['membership'] })} style={select}>
              <option value="">구독 전체</option>
              <option value="active">구독 활성</option>
              <option value="expired">구독 만료</option>
              <option value="none">구독 이력 없음</option>
            </select>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              style={select}
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>{n}개씩</option>
              ))}
            </select>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1300 }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: 36, paddingRight: 0 }}>
                    <input
                      type="checkbox"
                      aria-label="이 페이지에서 사전 가입할 수 있는 회원 모두 선택"
                      title="이 페이지에서 사전 가입할 수 있는 회원 모두 선택"
                      checked={allPageSelected}
                      disabled={pageEligible.length === 0}
                      onChange={togglePage}
                      style={{ cursor: pageEligible.length ? 'pointer' : 'not-allowed', accentColor: t.accent }}
                    />
                  </th>
                  {['Member ID', '사이트', '이름', '이메일', '전화', '추천인 ID', '상태', '멤버십 상태', '구독 만료일', '가입일 (GMT+9)', 'Altos 계정', '마지막 가져옴 (GMT+9)'].map((h) => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(members.data?.items ?? []).map((m) => (
                  <tr key={m.member_id} style={{ background: selected.has(m.member_id) ? t.accentBg : undefined }}>
                    <td style={{ ...td, width: 36, paddingRight: 0 }}>
                      <input
                        type="checkbox"
                        aria-label={`${m.member_id} 선택`}
                        title={m.user_id ? '이미 Altos 계정이 있습니다' : m.email ? '' : '이메일이 없어 사전 가입할 수 없습니다'}
                        checked={selected.has(m.member_id)}
                        disabled={!canPreRegister(m)}
                        onChange={() => toggle(m)}
                        style={{ cursor: canPreRegister(m) ? 'pointer' : 'not-allowed', accentColor: t.accent }}
                      />
                    </td>
                    <td style={{ ...td, ...mono, fontWeight: 600 }}>{m.member_id}</td>
                    <td style={{ ...td, color: t.textSec }}>{m.site}</td>
                    <td style={td}>{m.name || '-'}</td>
                    <td style={{ ...td, color: m.email ? t.text : '#DC2626' }}>{m.email ?? '없음'}</td>
                    <td style={{ ...td, ...mono, color: t.textSec }}>{m.phone ?? '-'}</td>
                    <td style={{ ...td, ...mono, color: t.textSec }}>
                      {m.sponsor_member_id ?? '-'}
                      {m.sponsor_mismatch ? (
                        // 계정의 Altos 추천인이 제휴사 추천인과 다르다 (자동으로 바꾸지 않는다)
                        <span
                          style={{ marginLeft: 6 }}
                          title={`Altos 추천인: ${m.linked_sponsor_member_id ?? m.linked_sponsor_uid ?? '없음'}`}
                        >
                          {pill('#D97706', '다름')}
                        </span>
                      ) : null}
                    </td>
                    <td style={td}>{pill(STATUS_COLOR[m.status], STATUS_LABEL[m.status])}</td>
                    {/* 제휴사 membership_active 값 그대로 */}
                    <td style={td}>{m.membership_active_partner ? pill('#16A34A', '활성') : pill('#6B7280', '비활성')}</td>
                    <td style={{ ...td, ...mono }}>
                      {m.membership_expires_on ? (
                        <span style={{ color: m.membership_active ? '#16A34A' : t.textHint }}>
                          {m.membership_expires_on}{m.membership_active ? '' : ' (만료)'}
                        </span>
                      ) : (
                        <span style={{ color: t.textHint }}>-</span>
                      )}
                    </td>
                    <td style={{ ...td, color: t.textSec }}>{formatKst(m.joined_at)}</td>
                    <td style={td}>
                      {m.user_id ? (
                        <button
                          type="button"
                          onClick={() => navigate(getMemberDetailRoute(m.user_id as string))}
                          style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: t.accent, fontSize: 12, ...mono, textDecoration: 'underline' }}
                          title={m.user_email ?? ''}
                        >
                          {m.user_uid}
                        </button>
                      ) : (
                        <span style={{ color: t.textHint }}>없음</span>
                      )}
                      {m.user_id && !m.activated_at ? <span style={{ marginLeft: 6 }}>{pill('#6B7280', '사전 가입 · 활성화 전')}</span> : null}
                      {m.user_status && m.user_status !== 'ACTIVE' ? <span style={{ marginLeft: 6 }}>{pill('#DC2626', m.user_status)}</span> : null}
                    </td>
                    <td style={{ ...td, color: t.textSec }}>{formatKst(m.last_synced_at)}</td>
                  </tr>
                ))}
                {members.data && members.data.items.length === 0 && (
                  <tr>
                    <td colSpan={13} style={{ ...td, textAlign: 'center', color: t.textHint, padding: 40 }}>
                      {s?.total ? '조건에 맞는 회원이 없습니다.' : '아직 가져온 회원이 없습니다. 위의 가져오기 버튼을 눌러 주세요.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {pager(members.data, page, setPage, '명')}
        </div>
      ) : (
        <div style={card}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1080 }}>
              <thead>
                <tr>
                  {['회차', '종류', '상태', '실행', 'since (GMT+9)', '받은 건수', '신규', '변경', '변화 없음', '실패', '계정 비활성·복구', '시작 (GMT+9)', '종료 (GMT+9)'].map((h) => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(runs.data?.items ?? []).map((run: SyncRun) => (
                  <tr key={run.id} onClick={() => setDetailRunId(run.id)} style={{ cursor: 'pointer' }}>
                    <td style={{ ...td, ...mono }}>#{run.id}</td>
                    <td style={td}>{MODE_LABEL[run.mode]}</td>
                    <td style={td} title={run.error ?? ''}>{pill(RUN_COLOR[run.status], RUN_LABEL[run.status])}</td>
                    <td style={{ ...td, color: t.textSec }}>{run.requested_by_email ?? '자동'}</td>
                    <td style={{ ...td, color: t.textSec }}>{run.since ? formatKst(run.since) : '-'}</td>
                    <td style={{ ...td, ...mono }}>{run.fetched.toLocaleString()}</td>
                    <td style={{ ...td, ...mono }}>{run.inserted}</td>
                    <td style={{ ...td, ...mono }}>{run.updated}</td>
                    <td style={{ ...td, ...mono, color: t.textSec }}>{run.unchanged}</td>
                    <td style={{ ...td, ...mono, color: run.failed ? '#DC2626' : t.textSec }}>{run.failed}</td>
                    <td style={{ ...td, ...mono, color: t.textSec }}>{run.deactivated} / {run.reactivated}</td>
                    <td style={{ ...td, color: t.textSec }}>{formatKst(run.started_at ?? run.created_at)}</td>
                    <td style={{ ...td, color: t.textSec }}>{formatKst(run.finished_at)}</td>
                  </tr>
                ))}
                {runs.data && runs.data.items.length === 0 && (
                  <tr><td colSpan={13} style={{ ...td, textAlign: 'center', color: t.textHint, padding: 40 }}>가져오기 이력이 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {pager(runs.data, runsPage, setRunsPage, '건')}
        </div>
      )}

      {/* IB 등록·추천인 연결 다시 맞추기 확인 */}
      {confirmResync && (
        <div onClick={() => !resync.isPending && setConfirmResync(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 460, background: t.surface, borderRadius: 12, border: `1px solid ${t.border}`, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 10 }}>
              <RefreshCw size={16} color={t.accent} /> IB 등록·추천인 연결 다시 맞추기
            </div>
            <div style={{ fontSize: 13, color: t.textSec, lineHeight: 1.7, marginBottom: 20 }}>
              Altos 계정이 있는 모든 제휴 회원을 IB(레벨 1)로 등록하고, 제휴사 추천인의 계정이 있으면 추천인·수당 조직 상위로 연결합니다.
              <br />이미 IB인 회원의 레벨·상태와 이미 추천인이 있는 회원의 관계는 바꾸지 않습니다.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setConfirmResync(false)} style={button(false, false)}>취소</button>
              <button type="button" disabled={resync.isPending} onClick={() => resync.mutate()} style={button(true, resync.isPending)}>
                {resync.isPending ? '실행 중...' : '실행'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 회원사전가입 확인 */}
      {confirmPre && (
        <div onClick={() => !preRegister.isPending && setConfirmPre(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 460, background: t.surface, borderRadius: 12, border: `1px solid ${t.border}`, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 10 }}>
              <UserPlus size={16} color={t.accent} /> 회원사전가입
            </div>
            <div style={{ fontSize: 13, color: t.textSec, lineHeight: 1.7, marginBottom: 20 }}>
              선택한 <b style={{ color: t.text }}>{selected.size.toLocaleString()}명</b>의 Altos 계정을 미리 만듭니다.
              <br />비밀번호가 없는 '활성화 전' 계정으로 만들어지며, 회원이 Member ID로 처음 로그인할 때 이메일 인증과 비밀번호 설정으로 활성화합니다.
              <br />환영 메일은 회원이 활성화할 때 보냅니다.
              <br />만든 계정은 IB(레벨 1)로 등록하고, 제휴사 추천인의 계정이 있으면 추천인·수당 조직 상위로 연결합니다.
              {selectedDeleted > 0 && (
                <><br /><span style={{ color: '#D97706' }}>제휴사에서 삭제된 회원 {selectedDeleted}명은 비활성 계정으로 만듭니다.</span></>
              )}
              {selected.size > PRE_REGISTER_MAX && (
                <><br /><span style={{ color: '#DC2626' }}>한 번에 {PRE_REGISTER_MAX.toLocaleString()}명까지 실행할 수 있습니다. 선택을 줄여 주세요.</span></>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setConfirmPre(false)} style={button(false, false)}>취소</button>
              <button
                type="button"
                disabled={preRegister.isPending || selected.size > PRE_REGISTER_MAX}
                onClick={() => preRegister.mutate([...selected.keys()])}
                style={button(true, preRegister.isPending || selected.size > PRE_REGISTER_MAX)}
              >
                {preRegister.isPending ? '실행 중...' : '사전 가입 실행'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 전체 다시 가져오기 확인 */}
      {confirmFull && (
        <div onClick={() => !start.isPending && setConfirmFull(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 440, background: t.surface, borderRadius: 12, border: `1px solid ${t.border}`, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 10 }}>
              <AlertTriangle size={16} color="#D97706" /> 전체 다시 가져오기
            </div>
            <div style={{ fontSize: 13, color: t.textSec, lineHeight: 1.7, marginBottom: 20 }}>
              제휴사 회원 전체를 처음부터 다시 받습니다. 회원 수에 따라 몇 분 걸릴 수 있습니다.
              <br />이미 활성화된 Altos 계정의 이메일·이름·전화는 바뀌지 않습니다.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setConfirmFull(false)} style={button(false, false)}>취소</button>
              <button type="button" disabled={start.isPending} onClick={() => start.mutate('FULL')} style={button(true, start.isPending)}>전체 다시 가져오기</button>
            </div>
          </div>
        </div>
      )}

      {/* 회차 상세 */}
      {detailRunId !== null && (
        <div onClick={() => setDetailRunId(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 620, maxHeight: '80vh', overflowY: 'auto', background: t.surface, borderRadius: 12, border: `1px solid ${t.border}`, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: t.text }}>가져오기 #{detailRunId}</div>
              <button type="button" onClick={() => setDetailRunId(null)} style={{ border: 'none', background: 'none', color: t.textSec, cursor: 'pointer' }}><X size={16} /></button>
            </div>
            {runDetail.data ? (
              <>
                <div style={{ fontSize: 12, color: t.textSec, lineHeight: 1.8, marginBottom: 12 }}>
                  {MODE_LABEL[runDetail.data.mode]} · {RUN_LABEL[runDetail.data.status]} · 실행 {runDetail.data.requested_by_email ?? '자동'}
                  <br />since {runDetail.data.since ? formatKst(runDetail.data.since, true) : '없음(전체)'} · 기준 시각(as_of) {formatKst(runDetail.data.as_of, true)}
                  <br />페이지 {runDetail.data.pages} · 받은 {runDetail.data.fetched} · 신규 {runDetail.data.inserted} · 변경 {runDetail.data.updated} · 변화 없음 {runDetail.data.unchanged} · 실패 {runDetail.data.failed}
                  <br />deleted로 비활성 {runDetail.data.deactivated} · 복구 {runDetail.data.reactivated}
                </div>
                {runDetail.data.error && (
                  <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(220,38,38,.08)', color: '#DC2626', fontSize: 12, marginBottom: 12, whiteSpace: 'pre-wrap' }}>
                    {runDetail.data.error}
                  </div>
                )}
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 8 }}>실패 항목 ({runDetail.data.failures.length})</div>
                {runDetail.data.failures.length ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr><th style={th}>Member ID</th><th style={th}>사유</th></tr></thead>
                    <tbody>
                      {runDetail.data.failures.map((f, i) => (
                        <tr key={`${f.member_id}-${i}`}>
                          <td style={{ ...td, ...mono }}>{f.member_id || '(없음)'}</td>
                          <td style={{ ...td, whiteSpace: 'normal', color: t.textSec }}>{f.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ fontSize: 12, color: t.textHint }}>없음</div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 12, color: t.textHint }}>불러오는 중...</div>
            )}
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} dark={dark} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}
