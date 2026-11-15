-- 로그인 세션(리프레시 토큰)과 로그인 이력.
-- 리프레시 토큰은 DB에 해시로 저장하고, 재발급할 때마다 새 토큰으로 바꾼다(rotation).
-- 이미 바뀐(폐기된) 토큰이 다시 쓰이면 탈취로 보고 그 회원의 세션을 모두 끊는다.

alter table core.users add column last_login_ip text;

create table core.refresh_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references core.users (id) on delete cascade,
  -- 토큰 원문이 아니라 SHA-256 값만 저장한다.
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  revoked_at  timestamptz,
  ip_address  text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index refresh_tokens_user_id_idx on core.refresh_tokens (user_id);

alter table core.refresh_tokens enable row level security;

create table core.login_history (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references core.users (id) on delete cascade,
  ip_address  text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index login_history_user_id_created_at_idx
  on core.login_history (user_id, created_at desc);

alter table core.login_history enable row level security;
