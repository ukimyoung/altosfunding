-- 2FA 백업 코드, 2FA 입력 실패 제한, 비밀번호 재설정 토큰.

alter table core.users
  -- 같은 TOTP 코드를 두 번 쓰지 못하게 마지막으로 쓴 30초 구간 번호를 기록한다.
  add column totp_last_used_step bigint,
  -- 2FA 코드를 연속으로 틀린 횟수와 잠금 해제 시각
  add column two_factor_failed_count integer not null default 0,
  add column two_factor_locked_until timestamptz;

-- 2FA 백업 코드 (1회용, 해시만 저장)
create table core.user_backup_codes (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references core.users (id) on delete cascade,
  code_hash  text not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

create index user_backup_codes_user_id_idx on core.user_backup_codes (user_id);

alter table core.user_backup_codes enable row level security;

-- 비밀번호 재설정 링크 토큰 (해시만 저장)
create table core.password_reset_tokens (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references core.users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

create index password_reset_tokens_user_id_idx
  on core.password_reset_tokens (user_id, created_at desc);

alter table core.password_reset_tokens enable row level security;
