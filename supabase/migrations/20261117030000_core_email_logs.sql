-- 메일 발송 이력. Core가 보내는 모든 메일(인증코드·알림·문의 답변 등)을 한 통에 한 줄로 남긴다.
-- 백오피스 '운영 관리 > 이메일/알림 관리 > 발송 이력'에서 조회한다.
-- 본문과 템플릿 변수(인증코드·재설정 링크 등)는 저장하지 않는다. 제목·수신자·결과만 남긴다.
create table core.email_logs (
  id bigint generated always as identity primary key,
  batch_id uuid not null default gen_random_uuid(),       -- 한 번에 여러 명에게 보낸 묶음 (수동 발송용). 지금은 메일마다 따로
  template_id text not null,                               -- 템플릿 코드 (템플릿을 지워도 이력은 남도록 FK 없음)
  recipient text not null,
  user_id uuid references core.users(id) on delete set null,
  locale text,
  subject text not null,
  status text not null check (status in ('SENT', 'FAILED')),
  error_message text,
  provider text not null,                                  -- ses | console
  provider_message_id text,                                -- SES MessageId
  created_at timestamptz not null default now()
);

create index email_logs_created_at_idx on core.email_logs (created_at desc);
create index email_logs_template_idx on core.email_logs (template_id, created_at desc);
create index email_logs_batch_idx on core.email_logs (batch_id);
create index email_logs_recipient_idx on core.email_logs (lower(recipient));

alter table core.email_logs enable row level security;
