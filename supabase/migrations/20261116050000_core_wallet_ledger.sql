-- 지갑·복식부기 원장·입출금 요청 (웹 'My Page > My Asset' Deposit/Withdraw, 백오피스 '입출금 승인 관리'·'입출금 내역').
--
-- 돈의 흐름 (기존 서버와 같음)
--   입금: 회원이 회사 주소로 USDT 송금 → TX hash 입력(deposit_requests PENDING) → 관리자 승인 시 지갑 잔고 증가
--   출금: 회원이 출금 신청 → 지갑에서 바로 차감해 묶어 둠(withdrawal_requests REQUESTED)
--         → 관리자가 송금 후 TX hash 입력해 승인(APPROVED) / 반려 시 묶은 금액을 지갑에 되돌림(REJECTED)
--
-- 잔고 규칙
--   - wallets.balance_usdt는 앱(Core)만 바꾸고, 바꿀 때마다 wallet_transactions 1건 + journal_entries 1건을 같이 만든다.
--   - wallet_transactions, journal_entries, journal_lines는 만든 뒤 고치거나 지우지 않는다 (트리거로 막음).
--     취소가 필요하면 반대 방향 거래를 새로 만든다.
--
-- 원장 계정 (회사 관점)
--   ASSET:CASH                    회사가 가진 USDT (입금 받으면 증가, 출금 송금하면 감소)
--   LIABILITY:USER_WALLET         회원 지갑 잔고 합계 = 회사가 회원에게 줘야 할 돈
--   LIABILITY:WITHDRAWAL_PENDING  출금 신청 후 송금 전까지 묶어 둔 돈
--   REVENUE:WITHDRAWAL_FEE        출금 수수료 수입
--   분개
--     입금 승인 : 차) ASSET:CASH / 대) LIABILITY:USER_WALLET
--     출금 신청 : 차) LIABILITY:USER_WALLET / 대) LIABILITY:WITHDRAWAL_PENDING
--     출금 승인 : 차) LIABILITY:WITHDRAWAL_PENDING / 대) ASSET:CASH (금액-수수료), REVENUE:WITHDRAWAL_FEE (수수료)
--     출금 반려 : 차) LIABILITY:WITHDRAWAL_PENDING / 대) LIABILITY:USER_WALLET
--
-- 금액은 USDT, 소수 둘째 자리까지 (numeric(18,2)).

-- ── 원장 계정과목 ───────────────────────────────────────────
create table core.ledger_accounts (
  code         text primary key,
  name         text not null,
  account_type text not null check (account_type in ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
  description  text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

alter table core.ledger_accounts enable row level security;

insert into core.ledger_accounts (code, name, account_type, description) values
  ('ASSET:CASH', '현금(USDT)', 'ASSET', '회사가 보유한 USDT'),
  ('LIABILITY:USER_WALLET', '회원 지갑 잔고', 'LIABILITY', '회원 지갑(Total Asset) 잔고 합계'),
  ('LIABILITY:WITHDRAWAL_PENDING', '출금 대기', 'LIABILITY', '출금 신청 후 송금 전까지 묶어 둔 금액'),
  ('REVENUE:WITHDRAWAL_FEE', '출금 수수료 수입', 'REVENUE', '출금 시 받은 네트워크 수수료')
on conflict (code) do nothing;

-- ── 분개 ────────────────────────────────────────────────────
create table core.journal_entries (
  id                bigint generated always as identity primary key,
  -- DEPOSIT_APPROVED | WITHDRAWAL_REQUESTED | WITHDRAWAL_APPROVED | WITHDRAWAL_REJECTED ...
  entry_type        text not null,
  reference_type    text,
  reference_id      text,
  description       text not null,
  is_reversal       boolean not null default false,
  reversed_entry_id bigint references core.journal_entries (id),
  -- 처리한 관리자 (회원 요청·시스템이면 null)
  created_by        uuid references core.users (id) on delete set null,
  created_at        timestamptz not null default now()
);

create index journal_entries_reference_idx on core.journal_entries (reference_type, reference_id);
alter table core.journal_entries enable row level security;

create table core.journal_lines (
  id           bigint generated always as identity primary key,
  journal_id   bigint not null references core.journal_entries (id),
  account_code text not null references core.ledger_accounts (code),
  -- 회원 지갑 계정이면 어느 회원 몫인지 (회원별 원장 대사용)
  user_id      uuid references core.users (id),
  debit        numeric(18, 2) not null default 0,
  credit       numeric(18, 2) not null default 0,
  created_at   timestamptz not null default now(),
  constraint journal_lines_one_side check (
    (debit > 0 and credit = 0) or (debit = 0 and credit > 0)
  )
);

create index journal_lines_journal_idx on core.journal_lines (journal_id);
create index journal_lines_account_idx on core.journal_lines (account_code);
create index journal_lines_user_idx on core.journal_lines (user_id) where user_id is not null;
alter table core.journal_lines enable row level security;

-- ── 지갑 ────────────────────────────────────────────────────
-- 회원당 INTEGRATED(통합 지갑 = 화면의 Total Asset) 1개. PERSONAL은 Live 계좌 이체용(기존 서버)으로 지금은 쓰지 않는다.
create table core.wallets (
  id                 bigint generated always as identity primary key,
  user_id            uuid not null references core.users (id),
  wallet_type        text not null default 'INTEGRATED' check (wallet_type in ('INTEGRATED', 'PERSONAL')),
  balance_usdt       numeric(18, 2) not null default 0 check (balance_usdt >= 0),
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, wallet_type)
);

alter table core.wallets enable row level security;

create trigger wallets_set_updated_at
  before update on core.wallets
  for each row execute function core.set_updated_at();

-- 지갑 잔고 변동 이력 (변동 1건 = 1행)
create table core.wallet_transactions (
  id                    bigint generated always as identity primary key,
  wallet_id             bigint not null references core.wallets (id),
  -- DEPOSIT | WITHDRAW | WITHDRAW_REFUND (이후 PURCHASE, REWARD 등 추가)
  tx_type               text not null,
  direction             text not null check (direction in ('IN', 'OUT')),
  amount                numeric(18, 2) not null check (amount > 0),
  balance_before        numeric(18, 2) not null,
  balance_after         numeric(18, 2) not null,
  counterpart_wallet_id bigint references core.wallets (id),
  tx_hash               text,
  reference_type        text,
  reference_id          text,
  journal_entry_id      bigint references core.journal_entries (id),
  description           text not null,
  created_at            timestamptz not null default now()
);

create index wallet_transactions_wallet_idx on core.wallet_transactions (wallet_id, created_at desc);
create index wallet_transactions_reference_idx on core.wallet_transactions (reference_type, reference_id);
alter table core.wallet_transactions enable row level security;

-- 원장·지갑 이력은 고치거나 지우지 않는다.
create or replace function core.forbid_update_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception '% 는 수정·삭제할 수 없습니다. 반대 거래를 새로 만드세요.', tg_table_name;
end;
$$;

create trigger journal_entries_immutable
  before update or delete on core.journal_entries
  for each row execute function core.forbid_update_delete();

create trigger journal_lines_immutable
  before update or delete on core.journal_lines
  for each row execute function core.forbid_update_delete();

create trigger wallet_transactions_immutable
  before update or delete on core.wallet_transactions
  for each row execute function core.forbid_update_delete();

-- ── 입금·출금 요청 ──────────────────────────────────────────
-- 입금과 출금 요청이 한 목록(웹 거래 내역, 백오피스 승인 목록)에 같이 나오므로 번호가 겹치지 않게 시퀀스를 같이 쓴다.
create sequence core.wallet_request_id_seq;

create table core.deposit_requests (
  id             bigint primary key default nextval('core.wallet_request_id_seq'),
  user_id        uuid not null references core.users (id),
  amount         numeric(18, 2) not null check (amount > 0),
  tx_hash        text not null,
  network        text,
  status         text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  reject_reason  text,
  processed_by   uuid references core.users (id) on delete set null,
  processed_at   timestamptz,
  -- 승인 시 만든 지갑 거래
  wallet_tx_id   bigint references core.wallet_transactions (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- 같은 TX hash로 두 번 입금받지 않게 한다. 반려된 요청의 hash는 다시 쓸 수 있다.
create unique index deposit_requests_tx_hash_key
  on core.deposit_requests (lower(tx_hash)) where status <> 'REJECTED';
create index deposit_requests_user_idx on core.deposit_requests (user_id, created_at desc);
create index deposit_requests_status_idx on core.deposit_requests (status, created_at);
alter table core.deposit_requests enable row level security;

create trigger deposit_requests_set_updated_at
  before update on core.deposit_requests
  for each row execute function core.set_updated_at();

create table core.withdrawal_requests (
  id              bigint primary key default nextval('core.wallet_request_id_seq'),
  user_id         uuid not null references core.users (id),
  -- 지갑에서 빠지는 금액. 회원이 받는 금액은 amount - fee
  amount          numeric(18, 2) not null check (amount > 0),
  fee             numeric(18, 2) not null default 0 check (fee >= 0),
  network         text not null,
  wallet_address  text not null,
  status          text not null default 'REQUESTED' check (status in ('REQUESTED', 'APPROVED', 'REJECTED')),
  -- 관리자가 송금한 TX hash
  tx_hash         text,
  rejected_reason text,
  processed_by    uuid references core.users (id) on delete set null,
  processed_at    timestamptz,
  -- 신청 시 지갑에서 차감한 거래 / 반려 시 되돌린 거래
  hold_wallet_tx_id   bigint references core.wallet_transactions (id),
  refund_wallet_tx_id bigint references core.wallet_transactions (id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint withdrawal_requests_fee_lt_amount check (fee < amount)
);

create index withdrawal_requests_user_idx on core.withdrawal_requests (user_id, created_at desc);
create index withdrawal_requests_status_idx on core.withdrawal_requests (status, created_at);
alter table core.withdrawal_requests enable row level security;

create trigger withdrawal_requests_set_updated_at
  before update on core.withdrawal_requests
  for each row execute function core.set_updated_at();

-- ── 설정 변경 이력 (수익 분배 비율 변경 이력 화면) ───────────
create table core.platform_config_history (
  id         bigint generated always as identity primary key,
  scope      text not null,
  key        text not null,
  old_value  jsonb,
  new_value  jsonb not null,
  changed_by uuid references core.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index platform_config_history_key_idx on core.platform_config_history (scope, key, created_at desc);
alter table core.platform_config_history enable row level security;

-- ── 운영 설정 기본값 ────────────────────────────────────────
-- PAYOUT.network_fees: 입출금 네트워크 목록과 출금 수수료(USDT). 백오피스 '수익 분배 설정'에서 바꾼다.
--   name은 웹의 입금 주소·QR 설정 키(TRC20, ETH, BSC, POL, SOL, APT)와 맞춘다.
-- WALLET.min_deposit_amount / min_withdrawal_amount: 최소 입금·출금 금액 (웹 화면 검사와 같은 10 USDT)
insert into core.platform_config (scope, key, value, description) values
  ('PAYOUT', 'network_fees', '[
     {"name": "TRC20", "desc": "Tron (TRC20)", "fee": 1, "is_active": true},
     {"name": "ETH", "desc": "Ethereum (ERC20)", "fee": 5, "is_active": true},
     {"name": "BSC", "desc": "BNB Smart Chain (BEP20)", "fee": 1, "is_active": true},
     {"name": "POL", "desc": "Polygon (POL)", "fee": 1, "is_active": true},
     {"name": "SOL", "desc": "Solana (SOL)", "fee": 1, "is_active": true},
     {"name": "APT", "desc": "Aptos (APT)", "fee": 1, "is_active": true}
   ]', '네트워크별 출금 수수료'),
  ('PAYOUT', 'profit_split_pct', '80', '트레이더 수익 배분율 (%) — 나머지는 플랫폼 몫'),
  ('WALLET', 'min_deposit_amount', '10', '최소 입금 금액 (USDT)'),
  ('WALLET', 'min_withdrawal_amount', '10', '최소 출금 금액 (USDT)')
on conflict (scope, key) do nothing;
