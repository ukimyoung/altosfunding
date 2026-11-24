-- IB(제휴) 프로그램 정책: IB 프로필, 레벨별 커미션 비율, 마케팅 비율 (IB 차등 커미션 2단계)
--
-- PRD 5.3·5.4
--   - ib_profiles         회원 1명당 1행. 레벨 1~40, 상태 ACTIVE | INACTIVE | BANNED(영구정지).
--                         BANNED는 계산에서 INACTIVE와 같고, 다시 ACTIVE·INACTIVE로 바꿀 수 없다(서비스에서 막음).
--   - ib_profile_history  레벨·상태 변경 이력 (변경자·사유).
--   - ib_level_rate_sets  레벨 1~40 비율을 한 번에 저장하는 버전. effective_from부터 적용.
--     ib_level_rates      버전별 레벨 비율(%). 0 이상, 그 시점 마케팅 비율 이하(서비스에서 검사).
--   - marketing_policy_versions  판매금액 대비 마케팅 비율(%) 버전. effective_from부터 적용, 사유 필수.
-- 커미션 계산(3단계)은 결제 시각에 적용 중인 버전을 쓴다. 과거 주문은 다시 계산하지 않는다.

create table core.ib_profiles (
  user_id     uuid primary key references core.users (id) on delete cascade,
  level       integer not null check (level between 1 and 40),
  status      text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE', 'BANNED')),
  created_by  uuid references core.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index ib_profiles_status_idx on core.ib_profiles (status);

create trigger ib_profiles_set_updated_at
  before update on core.ib_profiles
  for each row execute function core.set_updated_at();
alter table core.ib_profiles enable row level security;

create table core.ib_profile_history (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references core.users (id) on delete cascade,
  change_type text not null check (change_type in ('CREATE', 'UPDATE')),
  old_level   integer,
  new_level   integer,
  old_status  text,
  new_status  text,
  reason      text,
  actor_id    uuid references core.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index ib_profile_history_user_idx on core.ib_profile_history (user_id, created_at desc);
alter table core.ib_profile_history enable row level security;

create table core.ib_level_rate_sets (
  id              bigint generated always as identity primary key,
  version         integer not null unique,
  effective_from  timestamptz not null,
  reason          text,
  actor_id        uuid references core.users (id) on delete set null,
  created_at      timestamptz not null default now()
);

create index ib_level_rate_sets_effective_idx on core.ib_level_rate_sets (effective_from desc, version desc);
alter table core.ib_level_rate_sets enable row level security;

create table core.ib_level_rates (
  set_id  bigint not null references core.ib_level_rate_sets (id) on delete cascade,
  level   integer not null check (level between 1 and 40),
  rate    numeric(7, 4) not null check (rate >= 0 and rate <= 100),   -- %
  primary key (set_id, level)
);
alter table core.ib_level_rates enable row level security;

create table core.marketing_policy_versions (
  id              bigint generated always as identity primary key,
  version         integer not null unique,
  rate            numeric(7, 4) not null check (rate >= 0 and rate <= 100),  -- 판매금액 대비 %
  effective_from  timestamptz not null,
  reason          text not null,
  actor_id        uuid references core.users (id) on delete set null,
  created_at      timestamptz not null default now()
);

create index marketing_policy_versions_effective_idx on core.marketing_policy_versions (effective_from desc, version desc);
alter table core.marketing_policy_versions enable row level security;

-- 기본값: 마케팅 비율 20%, 레벨 비율은 모두 0% (관리자가 정한다)
insert into core.marketing_policy_versions (version, rate, effective_from, reason)
values (1, 20, '2026-01-01T00:00:00Z', '초기값 (PRD 예시 20%)');

insert into core.ib_level_rate_sets (version, effective_from, reason)
values (1, '2026-01-01T00:00:00Z', '초기값 (모두 0%)');

insert into core.ib_level_rates (set_id, level, rate)
select s.id, g.level, 0
from core.ib_level_rate_sets s cross join generate_series(1, 40) as g(level)
where s.version = 1;
