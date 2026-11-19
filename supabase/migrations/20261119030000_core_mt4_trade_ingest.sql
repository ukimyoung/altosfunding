-- MT4 거래 내역·잔고(equity) 수집 (Worker가 주기적으로 브로커 API에서 가져온다)
--
-- core.trading_account_trades       계좌별 MT4 주문(거래·잔고 입출금). (account_id, mt4_order) 기준 덮어쓰기로 중복 없음.
--                                   미결 포지션도 is_open = true로 들어오고, 청산되면 같은 행이 청산 값으로 바뀐다.
-- core.trading_account_sync         계좌별 수집 커서(마지막 청산 시각)·마지막 성공/실패·연속 실패 수.
-- core.trading_account_equity_snapshots  잔고·평가금액 이력 (일정 간격으로만 쌓는다).
-- core.trading_accounts.balance 등  가장 최근 잔고·평가금액 (화면은 이 값을 쓴다).

alter table core.trading_accounts
  add column balance            numeric(18, 2),
  add column equity             numeric(18, 2),
  add column credit             numeric(18, 2),
  add column margin             numeric(18, 2),
  add column free_margin        numeric(18, 2),
  add column margin_level       numeric(18, 2),
  add column equity_updated_at  timestamptz;

create table core.trading_account_trades (
  account_id      uuid not null references core.trading_accounts (id) on delete cascade,
  mt4_order       bigint not null,
  mt4_login       bigint not null,
  -- MT4 원래 종류(Buy, Sell, BuyLimit, Balance, Credit ...)와 화면용 구분(BUY | SELL | BALANCE | CREDIT | OTHER)
  type            text not null,
  action          text not null,
  is_open         boolean not null default false,
  symbol          text,
  volume          numeric(18, 4) not null default 0,
  open_time       timestamptz,
  open_price      numeric(20, 6),
  close_time      timestamptz,
  close_price     numeric(20, 6),
  stop_loss       numeric(20, 6),
  take_profit     numeric(20, 6),
  profit          numeric(18, 2) not null default 0,
  commission      numeric(18, 2) not null default 0,
  swap            numeric(18, 2) not null default 0,
  taxes           numeric(18, 2) not null default 0,
  contract_size   numeric(18, 4),
  base_currency   text,
  quote_currency  text,
  comment         text,
  reason          text,
  raw             jsonb,
  first_seen_at   timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (account_id, mt4_order)
);

-- 거래내역 화면: 계좌별 청산 시각 최신순
create index trading_account_trades_close_idx
  on core.trading_account_trades (account_id, close_time desc) where not is_open;
alter table core.trading_account_trades enable row level security;

create table core.trading_account_sync (
  account_id            uuid primary key references core.trading_accounts (id) on delete cascade,
  -- 지금까지 받은 청산 주문 중 가장 늦은 청산 시각 (다음 조회는 이 시각에서 겹침 구간을 뺀 때부터)
  last_close_time       timestamptz,
  last_synced_at        timestamptz,
  last_trades_count     integer not null default 0,
  last_error            text,
  last_error_at         timestamptz,
  consecutive_failures  integer not null default 0,
  last_snapshot_at      timestamptz,
  -- 계좌가 거래 가능 상태(ACTIVE)를 벗어난 것을 처음 본 시각. 이후 일정 시간 더 수집해 마지막 청산 내역을 받는다.
  inactive_since        timestamptz,
  -- 거래 가능 상태를 벗어난 뒤 마지막 수집까지 끝낸 시각 (다시 ACTIVE가 되면 비운다)
  final_synced_at       timestamptz,
  updated_at            timestamptz not null default now()
);
alter table core.trading_account_sync enable row level security;

create table core.trading_account_equity_snapshots (
  id            bigserial primary key,
  account_id    uuid not null references core.trading_accounts (id) on delete cascade,
  taken_at      timestamptz not null default now(),
  balance       numeric(18, 2) not null,
  equity        numeric(18, 2) not null,
  credit        numeric(18, 2),
  margin        numeric(18, 2),
  free_margin   numeric(18, 2),
  margin_level  numeric(18, 2)
);

create index trading_account_equity_snapshots_account_idx
  on core.trading_account_equity_snapshots (account_id, taken_at desc);
alter table core.trading_account_equity_snapshots enable row level security;
