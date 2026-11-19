-- 트레이딩 계좌 상태 변경 이력 (백오피스 계좌관리: 비활성·활성 복귀·영구정지)
-- 관리자가 바꾼 상태와 사유를 남긴다. 계좌의 '사유'는 가장 최근 이력의 reason을 보여 준다.

create table core.trading_account_status_history (
  id           bigserial primary key,
  account_id   uuid not null references core.trading_accounts (id) on delete cascade,
  action       text not null check (action in ('FREEZE', 'UNFREEZE', 'BAN')),
  from_status  text not null,
  to_status    text not null,
  reason       text,
  changed_by   uuid references core.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index trading_account_status_history_account_idx
  on core.trading_account_status_history (account_id, created_at desc);
alter table core.trading_account_status_history enable row level security;
