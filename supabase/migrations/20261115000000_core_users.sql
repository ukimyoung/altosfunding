-- 회원과 이메일 인증코드 테이블.
-- Core Backend(FastAPI)만 DB에 직접 접속하므로 RLS는 켜 두되 정책은 두지 않는다.
-- (anon / authenticated 키로 Data API를 통해 접근하는 것을 막기 위한 이중 안전장치)

-- ── 회원 ────────────────────────────────────────────────────
create table core.users (
  id                    uuid primary key default gen_random_uuid(),
  -- 화면·고객지원에서 쓰는 짧은 회원 번호 (예: AF7K2M9QXD)
  uid                   text not null unique,
  -- 항상 소문자로 저장한다.
  email                 text not null,
  -- GOOGLE 가입 회원은 비밀번호가 없다.
  password_hash         text,
  auth_provider         text not null default 'LOCAL'
                          check (auth_provider in ('LOCAL', 'GOOGLE')),
  role                  text not null default 'USER'
                          check (role in ('USER', 'ADMIN')),
  status                text not null default 'ACTIVE'
                          check (status in ('ACTIVE', 'INACTIVE', 'BANNED', 'WITHDRAWN')),
  grade                 text not null default 'NORMAL',

  first_name            text,
  last_name             text,
  country               text,
  city                  text,
  state_province        text,
  address_line1         text,
  address_line2         text,
  zip_code              text,
  phone                 text,
  avatar_url            text,
  admin_note            text,

  email_verified_at     timestamptz,

  kyc_status            text not null default 'NONE'
                          check (kyc_status in ('NONE', 'PENDING', 'APPROVED', 'REJECTED')),
  kyc_reject_reason     text,
  kyc_submitted_at      timestamptz,
  kyc_approved_at       timestamptz,
  kyc_rejected_at       timestamptz,

  is_2fa_enabled        boolean not null default false,
  -- 앱에서 암호화한 TOTP 비밀키
  totp_secret_encrypted text,
  -- 출금 시 이메일 인증코드 사용 여부
  is_email_enabled      boolean not null default true,

  -- 내가 다른 사람을 초대할 때 쓰는 코드
  referral_code         text not null unique,
  -- 나를 초대한 회원
  referrer_id           uuid references core.users (id) on delete set null,

  agreed_to_terms       boolean not null default false,
  subscribed_newsletter boolean not null default false,

  last_login_at         timestamptz,
  withdrawn_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- 탈퇴한 회원의 이메일은 다시 가입할 수 있도록 탈퇴하지 않은 회원끼리만 유일하게 한다.
create unique index users_email_active_key
  on core.users (email)
  where status <> 'WITHDRAWN';

create index users_referrer_id_idx on core.users (referrer_id);

alter table core.users enable row level security;

-- ── 이메일 인증코드 ─────────────────────────────────────────
create table core.email_verifications (
  id          bigint generated always as identity primary key,
  email       text not null,
  purpose     text not null
                check (purpose in ('SIGNUP', 'WITHDRAW_REQUEST', 'PASSWORD_RESET')),
  -- 코드는 평문으로 저장하지 않고 HMAC-SHA256 값만 저장한다.
  code_hash   text not null,
  attempts    integer not null default 0,
  expires_at  timestamptz not null,
  verified_at timestamptz,
  -- 가입 등 실제 작업에 쓰이면 기록해 재사용을 막는다.
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);

create index email_verifications_lookup_idx
  on core.email_verifications (email, purpose, created_at desc);

alter table core.email_verifications enable row level security;

-- ── updated_at 자동 갱신 ────────────────────────────────────
create or replace function core.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at
  before update on core.users
  for each row execute function core.set_updated_at();
