-- FAQ와 FAQ 카테고리 (백오피스 '운영 관리 > FAQ', 웹 Help Center FAQ).
-- 공지사항과 같은 방식: 기본 언어(en)의 질문·답변·카테고리 이름은 컬럼에, 다른 언어(ko 등)는 translations(jsonb)에 둔다.
--   faqs.translations           예: {"ko": {"question": "...", "answer": "..."}}
--   faq_categories.translations 예: {"ko": {"name": "결제"}}

-- ── 카테고리 ────────────────────────────────────────────────
create table core.faq_categories (
  id           bigint generated always as identity primary key,
  name         text not null unique,
  translations jsonb not null default '{}'::jsonb,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table core.faq_categories enable row level security;

create trigger faq_categories_set_updated_at
  before update on core.faq_categories
  for each row execute function core.set_updated_at();

-- ── FAQ ─────────────────────────────────────────────────────
create table core.faqs (
  id           bigint generated always as identity primary key,
  -- FAQ가 남아 있는 카테고리는 지울 수 없다.
  category_id  bigint not null references core.faq_categories (id) on delete restrict,
  question     text not null check (char_length(question) <= 500),
  answer       text not null,
  translations jsonb not null default '{}'::jsonb,
  status       text not null default 'PUBLISHED'
                 check (status in ('PUBLISHED', 'HIDDEN')),
  -- 노출 순서는 전체 FAQ 하나의 순서다 (기존 서버와 같음).
  sort_order   integer not null default 0,
  created_by   uuid references core.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index faqs_category_id_idx on core.faqs (category_id);
create index faqs_public_order_idx on core.faqs (status, sort_order);

alter table core.faqs enable row level security;

create trigger faqs_set_updated_at
  before update on core.faqs
  for each row execute function core.set_updated_at();
