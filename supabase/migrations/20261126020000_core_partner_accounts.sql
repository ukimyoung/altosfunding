-- 제휴사 회원(Member ID) 로그인을 위한 계정 연결과 이메일 규칙 변경.
--
-- 1) users.partner_member_id: 값이 있으면 제휴 계정(member_id 하나당 Altos 계정 최대 1개), null이면 일반 계정.
--    제휴 회원이 탈퇴하면 연결을 풀고 withdrawn_partner_member_id에 남겨 같은 Member ID로 다시 활성화할 수 있게 한다.
-- 2) 이메일 고유 규칙: 제휴 회원끼리는 같은 이메일을 쓸 수 있으므로 일반 계정끼리만 유일하게 한다.
--    일반 회원가입·Google 가입·관리자 회원 추가가 제휴 계정 이메일도 거부하는 것은 코드에서 검사한다.
-- 3) email_verifications.subject_key: 같은 이메일을 쓰는 여러 계정의 인증코드가 섞이지 않도록 누구의 코드인지 적는다.
--    partner:<member_id> (제휴 계정 활성화), user:<user_id> (이메일 변경·출금 신청). 기존 회원가입 코드는 null.

alter table core.users
  add column partner_member_id text unique references core.partner_members (member_id),
  add column withdrawn_partner_member_id text;

alter table core.users drop constraint users_auth_provider_check;
alter table core.users
  add constraint users_auth_provider_check check (auth_provider in ('LOCAL', 'GOOGLE', 'PARTNER'));

drop index core.users_email_active_key;
create unique index users_email_standard_key
  on core.users (email)
  where status <> 'WITHDRAWN' and partner_member_id is null;
create index users_email_idx on core.users (email);

alter table core.email_verifications add column subject_key text;
alter table core.email_verifications drop constraint email_verifications_purpose_check;
alter table core.email_verifications
  add constraint email_verifications_purpose_check
  check (purpose in ('SIGNUP', 'WITHDRAW_REQUEST', 'PASSWORD_RESET', 'PARTNER_ACTIVATION', 'EMAIL_CHANGE'));
create index email_verifications_subject_idx
  on core.email_verifications (subject_key, purpose, created_at desc)
  where subject_key is not null;

-- 메일 템플릿 2종 (app/services/email_templates.py DEFAULT_TEMPLATES와 같은 내용)
insert into core.email_templates (id, name, description, is_system, variables) values
  ('partner_activation_code', $tpl$제휴 회원 계정 활성화 인증코드$tpl$, $tpl$제휴사 회원이 처음 로그인해 계정 활성화 코드를 요청할 때 즉시 발송$tpl$, true, array['verification_code', 'expiry_minutes', 'member_id']::text[]),
  ('email_change_code', $tpl$이메일 변경 인증코드$tpl$, $tpl$Edit Profile에서 새 이메일로 변경할 때 새 이메일로 즉시 발송$tpl$, true, array['verification_code', 'expiry_minutes']::text[])
on conflict (id) do nothing;

insert into core.email_template_contents (template_id, locale, subject, html_content) values
  ('partner_activation_code', 'en', $tpl$[Altos Funding] Account activation code$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Activate Your Account</h2>
<p>Enter the code below to activate your Altos Funding account for Member ID <strong>{{ member_id }}</strong>.</p>
<div style="text-align:center;margin:24px 0;"><span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#1a1a2e;">{{ verification_code }}</span></div>
<p>The verification code will expire after {{ expiry_minutes }} minutes. Do not share your code with anyone.</p>
<p>If you did not request this, please ignore this email.</p>$tpl$),
  ('partner_activation_code', 'ko', $tpl$[Altos Funding] 계정 활성화 인증코드$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">계정 활성화</h2>
<p>Member ID <strong>{{ member_id }}</strong>의 Altos Funding 계정을 활성화하려면 아래 인증코드를 입력해 주세요.</p>
<div style="text-align:center;margin:24px 0;"><span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#1a1a2e;">{{ verification_code }}</span></div>
<p>인증코드는 {{ expiry_minutes }}분 동안 유효합니다. 다른 사람에게 코드를 알려 주지 마세요.</p>
<p>직접 요청하지 않으셨다면 이 메일을 무시해 주세요.</p>$tpl$),
  ('email_change_code', 'en', $tpl$[Altos Funding] Email change verification code$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Email Verification</h2>
<p>Enter the code below to use this address as your Altos Funding account email.</p>
<div style="text-align:center;margin:24px 0;"><span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#1a1a2e;">{{ verification_code }}</span></div>
<p>The verification code will expire after {{ expiry_minutes }} minutes. Do not share your code with anyone.</p>
<p>If you did not request this, please ignore this email.</p>$tpl$),
  ('email_change_code', 'ko', $tpl$[Altos Funding] 이메일 변경 인증코드$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">이메일 인증</h2>
<p>이 주소를 Altos Funding 계정 이메일로 사용하려면 아래 인증코드를 입력해 주세요.</p>
<div style="text-align:center;margin:24px 0;"><span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#1a1a2e;">{{ verification_code }}</span></div>
<p>인증코드는 {{ expiry_minutes }}분 동안 유효합니다. 다른 사람에게 코드를 알려 주지 마세요.</p>
<p>직접 요청하지 않으셨다면 이 메일을 무시해 주세요.</p>$tpl$)
on conflict (template_id, locale) do nothing;
