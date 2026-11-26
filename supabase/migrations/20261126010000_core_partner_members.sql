-- 제휴사(10Power·xnsoft) 회원 원본.
--
-- 제휴사 회원 조회 API(GET /api/partner/v1/members)가 주는 항목을 그대로 저장한다.
--   - member_id 는 두 사이트 전체에서 유일하고 바뀌지 않는 회원 구분 기준이다.
--   - 비밀번호는 제공되지 않는다. Altos 계정은 회원이 처음 로그인할 때 따로 만든다(다음 단계).
--   - 이메일은 소유 미확인이며 여러 회원이 같은 이메일을 쓸 수 있어서 고유 제약을 두지 않는다.
--   - 같은 회원이 다시 오면 member_id 기준으로 덮어쓴다(upsert).
-- Altos 계정 연결(users.partner_member_id)과 가져오기 이력 테이블은 API 연동 단계에서 추가한다.

create table core.partner_members (
  member_id              text primary key
                           check (member_id <> '' and position('@' in member_id) = 0),
  site                   text not null check (site in ('10power', 'xnsoft')),
  name                   text not null,
  email                  text,                  -- 소문자·공백 제거해서 저장, 없으면 null
  phone                  text,                  -- 회원이 입력한 형식 그대로
  sponsor_member_id      text,                  -- 제휴사 추천인 member_id (추천인·IB 연동은 추후)
  status                 text not null
                           check (status in ('active', 'unconfirmed', 'suspended', 'deleted')),
  joined_at              timestamptz not null,
  membership_expires_on  date,                  -- 구독 만료일. 당일까지 활성(KST)
  membership_active      boolean not null default false, -- 응답 시각 기준 참고값
  partner_updated_at     timestamptz not null,  -- 제휴사 updated_at
  raw                    jsonb not null default '{}'::jsonb, -- 받은 항목 원문
  first_synced_at        timestamptz not null default now(),
  last_synced_at         timestamptz not null default now(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- Member ID 로그인은 대소문자를 구분하지 않는다.
create unique index partner_members_member_id_lower_key on core.partner_members (lower(member_id));
create index partner_members_email_idx on core.partner_members (email);
create index partner_members_site_status_idx on core.partner_members (site, status);
create index partner_members_sponsor_idx on core.partner_members (sponsor_member_id);

create trigger partner_members_set_updated_at
  before update on core.partner_members
  for each row execute function core.set_updated_at();

alter table core.partner_members enable row level security;
