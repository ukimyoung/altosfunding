-- 백오피스 Leaderboard '확인하기': 챌린지 계좌 통과 여부 판정 결과.
-- 관리자가 확인할 때마다 한 줄씩 쌓이고, 화면에는 계좌별 마지막 판정을 보여 준다.
-- checks: 룰별 결과 [{key, label, passed, detail}] (룰셋 판정 로직은 별도 설계 후 추가).
create table core.challenge_evaluations (
  id              bigserial primary key,
  account_id      uuid not null references core.trading_accounts (id) on delete cascade,
  challenge_id    text not null references core.challenges (id) on delete cascade,
  ruleset_id      text references core.rulesets (id) on delete set null,
  result          text not null check (result in ('PASSED', 'FAILED')),
  period_start    timestamptz not null,
  period_end      timestamptz not null,
  capital         numeric(18, 2) not null,
  equity          numeric(18, 2) not null,
  profit          numeric(18, 2) not null,
  profit_rate     numeric(12, 4) not null,
  trades_count    integer not null default 0,
  open_positions  integer not null default 0,
  checks          jsonb not null default '[]'::jsonb,
  rules_applied   integer not null default 0,
  evaluated_by    uuid references core.users (id) on delete set null,
  created_at      timestamptz not null default now()
);

create index challenge_evaluations_account_idx on core.challenge_evaluations (account_id, created_at desc);
create index challenge_evaluations_challenge_idx on core.challenge_evaluations (challenge_id);
alter table core.challenge_evaluations enable row level security;
