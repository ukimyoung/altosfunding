-- IB 차등 커미션 계산·적립·환수 (IB 차등 커미션 3단계)
--
-- 흐름
--   1) 챌린지 결제(지갑 차감) 트랜잭션 안에서 바로 계산·적립한다 (승인 단계 없음).
--      - 기준 금액 = 실제 결제 금액(challenge_orders.total_price). 0원 주문은 계산하지 않는다.
--      - 예산 = 기준 금액 × 결제 시각의 마케팅 비율.
--      - 구매자의 placement 상위를 끝까지 올라가며(최대 깊이 없음)
--          일반 회원(IB 아님)          → 건너뜀 (SKIPPED_NOT_IB)
--          비활성·영구정지 IB, 정지·탈퇴 회원 → 건너뜀, 최고 비율도 올리지 않음 (SKIPPED_INACTIVE)
--          활성 IB  → 지급률 = 자기 레벨 비율 − 아래쪽 활성 IB 중 최고 비율, 0 이하면 $0 (ZERO)
--      - 예산 − 지급 합계 = 회사 귀속(retained_amount).
--      - 경로·레벨·상태·비율은 결제 시점 값을 ib_commission_lines에 그대로 남긴다(스냅샷).
--   2) 계좌 발급 실패 등으로 결제 금액이 환불되면 환불 비율만큼 각 IB에게서 역거래로 환수한다.
--      IB 지갑 잔액이 모자라면 마이너스가 되고, 마이너스인 동안 출금 신청을 막는다.
--
-- 분개
--   적립: 차) EXPENSE:IB_COMMISSION / 대) LIABILITY:USER_WALLET (IB별)
--   환수: 차) LIABILITY:USER_WALLET (IB별) / 대) EXPENSE:IB_COMMISSION

insert into core.ledger_accounts (code, name, account_type, description) values
  ('EXPENSE:IB_COMMISSION', 'IB 커미션 비용', 'EXPENSE', '챌린지 결제 시 IB에게 적립한 차등 커미션 (환수분 차감)')
on conflict (code) do nothing;

-- 환수로 IB 지갑이 마이너스가 될 수 있다 (출금은 서비스에서 막음).
alter table core.wallets drop constraint if exists wallets_balance_usdt_check;

create table core.ib_commission_batches (
  id                    bigint generated always as identity primary key,
  order_id              text not null unique references core.challenge_orders (id),
  buyer_id              uuid not null references core.users (id),
  base_amount           numeric(18, 2) not null check (base_amount >= 0),
  marketing_version_id  bigint not null references core.marketing_policy_versions (id),
  marketing_rate        numeric(7, 4) not null,
  rate_set_id           bigint not null references core.ib_level_rate_sets (id),
  budget                numeric(18, 2) not null check (budget >= 0),
  paid_amount           numeric(18, 2) not null check (paid_amount >= 0),
  retained_amount       numeric(18, 2) not null check (retained_amount >= 0),
  journal_entry_id      bigint references core.journal_entries (id),
  refunded_base         numeric(18, 2) not null default 0 check (refunded_base >= 0),
  clawed_back_amount    numeric(18, 2) not null default 0 check (clawed_back_amount >= 0),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint ib_commission_batches_sum_check check (paid_amount + retained_amount = budget),
  constraint ib_commission_batches_refund_check check (refunded_base <= base_amount)
);

create index ib_commission_batches_created_idx on core.ib_commission_batches (created_at desc);
create index ib_commission_batches_buyer_idx on core.ib_commission_batches (buyer_id, created_at desc);
alter table core.ib_commission_batches enable row level security;

create trigger ib_commission_batches_set_updated_at
  before update on core.ib_commission_batches
  for each row execute function core.set_updated_at();

-- 결제 시점 경로 스냅샷 + IB별 지급 결과 (depth 1 = 구매자의 바로 위)
create table core.ib_commission_lines (
  id                  bigint generated always as identity primary key,
  batch_id            bigint not null references core.ib_commission_batches (id),
  depth               integer not null check (depth >= 1),
  member_id           uuid not null references core.users (id),
  is_ib               boolean not null,
  level               integer,
  ib_status           text,
  member_status       text not null,
  level_rate          numeric(7, 4),          -- 자기 레벨 비율 (IB일 때)
  prev_max_rate       numeric(7, 4) not null, -- 아래쪽 활성 IB 중 최고 비율
  applied_rate        numeric(7, 4) not null default 0,
  amount              numeric(18, 2) not null default 0 check (amount >= 0),
  result              text not null check (result in ('PAID', 'ZERO', 'SKIPPED_NOT_IB', 'SKIPPED_INACTIVE')),
  clawed_back_amount  numeric(18, 2) not null default 0 check (clawed_back_amount >= 0),
  wallet_tx_id        bigint references core.wallet_transactions (id),
  created_at          timestamptz not null default now(),
  unique (batch_id, depth),
  constraint ib_commission_lines_clawback_check check (clawed_back_amount <= amount)
);

create index ib_commission_lines_member_idx on core.ib_commission_lines (member_id, created_at desc) where amount > 0;
alter table core.ib_commission_lines enable row level security;

-- 환불에 따른 환수 기록 (환불 1건 × IB 1명 = 1행)
create table core.ib_commission_clawbacks (
  id                bigint generated always as identity primary key,
  batch_id          bigint not null references core.ib_commission_batches (id),
  line_id           bigint not null references core.ib_commission_lines (id),
  refund_ref        text not null,            -- 예: trading_account:<id>
  refund_base       numeric(18, 2) not null check (refund_base > 0),
  amount            numeric(18, 2) not null check (amount > 0),
  wallet_tx_id      bigint references core.wallet_transactions (id),
  journal_entry_id  bigint references core.journal_entries (id),
  created_at        timestamptz not null default now(),
  unique (line_id, refund_ref)
);

create index ib_commission_clawbacks_batch_idx on core.ib_commission_clawbacks (batch_id);
alter table core.ib_commission_clawbacks enable row level security;
