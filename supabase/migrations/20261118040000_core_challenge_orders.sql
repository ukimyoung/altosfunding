-- 챌린지 티켓 구매: 주문, 트레이딩(MT4) 계좌, MT4 계좌번호 기록, 원장 계정
--
-- 흐름
-- 1) 회원이 결제하면 (Core API, 한 트랜잭션)
--    - 통합 지갑에서 결제 금액 차감 + challenge_orders 1건 + trading_accounts 수량만큼(발급 대기 QUEUED)
--    - 분개: 차) LIABILITY:USER_WALLET / 대) LIABILITY:ORDER_PENDING (계좌 발급 전까지는 회원에게 줄 것이 남은 돈)
--    - 계좌마다 작업 큐(core.jobs)에 mt4.provision_challenge_account 작업을 넣는다.
-- 2) Worker가 계좌마다 MT4 번호 할당 → MT4 계좌 생성 → 자본금 입금을 하고 발급 완료(DONE)로 바꾼다.
--    - 분개: 차) LIABILITY:ORDER_PENDING / 대) REVENUE:CHALLENGE_SALES (계좌 1개 단가만큼)
-- 3) 재시도를 다 써도 발급하지 못한 계좌는 자동 환불한다 (FAILED).
--    - 분개(역분개): 차) LIABILITY:ORDER_PENDING / 대) LIABILITY:USER_WALLET, 지갑에 단가만큼 되돌림
--    - MT4에 계좌가 이미 만들어졌을 수 있으면 mt4_logins를 ORPHANED(정리 대상)로 남긴다.
-- 주문 상태: PENDING(발급 중) → 모든 계좌 처리 끝 → COMPLETED(1개 이상 발급) 또는 REFUNDED(전부 환불)

insert into core.ledger_accounts (code, name, account_type, description) values
  ('LIABILITY:ORDER_PENDING', '계좌 발급 대기 주문', 'LIABILITY', '챌린지를 결제했지만 MT4 계좌 발급이 끝나지 않은 금액'),
  ('REVENUE:CHALLENGE_SALES', '챌린지 판매 수입', 'REVENUE', '계좌 발급이 끝난 챌린지 티켓 금액')
on conflict (code) do nothing;

create table core.challenge_orders (
  id                  text primary key,                     -- ORD-YYYYMMDD-XXXXXXXX
  user_id             uuid not null references core.users (id),
  challenge_id        text not null references core.challenges (id),
  product_id          text not null references core.products (id),
  product_name        text not null,                        -- 구매 시점 상품명
  type_code           text,
  quantity            integer not null check (quantity between 1 and 10),
  original_unit_price numeric(18, 2) not null check (original_unit_price >= 0),  -- 구매 시점 원가격 (price_usdt)
  unit_price          numeric(18, 2) not null check (unit_price >= 0),           -- 실제 단가 (할인가 반영)
  original_price      numeric(18, 2) not null check (original_price >= 0),      -- 원가격 × 수량
  discount_amount     numeric(18, 2) not null default 0 check (discount_amount >= 0),
  total_price         numeric(18, 2) not null check (total_price >= 0),          -- 결제 금액 = 단가 × 수량
  coupon_code         text,                                 -- 쿠폰 기능용 자리 (아직 쓰지 않음)
  payment_method      text not null default 'WALLET',
  issued_quantity     integer not null default 0 check (issued_quantity >= 0),
  refunded_quantity   integer not null default 0 check (refunded_quantity >= 0),
  refunded_amount     numeric(18, 2) not null default 0 check (refunded_amount >= 0),
  status              text not null default 'PENDING'
                        check (status in ('PENDING', 'COMPLETED', 'REFUNDED', 'FAILED')),
  wallet_tx_id        bigint references core.wallet_transactions (id),
  journal_entry_id    bigint references core.journal_entries (id),
  completed_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint challenge_orders_settled_check check (issued_quantity + refunded_quantity <= quantity)
);

create index challenge_orders_user_idx on core.challenge_orders (user_id, created_at desc);
create index challenge_orders_status_idx on core.challenge_orders (status, created_at desc);
create index challenge_orders_created_idx on core.challenge_orders (created_at desc);
create index challenge_orders_challenge_idx on core.challenge_orders (challenge_id);
alter table core.challenge_orders enable row level security;

create trigger challenge_orders_set_updated_at
  before update on core.challenge_orders
  for each row execute function core.set_updated_at();

create table core.trading_accounts (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null references core.users (id),
  product_id                  text not null references core.products (id),
  challenge_id                text references core.challenges (id),
  order_id                    text references core.challenge_orders (id),
  tier                        text not null check (tier in ('CHALLENGE', 'FUNDED', 'DEMO', 'LIVE')),
  mt4_server                  text not null check (mt4_server in ('demo', 'live')),  -- demo: 챌린지·데모, live: 펀디드·라이브
  mt4_group                   text not null,
  mt4_login                   bigint,
  leverage                    integer not null,
  capital                     numeric(18, 2) not null,
  type_code                   text,
  unit_price                  numeric(18, 2) not null default 0,  -- 이 계좌 몫의 결제 금액 (환불·매출 분개 기준)
  -- 계좌 상태: PENDING(대회 시작 전, 거래 잠금) → ACTIVE(대회 진행) → CLOSED ... / CANCELLED(발급 실패·환불)
  status                      text not null default 'PENDING'
                                check (status in ('PENDING', 'ACTIVE', 'IN_PROGRESS', 'PASSED', 'FAILED',
                                                  'CLOSED', 'INACTIVE', 'BANNED', 'PENDING_PAYOUT', 'CANCELLED')),
  is_read_only                boolean not null default true,
  -- 발급 진행: QUEUED(발급 중) → DONE(발급 완료) / FAILED(재시도를 다 써서 실패, 환불됨)
  provision_status            text not null default 'QUEUED' check (provision_status in ('QUEUED', 'DONE', 'FAILED')),
  provision_error             text,
  mt4_create_attempted_at     timestamptz,   -- MT4 생성 요청을 보낸 시각 (응답을 못 받았으면 다음 시도 때 GET으로 확인)
  mt4_created_at              timestamptz,
  capital_deposit_attempted_at timestamptz,
  capital_deposited_at        timestamptz,
  capital_order_id            bigint,        -- MT4 입금 거래 번호
  password_encrypted          text,
  investor_password_encrypted text,
  start_at                    timestamptz,
  end_at                      timestamptz,
  refund_wallet_tx_id         bigint references core.wallet_transactions (id),
  issued_at                   timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  constraint trading_accounts_mt4_login_key unique (mt4_server, mt4_login)
);

create index trading_accounts_user_idx on core.trading_accounts (user_id, tier, created_at desc);
create index trading_accounts_order_idx on core.trading_accounts (order_id);
create index trading_accounts_challenge_idx on core.trading_accounts (challenge_id);
create index trading_accounts_provision_idx on core.trading_accounts (provision_status) where provision_status <> 'DONE';
alter table core.trading_accounts enable row level security;

create trigger trading_accounts_set_updated_at
  before update on core.trading_accounts
  for each row execute function core.set_updated_at();

-- MT4 계좌번호 기록. 서버마다 번호 하나는 한 줄만 있을 수 있어서(primary key) 같은 번호를 두 번 나눠 주지 않는다.
-- RESERVED: 계좌에 할당함(MT4 생성 전) / IN_USE: MT4 계좌 생성됨
-- BLACKLISTED: 쓰면 안 되는 번호 (MT4에 이미 있음 등) / ORPHANED: MT4에 만들어졌을 수 있지만 발급이 실패해 정리가 필요한 번호
create table core.mt4_logins (
  mt4_server  text not null check (mt4_server in ('demo', 'live')),
  mt4_login   bigint not null,
  product_id  text references core.products (id),
  account_id  uuid references core.trading_accounts (id),
  status      text not null check (status in ('RESERVED', 'IN_USE', 'BLACKLISTED', 'ORPHANED')),
  reason      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (mt4_server, mt4_login)
);

create index mt4_logins_status_idx on core.mt4_logins (status) where status in ('ORPHANED', 'BLACKLISTED');
alter table core.mt4_logins enable row level security;

create trigger mt4_logins_set_updated_at
  before update on core.mt4_logins
  for each row execute function core.set_updated_at();
