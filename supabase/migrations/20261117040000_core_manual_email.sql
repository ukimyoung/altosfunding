-- 수동 메일 발송 (백오피스 '운영 관리 > 이메일/알림 관리 > 수동 발송 관리').
-- 관리자가 쓴 제목·본문을 조건 검색 결과(전체 유저) 또는 직접 입력·CSV 이메일로 보낸다.
-- 보낸 메일은 core.email_logs에 template_id='manual_send', batch_id=발송 작업 id로 남는다.

-- 작성 중인 메일 (임시 저장). 발송하면 status='sent'가 되고 발송 작업(job_id)이 연결된다.
create table core.manual_email_drafts (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'draft' check (status in ('draft', 'sent', 'expired')),
  target_mode text not null check (target_mode in ('filter_all', 'manual_input', 'csv_import')),
  filter jsonb,                                      -- filter_all: 가입일·등급 등 검색 조건
  manual_entries text[],                             -- manual_input: 입력한 이메일
  import_id uuid,                                    -- csv_import: 올린 CSV 묶음 id
  import_entries text[],                             -- csv_import: CSV에서 읽은 이메일
  import_filename text,
  is_marketing boolean not null default true,        -- 마케팅(광고성): 수신 동의(subscribed_newsletter) 회원에게만
  is_urgent boolean not null default false,          -- 긴급 공지: 수신 동의와 상관없이 보냄
  content_locales jsonb not null,                    -- {"en": {"subject": "...", "html_content": "..."}, "ko": ...}
  preview_locale text not null default 'en',
  sample_user_name text not null default 'John Doe',
  send_at timestamptz,                               -- 예약 발송 시각 (null이면 즉시)
  job_id uuid,
  expires_at timestamptz not null default now() + interval '30 days',
  created_by uuid references core.users(id) on delete set null,
  updated_by uuid references core.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index manual_email_drafts_status_idx on core.manual_email_drafts (status, updated_at desc);

-- 발송 작업. id가 발송 이력(core.email_logs.batch_id)의 묶음 id다.
create table core.manual_email_jobs (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references core.manual_email_drafts(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'partial_failed', 'failed', 'cancelled')),
  target_mode text not null,
  is_marketing boolean not null,
  is_urgent boolean not null,
  subject text not null,                             -- 대표 제목 (영어)
  send_at timestamptz,
  recipient_total integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  skipped_count integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid references core.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index manual_email_jobs_due_idx on core.manual_email_jobs (status, send_at);

-- 발송 작업의 수신자. 발송을 시작할 때 대상을 확정해 넣고, 한 명씩 결과를 기록한다
-- (서버가 중간에 멈춰도 다음 실행 때 pending만 이어서 보낸다).
create table core.manual_email_recipients (
  id bigint generated always as identity primary key,
  job_id uuid not null references core.manual_email_jobs(id) on delete cascade,
  email text not null,
  user_id uuid references core.users(id) on delete set null,
  locale text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  skip_reason text,                                  -- UNSUBSCRIBED | INVALID_EMAIL | WITHDRAWN | DUPLICATE
  error_message text,
  sent_at timestamptz,
  unique (job_id, email)
);

create index manual_email_recipients_job_idx on core.manual_email_recipients (job_id, status);

-- 관리자가 메일 본문에 넣은 이미지. 메일을 받은 사람이 볼 수 있도록 공개 주소(/api/v1/files/{id})로 내준다.
create table core.uploaded_files (
  id uuid primary key default gen_random_uuid(),
  ref_domain text,                                   -- manual_send 등
  ref_id text,
  original_filename text not null,
  content_type text not null,
  size_bytes integer not null,
  data bytea not null,
  created_by uuid references core.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table core.manual_email_drafts enable row level security;
alter table core.manual_email_jobs enable row level security;
alter table core.manual_email_recipients enable row level security;
alter table core.uploaded_files enable row level security;

-- 마케팅 메일 수신거부 시각. 수동 발송 메일의 '수신거부' 링크로 거부하면 기록된다
-- (백오피스 '수신거부 관리' 탭에서 기간으로 조회).
alter table core.users add column newsletter_unsubscribed_at timestamptz;
