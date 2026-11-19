-- 리워드: 추천인 리워드(reward_records)·트레이딩 보너스(trading_bonus_records)
--
-- 기존 서버(reward_record, trading_bonus_record)와 같은 흐름이다.
-- 추천인 리워드
--   - 피추천인의 첫 챌린지 주문이 완료(계좌 1개 이상 발급)되고 정책 조건이 FIRST_PURCHASE이면
--     추천인 앞으로 PENDING 1건을 만든다 (피추천인 1명당 1건).
--     FUNDED_UPGRADE 조건은 펀디드 승급 기능을 Core로 옮길 때 연결한다.
--   - 관리자 승인 → 추천인 통합 지갑에 입금, 반려 → 사유만 남긴다.
-- 트레이딩 보너스
--   - 회원이 수익 정산(payout)을 신청할 때 회사 몫 × 보너스 비율로 PENDING 1건을 만든다.
--     수익 정산은 아직 Core에 없어서 지금은 쌓이지 않는다. payout_request_id 외래키는 그 테이블을 만들 때 건다.
--   - 관리자 승인 → 통합 지갑에 입금, 반려 → 사유만 남긴다.
--
-- 분개 (승인 시)
--   추천인 리워드:   차) EXPENSE:REFERRAL_REWARD / 대) LIABILITY:USER_WALLET
--   트레이딩 보너스: 차) EXPENSE:TRADING_BONUS   / 대) LIABILITY:USER_WALLET

insert into core.ledger_accounts (code, name, account_type, description) values
  ('EXPENSE:REFERRAL_REWARD', '추천인 리워드 비용', 'EXPENSE', '승인한 추천인 리워드 지급액'),
  ('EXPENSE:TRADING_BONUS', '트레이딩 보너스 비용', 'EXPENSE', '승인한 트레이딩 보너스 지급액')
on conflict (code) do nothing;

create table core.reward_records (
  id                bigint generated always as identity primary key,
  user_id           uuid not null references core.users (id),          -- 받는 사람 (추천인)
  type              text not null default 'REFERRAL_BONUS'
                      check (type in ('REFERRAL_BONUS', 'CHALLENGE_BONUS', 'DEPOSIT_BONUS', 'PROMOTION_BONUS')),
  amount            numeric(18, 2) not null check (amount > 0),
  currency          text not null default 'USDT',
  status            text not null default 'PENDING'
                      check (status in ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED')),
  source_user_id    uuid references core.users (id),                  -- 추천인 리워드면 피추천인
  source_type       text,                                              -- 생긴 계기 (challenge_order 등)
  source_id         text,
  description       text,
  approved_at       timestamptz,
  approved_by       uuid references core.users (id) on delete set null,
  rejected_at       timestamptz,
  rejected_by       uuid references core.users (id) on delete set null,
  rejection_reason  text,
  wallet_tx_id      bigint references core.wallet_transactions (id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- 피추천인 1명당 추천인 리워드는 1건
create unique index reward_records_referral_once
  on core.reward_records (source_user_id) where type = 'REFERRAL_BONUS';
create index reward_records_user_idx on core.reward_records (user_id, created_at desc);
create index reward_records_status_idx on core.reward_records (type, status);

create trigger reward_records_set_updated_at
  before update on core.reward_records
  for each row execute function core.set_updated_at();
alter table core.reward_records enable row level security;

create table core.trading_bonus_records (
  id                 bigint generated always as identity primary key,
  user_id            uuid not null references core.users (id),
  payout_request_id  bigint not null unique,
  mt4_login          bigint,
  trader_profit      numeric(18, 2),                                  -- 분배 전 총 수익
  profit_split_pct   numeric(9, 4),
  company_share      numeric(18, 2) not null check (company_share >= 0),
  bonus_rate         numeric(9, 6) not null check (bonus_rate >= 0),
  bonus_amount       numeric(18, 2) not null check (bonus_amount > 0),
  status             text not null default 'PENDING'
                       check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  approved_at        timestamptz,
  approved_by        uuid references core.users (id) on delete set null,
  rejected_at        timestamptz,
  rejected_by        uuid references core.users (id) on delete set null,
  rejection_reason   text,
  wallet_tx_id       bigint references core.wallet_transactions (id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index trading_bonus_records_user_idx on core.trading_bonus_records (user_id, created_at desc);
create index trading_bonus_records_status_idx on core.trading_bonus_records (status);

create trigger trading_bonus_records_set_updated_at
  before update on core.trading_bonus_records
  for each row execute function core.set_updated_at();
alter table core.trading_bonus_records enable row level security;
