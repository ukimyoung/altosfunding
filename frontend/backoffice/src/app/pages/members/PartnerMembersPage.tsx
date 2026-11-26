// 트레이더 관리 > 제휴사 회원 — 제휴사(10Power·xnsoft)에서 가져온 회원 목록과 가져오기 실행·이력.
// Core: /api/v1/admin/partner-members (목록·요약·가져오기 상태·실행·이력)
// 가져오기는 Worker가 작업 큐에서 실행한다. 실행 중에는 3초마다 상태를 다시 읽는다.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CloudDownload, History, RefreshCw, Search, Users, X } from 'lucide-react';
import { useAppShell } from '../../layouts/AppShell';
import { Toast } from '../../components/shared/Toast';
import { getMemberDetailRoute } from '../../config/navigation';
import { apiErrorMessage, formatKst } from '../../../api/affiliate';
import {
  getPartnerMemberSummary,
  getPartnerMembers,
  getSyncRun,
  getSyncRuns,
  getSyncState,
  startSync,
} from '../../../api/partnerMembers';
import type {
  PartnerMemberParams,
  PartnerSite,
  PartnerStatus,
  SyncMode,
  SyncRun,
} from '../../../api/partnerMembers';

const PAGE_SIZE = 20;
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
    queryKey: [...KEY, 'list', filters, page],
    queryFn: () => getPartnerMembers({ ...filters, page, size: PAGE_SIZE }),
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

  const pager = (current: number, pages: number, onChange: (p: number) => void) => (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 14 }}>
      <button type="button" disabled={current <= 1} onClick={() => onChange(current - 1)} style={button(false, current <= 1)}>이전</button>
      <span style={{ fontSize: 12, color: t.textSec, padding: '0 8px' }}>{current} / {Math.max(pages, 1)}</span>
      <button type="button" disabled={current >= pages} onClick={() => onChange(current + 1)} style={button(false, current >= pages)}>다음</button>
    </div>
  );

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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
        {[
          { label: '전체 회원', value: s?.total },
          { label: '계정 활성화', value: s?.linked },
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
              value={filters.linked === undefined ? '' : String(filters.linked)}
              onChange={(e) => setFilter({ linked: e.target.value === '' ? undefined : e.target.value === 'true' })}
              style={select}
            >
              <option value="">Altos 계정 전체</option>
              <option value="true">활성화됨</option>
              <option value="false">활성화 전</option>
            </select>
            <select value={filters.membership ?? ''} onChange={(e) => setFilter({ membership: (e.target.value || undefined) as PartnerMemberParams['membership'] })} style={select}>
              <option value="">구독 전체</option>
              <option value="active">구독 활성</option>
              <option value="expired">구독 만료</option>
              <option value="none">구독 이력 없음</option>
            </select>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1180 }}>
              <thead>
                <tr>
                  {['Member ID', '사이트', '이름', '이메일', '전화', '추천인 ID', '상태', '구독 만료일', '가입일 (GMT+9)', 'Altos 계정', '마지막 가져옴 (GMT+9)'].map((h) => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(members.data?.items ?? []).map((m) => (
                  <tr key={m.member_id}>
                    <td style={{ ...td, ...mono, fontWeight: 600 }}>{m.member_id}</td>
                    <td style={{ ...td, color: t.textSec }}>{m.site}</td>
                    <td style={td}>{m.name || '-'}</td>
                    <td style={{ ...td, color: m.email ? t.text : '#DC2626' }}>{m.email ?? '없음'}</td>
                    <td style={{ ...td, ...mono, color: t.textSec }}>{m.phone ?? '-'}</td>
                    <td style={{ ...td, ...mono, color: t.textSec }}>{m.sponsor_member_id ?? '-'}</td>
                    <td style={td}>{pill(STATUS_COLOR[m.status], STATUS_LABEL[m.status])}</td>
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
                        <span style={{ color: t.textHint }}>활성화 전</span>
                      )}
                      {m.user_status && m.user_status !== 'ACTIVE' ? <span style={{ marginLeft: 6 }}>{pill('#DC2626', m.user_status)}</span> : null}
                    </td>
                    <td style={{ ...td, color: t.textSec }}>{formatKst(m.last_synced_at)}</td>
                  </tr>
                ))}
                {members.data && members.data.items.length === 0 && (
                  <tr>
                    <td colSpan={11} style={{ ...td, textAlign: 'center', color: t.textHint, padding: 40 }}>
                      {s?.total ? '조건에 맞는 회원이 없습니다.' : '아직 가져온 회원이 없습니다. 위의 가져오기 버튼을 눌러 주세요.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 12, color: t.textHint, marginTop: 10 }}>총 {members.data?.total.toLocaleString() ?? 0}명</div>
          {members.data && members.data.pages > 1 && pager(page, members.data.pages, setPage)}
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
          {runs.data && runs.data.pages > 1 && pager(runsPage, runs.data.pages, setRunsPage)}
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
