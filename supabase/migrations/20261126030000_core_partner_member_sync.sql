-- 제휴사 회원 가져오기 이력.
--
-- Worker가 제휴사 회원 조회 API(GET /api/partner/v1/members)를 페이지 끝까지 불러 core.partner_members에 저장한다.
--   - FULL: since 없이 전체. 백오피스 '전체 다시 가져오기'.
--   - INCREMENTAL: 마지막 성공 회차 as_of − 5분을 since로 보내 바뀐 회원만. Worker 자동 주기와 '지금 가져오기'.
-- 한 번에 한 회차만 돈다(QUEUED·RUNNING 회차는 하나만, 부분 유니크 인덱스).
-- 제휴사 status=deleted를 받으면 연결된 Altos 계정을 INACTIVE로 바꾸고(사유 PARTNER_DELETED),
-- 다시 deleted가 아니게 되면 그 사유로 막힌 계정만 ACTIVE로 되돌린다. 건수는 deactivated·reactivated에 남긴다.

create table core.partner_member_sync_runs (
  id            bigint generated always as identity primary key,
  mode          text not null check (mode in ('FULL', 'INCREMENTAL')),
  status        text not null default 'QUEUED'
                  check (status in ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED')),
  requested_by  uuid references core.users (id),        -- 실행한 관리자, 자동 실행이면 null
  since         timestamptz,                             -- 보낸 since (FULL이면 null)
  as_of         timestamptz,                             -- 제휴사 응답 기준 시각(첫 페이지)
  pages         integer not null default 0,
  fetched       integer not null default 0,
  inserted      integer not null default 0,
  updated       integer not null default 0,
  unchanged     integer not null default 0,
  failed        integer not null default 0,
  deactivated   integer not null default 0,
  reactivated   integer not null default 0,
  last_cursor   text,                                    -- 마지막으로 저장한 페이지의 next_cursor
  error         text,
  failures      jsonb not null default '[]'::jsonb,      -- [{member_id, reason}] 건별 실패 (최대 500건)
  created_at    timestamptz not null default now(),
  started_at    timestamptz,
  finished_at   timestamptz
);

create unique index partner_member_sync_runs_one_active_key
  on core.partner_member_sync_runs ((true))
  where status in ('QUEUED', 'RUNNING');
create index partner_member_sync_runs_created_idx on core.partner_member_sync_runs (created_at desc);
create index partner_member_sync_runs_succeeded_idx
  on core.partner_member_sync_runs (finished_at desc) where status = 'SUCCEEDED';

alter table core.partner_member_sync_runs enable row level security;

alter table core.partner_members
  add column last_sync_run_id bigint references core.partner_member_sync_runs (id);
