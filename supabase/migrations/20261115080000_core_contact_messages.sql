-- 고객 문의(Contact Us). 로그인 사용자와 비로그인 방문자(랜딩 푸터) 모두 남길 수 있다.
-- 상태: RECEIVED(접수) → PROCESSING(답변 임시저장) → ANSWERED(답변 전송)

create table core.contact_messages (
  id           bigint generated always as identity primary key,
  -- 로그인한 상태로 남긴 문의만 연결한다. 회원이 지워져도 문의는 남긴다.
  user_id      uuid references core.users (id) on delete set null,
  name         text not null,
  email        text not null,
  category     text not null default 'general'
                 check (category in ('billing', 'technical', 'account', 'verification', 'trading', 'payout', 'general')),
  subject      text not null,
  message      text not null,
  -- 답변 메일 언어 (문의할 때의 Accept-Language)
  locale       text not null default 'en',
  status       text not null default 'RECEIVED'
                 check (status in ('RECEIVED', 'PROCESSING', 'ANSWERED')),
  reply_draft  text,
  reply_body   text,
  replied_at   timestamptz,
  replied_by   uuid references core.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index contact_messages_created_at_idx on core.contact_messages (created_at desc);
create index contact_messages_status_idx on core.contact_messages (status);
create index contact_messages_user_id_idx on core.contact_messages (user_id);

alter table core.contact_messages enable row level security;

create trigger contact_messages_set_updated_at
  before update on core.contact_messages
  for each row execute function core.set_updated_at();
