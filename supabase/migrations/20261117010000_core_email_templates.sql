-- 메일 템플릿을 DB에서 관리한다. 백오피스 '운영 관리 > 이메일/알림 관리 > 템플릿 관리'에서 수정·신규 등록한다.
-- id: 템플릿 코드(영문 소문자·숫자·_). 서버 코드가 이 값으로 템플릿을 찾으므로 만든 뒤에는 바꾸지 않는다.
-- is_system: Core 코드가 직접 보내는 기본 템플릿. 삭제할 수 없다.
-- 본문(html_content)은 공통 레이아웃(헤더·푸터) 안에 들어갈 내용만 저장하고, 제목·본문은 Jinja2 문법({{ 변수 }})을 쓴다.

create table core.email_templates (
  id            text primary key check (id ~ '^[a-z][a-z0-9_]{2,63}$'),
  name          text not null check (length(btrim(name)) > 0),
  description   text,
  is_system     boolean not null default false,
  is_active     boolean not null default true,
  send_mode     text not null default 'instant' check (send_mode in ('instant', 'delay')),
  delay_minutes integer not null default 0 check (delay_minutes between 0 and 4320),
  variables     text[] not null default '{}',
  updated_by    uuid references core.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table core.email_template_contents (
  template_id  text not null references core.email_templates (id) on delete cascade,
  locale       text not null check (locale in ('en', 'ko')),
  subject      text not null check (length(btrim(subject)) > 0),
  html_content text not null check (length(btrim(html_content)) > 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (template_id, locale)
);

alter table core.email_templates enable row level security;
alter table core.email_template_contents enable row level security;

create trigger email_templates_set_updated_at
  before update on core.email_templates
  for each row execute function core.set_updated_at();

create trigger email_template_contents_set_updated_at
  before update on core.email_template_contents
  for each row execute function core.set_updated_at();

-- Core가 보내는 기본 템플릿 (app/services/email_templates.py DEFAULT_TEMPLATES와 같은 내용)
insert into core.email_templates (id, name, description, is_system, variables) values
  ('email_verification_requested', $tpl$회원가입 인증코드$tpl$, $tpl$회원가입 화면에서 인증코드 요청 시 즉시 발송$tpl$, true, array['verification_code', 'expiry_minutes']::text[]),
  ('withdraw_verification_code', $tpl$출금 신청 인증코드$tpl$, $tpl$출금 신청 마지막 단계(Security Verification)에서 Send Code 클릭 시 즉시 발송$tpl$, true, array['verification_code', 'expiry_minutes']::text[]),
  ('password_reset', $tpl$비밀번호 재설정$tpl$, $tpl$비밀번호 찾기에서 재설정 링크 요청 시 즉시 발송$tpl$, true, array['reset_url', 'expiry_minutes']::text[]),
  ('contact_received', $tpl$문의 접수 안내$tpl$, $tpl$문의하기(Contact Us) 접수 직후 문의자에게 발송$tpl$, true, array['name', 'inquiry_subject', 'contact_id']::text[]),
  ('contact_replied', $tpl$문의 답변 안내$tpl$, $tpl$백오피스에서 문의 답변 등록 시 문의자에게 발송$tpl$, true, array['name', 'inquiry_subject', 'inquiry', 'reply', 'contact_id']::text[]);

insert into core.email_template_contents (template_id, locale, subject, html_content) values
  ('email_verification_requested', 'en', $tpl$[Altos Funding] Sign-up verification code$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Email Verification</h2>
<p>Please enter the verification code below to complete your sign-up.</p>
<div style="text-align:center;margin:24px 0;"><span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#1a1a2e;">{{ verification_code }}</span></div>
<p>The verification code will expire after {{ expiry_minutes }} minutes. Do not share your code with anyone.</p>
<p>If you did not request this, please ignore this email.</p>$tpl$),
  ('email_verification_requested', 'ko', $tpl$[Altos Funding] 회원가입 인증코드$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">이메일 인증</h2>
<p>회원가입을 완료하려면 아래 인증코드를 입력해 주세요.</p>
<div style="text-align:center;margin:24px 0;"><span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#1a1a2e;">{{ verification_code }}</span></div>
<p>인증코드는 {{ expiry_minutes }}분 동안 유효합니다. 다른 사람에게 코드를 알려 주지 마세요.</p>
<p>직접 요청하지 않으셨다면 이 메일을 무시해 주세요.</p>$tpl$),
  ('withdraw_verification_code', 'en', $tpl$[Altos Funding] Withdrawal verification code$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Email Verification</h2>
<p>A withdrawal request was started on your account. Enter the code below to confirm the withdrawal.</p>
<div style="text-align:center;margin:24px 0;"><span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#1a1a2e;">{{ verification_code }}</span></div>
<p>The verification code will expire after {{ expiry_minutes }} minutes. Do not share your code with anyone.</p>
<p>If you did not request a withdrawal, change your password immediately and contact support.</p>$tpl$),
  ('withdraw_verification_code', 'ko', $tpl$[Altos Funding] 출금 신청 인증코드$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">이메일 인증</h2>
<p>회원님의 계정에서 출금 신청이 진행 중입니다. 출금을 확정하려면 아래 인증코드를 입력해 주세요.</p>
<div style="text-align:center;margin:24px 0;"><span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#1a1a2e;">{{ verification_code }}</span></div>
<p>인증코드는 {{ expiry_minutes }}분 동안 유효합니다. 다른 사람에게 코드를 알려 주지 마세요.</p>
<p>출금을 신청하지 않으셨다면 즉시 비밀번호를 변경하고 고객센터로 문의해 주세요.</p>$tpl$),
  ('password_reset', 'en', $tpl$[Altos Funding] Reset your password$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Password Reset</h2>
<p>Click the button below to set a new password.</p>
<div style="text-align:center;margin:24px 0;"><a href="{{ reset_url }}" style="display:inline-block;background-color:#0057ff;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Reset Password</a></div>
<p style="word-break:break-all;font-size:12px;color:#888888;">{{ reset_url }}</p>
<p>This link expires in {{ expiry_minutes }} minutes. If you did not request this, please ignore this email.</p>$tpl$),
  ('password_reset', 'ko', $tpl$[Altos Funding] 비밀번호 재설정 안내$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">비밀번호 재설정</h2>
<p>아래 버튼을 눌러 새 비밀번호를 설정해 주세요.</p>
<div style="text-align:center;margin:24px 0;"><a href="{{ reset_url }}" style="display:inline-block;background-color:#0057ff;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">비밀번호 재설정</a></div>
<p style="word-break:break-all;font-size:12px;color:#888888;">{{ reset_url }}</p>
<p>링크는 {{ expiry_minutes }}분 동안 유효합니다. 직접 요청하지 않으셨다면 이 메일을 무시해 주세요.</p>$tpl$),
  ('contact_received', 'en', $tpl$[Altos Funding] We received your inquiry (#{{ contact_id }})$tpl$,
   $tpl$<p>Dear {{ name }},</p>
<p>Your inquiry has been received. Our team will review it and reply by email.</p>
<p><strong>Subject:</strong> {{ inquiry_subject }} (#{{ contact_id }})</p>$tpl$),
  ('contact_received', 'ko', $tpl$[Altos Funding] 문의가 접수되었습니다 (#{{ contact_id }})$tpl$,
   $tpl$<p>{{ name }}님, 안녕하세요.</p>
<p>문의가 정상적으로 접수되었습니다. 담당자가 확인 후 이메일로 답변드리겠습니다.</p>
<p><strong>문의 제목:</strong> {{ inquiry_subject }} (#{{ contact_id }})</p>$tpl$),
  ('contact_replied', 'en', $tpl$[Altos Funding] Reply to your inquiry (#{{ contact_id }})$tpl$,
   $tpl$<p>Dear {{ name }},</p>
<p>Here is our reply to your inquiry.</p>
<p><strong>Your inquiry:</strong> {{ inquiry_subject }} (#{{ contact_id }})</p>
<div style="background-color:#f5f4fb;border-radius:8px;padding:16px;margin:8px 0 20px 0;">{{ inquiry|nl2br }}</div>
<p><strong>Our reply</strong></p>
<div style="background-color:#f5f4fb;border-radius:8px;padding:16px;margin:8px 0 20px 0;">{{ reply|nl2br }}</div>$tpl$),
  ('contact_replied', 'ko', $tpl$[Altos Funding] 문의에 대한 답변입니다 (#{{ contact_id }})$tpl$,
   $tpl$<p>{{ name }}님, 안녕하세요.</p>
<p>보내 주신 문의에 답변드립니다.</p>
<p><strong>문의 내용:</strong> {{ inquiry_subject }} (#{{ contact_id }})</p>
<div style="background-color:#f5f4fb;border-radius:8px;padding:16px;margin:8px 0 20px 0;">{{ inquiry|nl2br }}</div>
<p><strong>답변</strong></p>
<div style="background-color:#f5f4fb;border-radius:8px;padding:16px;margin:8px 0 20px 0;">{{ reply|nl2br }}</div>$tpl$);
