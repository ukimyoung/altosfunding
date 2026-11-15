-- 상품(챌린지·펀디드·데모·라이브 계좌 종류)과 룰셋(드로다운·합격 조건), 플랫폼 설정.

-- ── 룰셋 ────────────────────────────────────────────────────
create table core.rulesets (
  id                      text primary key,
  name                    text not null default 'Unnamed Ruleset',
  daily_loss_limit_pct    numeric(7,3) not null default 5,
  -- 최대 드로다운은 일반·VIP 회원을 따로 둔다 (비율과 금액 중 하나 이상)
  max_dd_normal_pct       numeric(7,3) not null default 10,
  max_dd_normal_amt       numeric(18,2),
  max_dd_vip_pct          numeric(7,3) not null default 10,
  max_dd_vip_amt          numeric(18,2),
  max_dd_lookback_days    integer not null default 45,
  dd_calc_method          text not null default 'STATIC'
                            check (dd_calc_method in ('STATIC', 'EOD', 'INTRADAY')),
  stop_out_pct            numeric(7,3),
  -- 합격 조건: RELATIVE(수익률) / ABSOLUTE(금액)
  pass_condition_type     text not null default 'RELATIVE',
  pass_condition_pct      numeric(7,3),
  pass_condition_amt      numeric(18,2),
  pass_condition_vip_type text not null default 'ABSOLUTE',
  pass_condition_vip_pct  numeric(7,3),
  pass_condition_vip_amt  numeric(18,2),
  profit_target_pct       numeric(7,3),
  min_trading_days        integer not null default 5,
  inactivity_days         integer not null default 30,
  retry_policy            text not null default 'NONE'
                            check (retry_policy in ('NONE', 'ONCE', 'UNLIMITED', 'FORBIDDEN')),
  is_most_popular         boolean not null default false,
  -- 룰 변경을 새 계좌에만 적용할지(NEW) 기존 계좌에도 적용할지(ALL)
  apply_scope             text not null default 'NEW',
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table core.rulesets enable row level security;

create trigger rulesets_set_updated_at
  before update on core.rulesets
  for each row execute function core.set_updated_at();

-- ── 상품 ────────────────────────────────────────────────────
create table core.products (
  id                        text primary key,               -- 예: CHALLENGE_10K
  name                      text not null,
  type_code                 text,
  description               text,
  capital                   numeric(18,2) not null check (capital > 0),
  price_usdt                numeric(18,2) not null default 0 check (price_usdt >= 0),
  tier_type                 text not null default 'CHALLENGE'
                              check (tier_type in ('CHALLENGE', 'FUNDED', 'DEMO', 'LIVE')),
  is_active                 boolean not null default true,
  is_recommended            boolean not null default false,
  ruleset_id                text references core.rulesets (id) on delete set null,

  -- MT4 설정: 이 상품으로 만드는 계좌의 그룹·레버리지·계좌번호 범위
  mt4_group                 text not null default 'default',
  leverage                  integer not null default 100 check (leverage > 0),
  mt4_login_pool_start      bigint not null default 100000,
  mt4_login_pool_end        bigint not null default 199999,
  last_mt4_login            bigint,
  -- 합격 시 이어지는 다음 단계 상품 (챌린지 → 펀디드)
  next_product_id           text references core.products (id) on delete set null,
  funding_start_delay_hours integer not null default 0,
  duration_days             integer not null default 30,

  margin_call_pct           numeric(7,3),
  stop_out_pct              numeric(7,3),

  -- 정산
  payout_ratio              numeric(5,2) not null default 80,
  payout_period_days        integer not null default 14,
  violation_policy          text not null default 'AUTO_SUSPEND'
                              check (violation_policy in ('AUTO_SUSPEND', 'ALERT_ONLY', 'MANUAL_BLOCK')),

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint products_login_pool_check check (mt4_login_pool_start <= mt4_login_pool_end)
);

create index products_tier_type_idx on core.products (tier_type, is_active);
create index products_ruleset_id_idx on core.products (ruleset_id);

alter table core.products enable row level security;

create trigger products_set_updated_at
  before update on core.products
  for each row execute function core.set_updated_at();

-- ── 플랫폼 설정 (관리자가 바꾸는 운영 값) ───────────────────
create table core.platform_config (
  scope       text not null,      -- DEMO, PAYOUT, RISK, CHALLENGE, LIVE, SYSTEM, REWARD
  key         text not null,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now(),
  primary key (scope, key)
);

alter table core.platform_config enable row level security;

create trigger platform_config_set_updated_at
  before update on core.platform_config
  for each row execute function core.set_updated_at();

-- 데모 계좌 생성 화면의 선택지 기본값
insert into core.platform_config (scope, key, value, description) values
  ('DEMO', 'allowed_leverages', '[100, 200, 500]', '데모 계좌 레버리지 선택지'),
  ('DEMO', 'allowed_capitals', '[10000, 50000, 100000]', '데모 계좌 자본금 선택지 (USDT)'),
  ('DEMO', 'default_leverage', '100', '데모 계좌 기본 레버리지'),
  ('DEMO', 'default_capital', '10000', '데모 계좌 기본 자본금 (USDT)');
