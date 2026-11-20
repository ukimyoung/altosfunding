-- 트레이딩 룰 자동 검증 1단계 (기록만): Worker가 1분마다 계좌를 감시하고, 거래일 마감마다 결산하고,
-- 대회가 끝나면 최종 판정을 자동으로 기록한다. 계좌 상태·MT4 잠금은 바꾸지 않는다 (2단계에서 조치).
--
-- 거래일 = MT4 서버 시간대(기본 Europe/Athens) 날짜. 마감 = 그 날짜의 다음 날 0시 (KST 06:00/07:00).
--
-- core.account_risk_state    계좌별 현재 감시 상태 1행 (Max Drawdown 기준선, 오늘 시작 잔고 등)
-- core.account_daily_stats   계좌 × 거래일 결산 1행
-- core.rule_violations       룰 위반 기록 (HARD = 탈락·정지 사유, WARN = 경고)
-- core.challenge_evaluations.source  MANUAL(관리자 '확인하기') | AUTO(대회 종료 자동 판정)

create table core.account_risk_state (
  account_id             uuid primary key references core.trading_accounts (id) on delete cascade,
  ruleset_id             text references core.rulesets (id) on delete set null,
  capital                numeric(18, 2) not null,
  -- Max Drawdown 금액과 기준선. 평가금액(미실현 포함)이 기준선 이하가 되면 위반. 금액이 없으면 null(검사 안 함).
  dd_amount              numeric(18, 2),
  dd_floor               numeric(18, 2),
  -- 지금까지 마감 평가금액 중 최고값 (EOD trailing 기준)
  peak_close_equity      numeric(18, 2),
  -- 아직 마감하지 않은 거래일과 그 날의 시작 잔고·평가금액 (= 전 거래일 마감 값, 첫날은 자본금)
  current_trading_date   date not null,
  day_start_balance      numeric(18, 2) not null,
  day_start_equity       numeric(18, 2) not null,
  last_equity            numeric(18, 2),
  last_checked_at        timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
alter table core.account_risk_state enable row level security;

create table core.account_daily_stats (
  account_id        uuid not null references core.trading_accounts (id) on delete cascade,
  trading_date      date not null,
  -- 결산 구간 (UTC). 대회 시작·종료가 하루 중간이면 그 시각으로 잘린다.
  period_start      timestamptz not null,
  period_end        timestamptz not null,
  start_balance     numeric(18, 2) not null,
  start_equity      numeric(18, 2) not null,
  close_balance     numeric(18, 2) not null,
  close_equity      numeric(18, 2) not null,
  -- 하루 손익 = 마감 평가금액 − 시작 평가금액 (미실현 포함)
  day_pnl           numeric(18, 2) not null,
  low_equity        numeric(18, 2),
  high_equity       numeric(18, 2),
  -- 그날 진입 또는 청산 체결(매수·매도) 수. 1건 이상이면 거래일로 인정.
  fills_count       integer not null default 0,
  is_trading_day    boolean not null default false,
  dd_floor_before   numeric(18, 2),
  dd_floor_after    numeric(18, 2),
  closed_at         timestamptz not null default now(),
  primary key (account_id, trading_date)
);
alter table core.account_daily_stats enable row level security;

create table core.rule_violations (
  id               bigserial primary key,
  account_id       uuid not null references core.trading_accounts (id) on delete cascade,
  challenge_id     text references core.challenges (id) on delete set null,
  -- MAX_DRAWDOWN | DAILY_LOSS | CONSISTENCY
  rule_key         text not null,
  severity         text not null check (severity in ('HARD', 'WARN')),
  trading_date     date not null,
  detected_at      timestamptz not null default now(),
  observed_value   numeric(18, 4),
  limit_value      numeric(18, 4),
  detail           text,
  -- 감지 당시 적용한 룰셋 값 (룰셋이 나중에 바뀌어도 근거가 남는다)
  ruleset_snapshot jsonb not null default '{}'::jsonb,
  -- SHADOW: 기록만 (1단계) | ENFORCED: 조치까지 (2단계)
  mode             text not null default 'SHADOW' check (mode in ('SHADOW', 'ENFORCED')),
  action           text not null default 'NONE',
  status           text not null default 'OPEN' check (status in ('OPEN', 'ACTIONED', 'DISMISSED')),
  reviewed_by      uuid references core.users (id) on delete set null,
  reviewed_at      timestamptz,
  review_note      text,
  created_at       timestamptz not null default now()
);

-- 같은 계좌·룰·거래일은 한 번만 기록한다.
create unique index rule_violations_dedupe_idx on core.rule_violations (account_id, rule_key, trading_date);
create index rule_violations_detected_idx on core.rule_violations (detected_at desc);
alter table core.rule_violations enable row level security;

alter table core.challenge_evaluations
  add column source text not null default 'MANUAL' check (source in ('MANUAL', 'AUTO'));

-- Max Drawdown은 EOD trailing 기준 (2026-11-20 사용자 결정): 기본값을 EOD로 바꾸고 기존 STATIC 룰셋도 EOD로 맞춘다.
alter table core.rulesets alter column dd_calc_method set default 'EOD';
update core.rulesets set dd_calc_method = 'EOD', updated_at = now() where dd_calc_method = 'STATIC';
