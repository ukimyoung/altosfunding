-- 문의 카테고리를 백오피스 '운영 관리 > 문의하기 > 카테고리 관리'에서 관리한다.
-- code는 문의(contact_messages.category)에 저장되는 값이라 만든 뒤에는 바꾸지 않는다.
-- 기본 언어(en) 이름은 name 컬럼에, 다른 언어는 translations(jsonb)에 둔다. 예: {"ko": {"name": "기술 지원"}}

create table core.contact_categories (
  id           bigint generated always as identity primary key,
  code         text not null unique check (code ~ '^[a-z0-9_]{1,40}$'),
  name         text not null,
  translations jsonb not null default '{}'::jsonb,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index contact_categories_name_lower_key on core.contact_categories (lower(name));

alter table core.contact_categories enable row level security;

create trigger contact_categories_set_updated_at
  before update on core.contact_categories
  for each row execute function core.set_updated_at();

-- 지금까지 화면에 고정돼 있던 7개를 기본 카테고리로 넣는다.
insert into core.contact_categories (code, name, translations, sort_order) values
  ('billing',      'Billing & Payments', '{"ko": {"name": "결제 및 청구"}}', 1),
  ('technical',    'Technical Support',  '{"ko": {"name": "기술 지원"}}', 2),
  ('account',      'Account Management', '{"ko": {"name": "계정 관리"}}', 3),
  ('verification', 'KYC Verification',   '{"ko": {"name": "KYC 인증"}}', 4),
  ('trading',      'Trading Questions',  '{"ko": {"name": "트레이딩 관련 문의"}}', 5),
  ('payout',       'Payout Requests',    '{"ko": {"name": "출금 요청"}}', 6),
  ('general',      'General Inquiry',    '{"ko": {"name": "일반 문의"}}', 7);

-- 문의의 카테고리는 고정 목록(check) 대신 카테고리 테이블을 따른다.
-- 문의가 남아 있는 카테고리는 지울 수 없다.
alter table core.contact_messages drop constraint if exists contact_messages_category_check;
alter table core.contact_messages alter column category drop default;
alter table core.contact_messages
  add constraint contact_messages_category_fkey
  foreign key (category) references core.contact_categories (code) on delete restrict;
create index contact_messages_category_idx on core.contact_messages (category);
