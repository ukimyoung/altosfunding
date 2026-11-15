-- 챌린지 회차와 자동 생성 스케줄, 휴장일.
-- 시각은 모두 UTC로 저장한다. 기본 시작 22:00, 종료 21:00 (UTC)은 기존 서버와 같다.

-- ── 휴장일 ──────────────────────────────────────────────────
-- 스케줄의 exclude_holiday가 켜져 있으면 주말과 이 날짜를 건너뛴다.
create table core.holidays (
  id         bigint generated always as identity primary key,
  date       date not null unique,
  name       text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table core.holidays enable row level security;

create trigger holidays_set_updated_at
  before update on core.holidays
  for each row execute function core.set_updated_at();

-- ── 자동 생성 스케줄 ────────────────────────────────────────
create table core.challenge_schedules (
  id               bigint generated always as identity primary key,
  -- {date} {month} {day} {seq} {weekday} 를 바꿔 넣는다. 예: 'Daily Challenge #{seq} ({date})'
  name_template    text not null,
  product_id       text not null references core.products(id),
  group_size       integer not null default 50 check (group_size > 0),
  -- 다음 회차는 직전 회차 시작일 + interval_days 일의 start_time. 0이면 직전 회차 종료 뒤 바로.
  interval_days    integer not null check (interval_days >= 0),
  -- 테스트 전용: 값이 있으면 interval_days 대신 분 단위로 계산한다. 운영에서는 비워 둔다.
  interval_minutes integer check (interval_minutes > 0),
  duration_days    integer not null check (duration_days >= 0),
  -- 테스트 전용: 값이 있으면 duration_days 대신 시작 시각 + 분으로 종료한다.
  duration_minutes integer check (duration_minutes > 0),
  start_time       time not null default '22:00',
  end_time         time not null default '21:00',
  exclude_holiday  boolean not null default true,
  max_occurrences  integer check (max_occurrences > 0),
  status           text not null default 'ACTIVE'
                     check (status in ('ACTIVE', 'PAUSED', 'COMPLETED')),
  created_count    integer not null default 0,
  last_created_at  timestamptz,
  -- 이 시각이 지나면 다음 회차를 만든다. 비어 있으면 다음 실행 때 바로 만든다.
  next_run_at      timestamptz,
  description      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (duration_days > 0 or duration_minutes is not null)
);

create index challenge_schedules_due_idx on core.challenge_schedules (next_run_at) where status = 'ACTIVE';

alter table core.challenge_schedules enable row level security;

create trigger challenge_schedules_set_updated_at
  before update on core.challenge_schedules
  for each row execute function core.set_updated_at();

-- ── 챌린지 회차 ─────────────────────────────────────────────
-- PENDING(모집) → ACTIVE(진행) → CLOSED(종료), PENDING·ACTIVE → CANCELLED(취소)
create table core.challenges (
  id                    text primary key,
  product_id            text not null references core.products(id),
  challenge_schedule_id bigint references core.challenge_schedules(id),
  name                  text not null,
  group_size            integer not null default 50 check (group_size > 0),
  duration_days         integer,
  duration_minutes      integer,
  current_participants  integer not null default 0 check (current_participants >= 0),
  status                text not null default 'PENDING'
                          check (status in ('PENDING', 'ACTIVE', 'CLOSED', 'CANCELLED')),
  start_at              timestamptz not null,
  end_at                timestamptz not null,
  started_at            timestamptz,
  closed_at             timestamptz,
  cancel_reason         text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (end_at > start_at)
);

create index challenges_status_start_idx on core.challenges (status, start_at);
create index challenges_schedule_idx on core.challenges (challenge_schedule_id, start_at);
-- 같은 스케줄에서 같은 시작 시각의 회차가 두 번 만들어지지 않게 한다.
create unique index challenges_schedule_start_uniq on core.challenges (challenge_schedule_id, start_at)
  where challenge_schedule_id is not null;

alter table core.challenges enable row level security;

create trigger challenges_set_updated_at
  before update on core.challenges
  for each row execute function core.set_updated_at();
