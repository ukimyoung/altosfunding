-- 공지사항과 공지 카테고리.
-- 기본 언어(en)의 제목·본문은 컬럼에, 다른 언어(ko 등)는 translations(jsonb)에 둔다.
--   announcements.translations          예: {"ko": {"title": "...", "content": "<p>...</p>"}}
--   announcement_categories.translations 예: {"ko": {"name": "점검"}}

-- ── 카테고리 ────────────────────────────────────────────────
create table core.announcement_categories (
  id           bigint generated always as identity primary key,
  name         text not null unique,
  translations jsonb not null default '{}'::jsonb,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table core.announcement_categories enable row level security;

create trigger announcement_categories_set_updated_at
  before update on core.announcement_categories
  for each row execute function core.set_updated_at();

-- ── 공지 ────────────────────────────────────────────────────
create table core.announcements (
  id                  bigint generated always as identity primary key,
  -- 공지가 남아 있는 카테고리는 지울 수 없다.
  category_id         bigint not null references core.announcement_categories (id) on delete restrict,
  title               text not null,
  content             text not null,
  translations        jsonb not null default '{}'::jsonb,
  status              text not null default 'PUBLISHED'
                        check (status in ('PUBLISHED', 'CLOSED')),
  is_pinned           boolean not null default false,
  -- 노출 순서: 전체 목록(sort_order)과 카테고리별 목록(category_sort_order)을 따로 둔다.
  -- 고정 공지는 순서와 상관없이 맨 위에 나온다.
  sort_order          integer not null default 0,
  category_sort_order integer not null default 0,
  created_by          uuid references core.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index announcements_category_id_idx on core.announcements (category_id);
create index announcements_public_order_idx
  on core.announcements (status, is_pinned desc, sort_order, created_at desc);

alter table core.announcements enable row level security;

create trigger announcements_set_updated_at
  before update on core.announcements
  for each row execute function core.set_updated_at();
