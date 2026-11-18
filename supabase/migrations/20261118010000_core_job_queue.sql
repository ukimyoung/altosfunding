-- 백그라운드 작업 큐 (Render Background Worker가 처리한다).
-- Celery·Redis 없이 Postgres 테이블 + FOR UPDATE SKIP LOCKED로 여러 Worker가 같은 작업을 두 번 잡지 않게 한다.
-- 기존 서버 broker_command(PENDING → SENT → VERIFIED/FAILED, attempt_count·max_retries)를 일반화한 것이다.
-- 이후 MT4 계좌 발급·잔고 조정·청산 같은 외부 호출을 여기에 넣고 Worker가 재시도한다.

create table core.jobs (
  id bigint generated always as identity primary key,
  kind text not null,                                -- 작업 종류 (예: mt4.create_account). Worker에 처리기가 등록돼 있어야 한다.
  payload jsonb not null default '{}'::jsonb,        -- 처리기에 넘기는 값
  status text not null default 'PENDING'
    check (status in ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED')),
  priority integer not null default 0,               -- 클수록 먼저
  attempts integer not null default 0,               -- 지금까지 시작한 횟수
  max_attempts integer not null default 5 check (max_attempts >= 1),
  run_at timestamptz not null default now(),         -- 이 시각 이후에 실행 (재시도 때는 다음 시도 시각)
  dedupe_key text,                                   -- 같은 값으로 아직 끝나지 않은 작업이 있으면 새로 넣지 않는다
  ref_type text,                                     -- 관련 대상 (예: challenge_order, account)
  ref_id text,
  locked_by text,                                    -- 처리 중인 Worker
  locked_at timestamptz,
  last_error text,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);

-- Worker가 꺼낼 작업
create index jobs_due_idx on core.jobs (priority desc, run_at) where status = 'PENDING';
-- 오래 RUNNING에 머문 작업(Worker가 죽은 경우) 찾기
create index jobs_running_idx on core.jobs (locked_at) where status = 'RUNNING';
create index jobs_ref_idx on core.jobs (ref_type, ref_id) where ref_id is not null;
create index jobs_kind_created_idx on core.jobs (kind, created_at desc);
create unique index jobs_dedupe_active_idx on core.jobs (dedupe_key)
  where dedupe_key is not null and status in ('PENDING', 'RUNNING');

-- 시도 이력. 시도마다 한 줄 (성공·실패·오류 내용).
create table core.job_attempts (
  id bigint generated always as identity primary key,
  job_id bigint not null references core.jobs(id) on delete cascade,
  attempt integer not null,
  worker_id text,
  status text not null check (status in ('RUNNING', 'SUCCEEDED', 'FAILED', 'RETRY', 'ABANDONED')),
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index job_attempts_job_idx on core.job_attempts (job_id, attempt);

-- Worker 생존 확인. Worker가 주기 작업을 돌 때마다 last_seen_at을 갱신한다.
create table core.worker_heartbeats (
  worker_id text primary key,                        -- 호스트 이름-프로세스 번호
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_tick jsonb                                    -- 마지막 주기 작업 결과 (만든 회차 수 등)
);

alter table core.jobs enable row level security;
alter table core.job_attempts enable row level security;
alter table core.worker_heartbeats enable row level security;
