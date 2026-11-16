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
-- 앞 5종은 Core가 이미 보내는 메일, 나머지 33종은 기존 서버에서 옮겨 온 템플릿(기능 이전 시 연결).
insert into core.email_templates (id, name, description, is_system, variables) values
  ('email_verification_requested', $tpl$회원가입 인증코드$tpl$, $tpl$회원가입 화면에서 인증코드 요청 시 즉시 발송$tpl$, true, array['verification_code', 'expiry_minutes']::text[]),
  ('withdraw_verification_code', $tpl$출금 신청 인증코드$tpl$, $tpl$출금 신청 마지막 단계(Security Verification)에서 Send Code 클릭 시 즉시 발송$tpl$, true, array['verification_code', 'expiry_minutes']::text[]),
  ('password_reset', $tpl$비밀번호 재설정$tpl$, $tpl$비밀번호 찾기에서 재설정 링크 요청 시 즉시 발송$tpl$, true, array['reset_url', 'expiry_minutes']::text[]),
  ('contact_received', $tpl$문의 접수 안내$tpl$, $tpl$문의하기(Contact Us) 접수 직후 문의자에게 발송$tpl$, true, array['name', 'inquiry_subject', 'contact_id']::text[]),
  ('contact_replied', $tpl$문의 답변 안내$tpl$, $tpl$백오피스에서 문의 답변 등록 시 문의자에게 발송$tpl$, true, array['name', 'inquiry_subject', 'inquiry', 'reply', 'contact_id']::text[]),
  ('user_registered', $tpl$회원가입 환영$tpl$, $tpl$회원가입 완료 직후$tpl$, true, array['user_name', 'login_url']::text[]),
  ('user_suspended', $tpl$회원 일시 정지$tpl$, $tpl$관리자가 회원을 일시 정지했을 때$tpl$, true, array['user_name', 'reason']::text[]),
  ('user_banned', $tpl$회원 영구 정지$tpl$, $tpl$관리자가 회원을 영구 정지했을 때$tpl$, true, array['user_name', 'reason']::text[]),
  ('user_reactivated', $tpl$회원 정지 해제$tpl$, $tpl$정지된 회원을 다시 활성화했을 때$tpl$, true, array['user_name']::text[]),
  ('user_withdrawn', $tpl$회원 탈퇴 완료$tpl$, $tpl$회원 탈퇴 처리 직후$tpl$, true, array['user_name']::text[]),
  ('kyc_approved', $tpl$KYC 승인$tpl$, $tpl$본인 인증(KYC) 승인 시$tpl$, true, array['user_name']::text[]),
  ('kyc_rejected', $tpl$KYC 거절$tpl$, $tpl$본인 인증(KYC) 거절 시$tpl$, true, array['user_name', 'reason']::text[]),
  ('deposit_confirmed', $tpl$입금 승인$tpl$, $tpl$관리자가 입금 신청을 승인했을 때$tpl$, true, array['amount', 'user_name', 'processed_at', 'tx_id']::text[]),
  ('deposit_rejected', $tpl$입금 거절$tpl$, $tpl$관리자가 입금 신청을 거절했을 때$tpl$, true, array['user_name', 'amount', 'processed_at', 'tx_id', 'reason']::text[]),
  ('withdrawal_requested', $tpl$출금 신청 접수$tpl$, $tpl$회원이 출금을 신청한 직후$tpl$, true, array['recipient_email', 'payout_id', 'amount']::text[]),
  ('withdrawal_confirmed', $tpl$출금 승인$tpl$, $tpl$관리자가 출금 신청을 승인(송금 완료)했을 때$tpl$, true, array['amount', 'user_name', 'fee', 'received_amount', 'tx_id', 'processed_at']::text[]),
  ('withdrawal_rejected', $tpl$출금 거절$tpl$, $tpl$관리자가 출금 신청을 거절했을 때$tpl$, true, array['user_name', 'amount', 'fee', 'received_amount', 'processed_at', 'reason']::text[]),
  ('payout_approved', $tpl$펀디드 수익 출금 승인$tpl$, $tpl$펀디드 계좌 수익 출금(Payout) 승인 시$tpl$, true, array['user_name', 'mt4_login', 'amount', 'processed_at', 'payout_id']::text[]),
  ('payout_rejected', $tpl$펀디드 수익 출금 거절$tpl$, $tpl$펀디드 계좌 수익 출금(Payout) 거절 시$tpl$, true, array['user_name', 'mt4_login', 'amount', 'processed_at', 'payout_id', 'reason']::text[]),
  ('challenge_applied', $tpl$챌린지 구매 완료$tpl$, $tpl$챌린지 티켓 결제 완료 직후$tpl$, true, array['user_name', 'challenge_name', 'quantity', 'amount']::text[]),
  ('challenge_account_issued', $tpl$챌린지 계좌 발급$tpl$, $tpl$챌린지 MT4 계좌가 발급됐을 때$tpl$, true, array['user_name', 'mt4_login', 'mt4_password', 'start_date', 'end_date']::text[]),
  ('challenge_started_notify', $tpl$챌린지 시작 예정 안내$tpl$, $tpl$챌린지 거래 시작 전 계좌 정보 안내$tpl$, true, array['user_name', 'challenge_name', 'mt4_login', 'mt4_password']::text[]),
  ('challenge_started', $tpl$챌린지 거래 시작$tpl$, $tpl$챌린지 거래가 시작됐을 때$tpl$, true, array['user_name', 'challenge_name', 'mt4_login', 'account_type']::text[]),
  ('challenge_closed_notify', $tpl$챌린지 종료$tpl$, $tpl$챌린지 계좌가 종료됐을 때$tpl$, true, array['user_name', 'challenge_name', 'mt4_login', 'challenge_phase', 'start_date', 'end_date', 'final_balance', 'profit_pct']::text[]),
  ('challenge_passed', $tpl$챌린지 합격$tpl$, $tpl$챌린지 결과 합격 시$tpl$, true, array['user_name', 'challenge_name', 'mt4_login', 'start_date', 'end_date']::text[]),
  ('challenge_failed', $tpl$챌린지 불합격$tpl$, $tpl$챌린지 결과 불합격 시$tpl$, true, array['user_name', 'challenge_name', 'mt4_login', 'start_date', 'end_date']::text[]),
  ('account_violated', $tpl$규정 위반 감지$tpl$, $tpl$거래 규칙 위반으로 계좌가 실패 처리됐을 때$tpl$, true, array['user_name', 'account_type', 'mt4_login', 'message', 'rule_key']::text[]),
  ('margin_call_warning', $tpl$마진콜 경고$tpl$, $tpl$계좌 손실이 위험 수준에 가까워졌을 때$tpl$, true, array['user_name', 'mt4_login', 'rule_key', 'message', 'current_equity', 'remaining', 'dashboard_url']::text[]),
  ('account_suspended', $tpl$거래 계좌 일시 정지$tpl$, $tpl$거래 계좌(MT4)를 일시 정지했을 때$tpl$, true, array['user_name', 'mt4_login', 'reason']::text[]),
  ('account_banned', $tpl$거래 계좌 영구 정지$tpl$, $tpl$거래 계좌(MT4)를 영구 정지했을 때$tpl$, true, array['user_name', 'mt4_login', 'reason']::text[]),
  ('funding_account_issued', $tpl$펀디드 계좌 발급$tpl$, $tpl$펀디드 MT4 계좌가 발급됐을 때$tpl$, true, array['user_name', 'mt4_login', 'mt4_password', 'end_date', 'start_date']::text[]),
  ('funding_started_notify', $tpl$펀디드 시작 예정 안내$tpl$, $tpl$펀디드 거래 시작 전 계좌 정보 안내$tpl$, true, array['user_name', 'funding_name', 'mt4_login', 'mt4_password', 'mt4_server']::text[]),
  ('funding_started', $tpl$펀디드 거래 시작$tpl$, $tpl$펀디드 거래가 시작됐을 때$tpl$, true, array['user_name', 'funding_name', 'mt4_login', 'account_type']::text[]),
  ('funding_suspended', $tpl$펀디드 계좌 일시 정지$tpl$, $tpl$펀디드 계좌를 일시 정지했을 때$tpl$, true, array['user_name', 'funding_name', 'mt4_login', 'reason']::text[]),
  ('funding_terminated', $tpl$펀디드 계좌 해지$tpl$, $tpl$펀디드 계좌가 해지됐을 때$tpl$, true, array['user_name', 'funding_name', 'mt4_login', 'reason']::text[]),
  ('funding_closed_notify', $tpl$펀디드 계좌 종료$tpl$, $tpl$펀디드 계좌가 종료됐을 때$tpl$, true, array['user_name', 'mt4_login']::text[]),
  ('mts_operation_failed', $tpl$MT4 작업 실패 (관리자 알림)$tpl$, $tpl$MT4 계좌 생성·변경 작업 실패 시 관리자에게 발송$tpl$, true, array['operation', 'mt4_login', 'context', 'reference_id', 'severity', 'error_message']::text[]),
  ('manual_broadcast', $tpl$수동 발송 (공통)$tpl$, $tpl$백오피스 수동 발송 시 본문을 감싸는 템플릿$tpl$, true, array['subject', 'body_html', 'is_marketing', 'unsubscribe_url']::text[]);

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
<div style="background-color:#f5f4fb;border-radius:8px;padding:16px;margin:8px 0 20px 0;">{{ reply|nl2br }}</div>$tpl$),
  ('user_registered', 'en', $tpl$[Altos Funding] Welcome to Altos Funding$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Welcome to Altos Funding!</h2>
<p>Dear {{ user_name }},</p>
<p>Welcome to Altos Funding—your ultimate prop trading partner. We are thrilled to have you on board!</p>
<p>We are fully committed to backing your talent. May your charts be green and your execution flawless.</p>
<p>Let's secure that funding!</p>
<div style="text-align:center;margin:24px 0;">
<a href="{{ login_url }}" style="background:#1a1a2e;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;">Get Started</a>
</div>$tpl$),
  ('user_registered', 'ko', $tpl$[Altos Funding] 알토스 펀딩 가입을 환영합니다$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">알토스 펀딩에 오신 것을 환영합니다!</h2>
<p>{{ user_name }}님, 안녕하세요.</p>
<p>최고의 프롭 트레이딩 파트너, 알토스 펀딩에 오신 것을 환영합니다. 함께하게 되어 정말 기쁩니다!</p>
<p>회원님의 실력을 전폭적으로 지원하겠습니다. 차트는 늘 초록빛이고 매매는 완벽하기를 바랍니다.</p>
<p>이제 펀딩을 향해 출발해 보세요!</p>
<div style="text-align:center;margin:24px 0;">
<a href="{{ login_url }}" style="background:#1a1a2e;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;">시작하기</a>
</div>$tpl$),
  ('user_suspended', 'en', $tpl$[Altos Funding] Your account has been temporarily suspended$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Account Temporarily Suspended</h2>
<p>Dear {{ user_name }},</p>
<p>Your account has been temporarily suspended for the following reasons.</p>
<p>• Reason : {{ reason }}</p>
<p>Please contact our support team if you believe this is an error or need further information.</p>$tpl$),
  ('user_suspended', 'ko', $tpl$[Altos Funding] 계정이 일시 정지되었습니다$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">계정 일시 정지</h2>
<p>{{ user_name }}님, 안녕하세요.</p>
<p>아래 사유로 회원님의 계정이 일시 정지되었습니다.</p>
<p>• 사유 : {{ reason }}</p>
<p>착오라고 생각되시거나 자세한 내용이 필요하시면 고객센터로 문의해 주세요.</p>$tpl$),
  ('user_banned', 'en', $tpl$[Altos Funding] Your account has been permanently banned$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Account Permanently Banned</h2>
<p>Dear {{ user_name }},</p>
<p>Your account has been permanently banned due to a violation of our terms of service.</p>
<p>• Reason : {{ reason }}</p>
<p>Please contact our support team if you believe this is an error or need further information.</p>$tpl$),
  ('user_banned', 'ko', $tpl$[Altos Funding] 계정이 영구 정지되었습니다$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">계정 영구 정지</h2>
<p>{{ user_name }}님, 안녕하세요.</p>
<p>이용 약관 위반으로 회원님의 계정이 영구 정지되었습니다.</p>
<p>• 사유 : {{ reason }}</p>
<p>착오라고 생각되시거나 자세한 내용이 필요하시면 고객센터로 문의해 주세요.</p>$tpl$),
  ('user_reactivated', 'en', $tpl$[Altos Funding] Your account has been reactivated$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Account Reactivated</h2>
<p>Dear {{ user_name }},</p>
<p>Your account has been reactivated. You can now log in and access all platform features.</p>$tpl$),
  ('user_reactivated', 'ko', $tpl$[Altos Funding] 계정이 다시 활성화되었습니다$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">계정 활성화</h2>
<p>{{ user_name }}님, 안녕하세요.</p>
<p>회원님의 계정이 다시 활성화되었습니다. 이제 로그인해 모든 기능을 이용할 수 있습니다.</p>$tpl$),
  ('user_withdrawn', 'en', $tpl$[Altos Funding] Your account has been closed$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Account Withdrawal Confirmed</h2>
<p>Dear {{ user_name }},</p>
<p>Your account withdrawal request has been processed. Your account has been closed.</p>
<p>We're sorry to see you go. If you change your mind, you're always welcome to rejoin. Thank you for trading with us.</p>$tpl$),
  ('user_withdrawn', 'ko', $tpl$[Altos Funding] 회원 탈퇴가 완료되었습니다$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">회원 탈퇴 완료</h2>
<p>{{ user_name }}님, 안녕하세요.</p>
<p>회원 탈퇴 신청이 처리되어 계정이 종료되었습니다.</p>
<p>떠나신다니 아쉽습니다. 마음이 바뀌시면 언제든 다시 가입하실 수 있습니다. 그동안 함께해 주셔서 감사합니다.</p>$tpl$),
  ('kyc_approved', 'en', $tpl$[Altos Funding] KYC verification approved$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">KYC Verification Approved</h2>
<p>Dear {{ user_name }},</p>
<p>Your identity verification (KYC) has been successfully approved. You now have full access to all Altos Funding features.</p>$tpl$),
  ('kyc_approved', 'ko', $tpl$[Altos Funding] 본인 인증(KYC)이 승인되었습니다$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">본인 인증(KYC) 승인</h2>
<p>{{ user_name }}님, 안녕하세요.</p>
<p>본인 인증(KYC)이 승인되었습니다. 이제 알토스 펀딩의 모든 기능을 이용할 수 있습니다.</p>$tpl$),
  ('kyc_rejected', 'en', $tpl$[Altos Funding] KYC verification rejected$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">KYC Verification Rejected</h2>
<p>Dear {{ user_name }},</p>
<p>Unfortunately, your KYC verification could not be approved.</p>
<p>• Reason : {{ reason }}</p>
<p>Please resubmit with the correct documents. Contact support if you need assistance.</p>$tpl$),
  ('kyc_rejected', 'ko', $tpl$[Altos Funding] 본인 인증(KYC)이 거절되었습니다$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">본인 인증(KYC) 거절</h2>
<p>{{ user_name }}님, 안녕하세요.</p>
<p>아쉽게도 본인 인증(KYC)이 승인되지 않았습니다.</p>
<p>• 사유 : {{ reason }}</p>
<p>올바른 서류로 다시 제출해 주세요. 도움이 필요하시면 고객센터로 문의해 주세요.</p>$tpl$),
  ('deposit_confirmed', 'en', $tpl$[Altos Funding] Your deposit of {{ amount }} USDT is complete$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Deposit Successful</h2>
<p>Dear {{ user_name }},</p>
<p>Your deposit request has been completed.</p>
<p><strong>Deposit Details</strong></p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Deposit Amount:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ amount }} USDT</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Date:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ processed_at }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>TxID:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ tx_id }}</td></tr>
</table>
<p>You can check your deposit history in My Profile &gt; My Asset.</p>$tpl$),
  ('deposit_confirmed', 'ko', $tpl$[Altos Funding] {{ amount }} USDT 입금이 완료되었습니다$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">입금 완료</h2>
<p>{{ user_name }}님, 안녕하세요.</p>
<p>입금 신청이 완료되었습니다.</p>
<p><strong>입금 정보</strong></p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>입금액:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ amount }} USDT</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>처리 일시:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ processed_at }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>TxID:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ tx_id }}</td></tr>
</table>
<p>입금 내역은 My Profile &gt; My Asset에서 확인할 수 있습니다.</p>$tpl$),
  ('deposit_rejected', 'en', $tpl$[Altos Funding] Your deposit request was rejected$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Deposit Rejected</h2>
<p>Dear {{ user_name }},</p>
<p>Your deposit request has been rejected.</p>
<p><strong>Deposit Details</strong></p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Deposit Amount:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ amount }} USDT</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Date:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ processed_at }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>TxID:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ tx_id }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Rejected Reason:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ reason }}</td></tr>
</table>
<p>Please review the rejection reason and resubmit your request. If you need assistance, contact support.</p>$tpl$),
  ('deposit_rejected', 'ko', $tpl$[Altos Funding] 입금 신청이 거절되었습니다$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">입금 거절</h2>
<p>{{ user_name }}님, 안녕하세요.</p>
<p>입금 신청이 거절되었습니다.</p>
<p><strong>입금 정보</strong></p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>입금액:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ amount }} USDT</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>처리 일시:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ processed_at }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>TxID:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ tx_id }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>거절 사유:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ reason }}</td></tr>
</table>
<p>거절 사유를 확인하신 뒤 다시 신청해 주세요. 도움이 필요하시면 고객센터로 문의해 주세요.</p>$tpl$),
  ('withdrawal_requested', 'en', $tpl$[Altos Funding] Withdrawal request received$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Withdrawal Request Received</h2>
<p>Dear {{ recipient_email }},</p>
<p>Your withdrawal request has been received and is now under review.</p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Request No:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ payout_id }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Amount:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ amount }} USDT</td></tr>
</table>
<p>You will receive another email once your request has been processed.</p>$tpl$),
  ('withdrawal_requested', 'ko', $tpl$[Altos Funding] 출금 신청이 접수되었습니다$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">출금 신청 접수</h2>
<p>{{ recipient_email }}님, 안녕하세요.</p>
<p>출금 신청이 접수되어 검토 중입니다.</p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>신청 번호:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ payout_id }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>금액:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ amount }} USDT</td></tr>
</table>
<p>처리가 끝나면 다시 메일로 안내드립니다.</p>$tpl$),
  ('withdrawal_confirmed', 'en', $tpl$[Altos Funding] Your withdrawal of {{ amount }} USDT is complete$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Withdrawal Successful</h2>
<p>Dear {{ user_name }},</p>
<p>Your withdrawal request has been completed.</p>
<p><strong>Withdrawal Details</strong></p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Withdrawal Amount:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ amount }} USDT</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Fee:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ fee }} USDT</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Amount Received:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ received_amount }} USDT</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>TxID:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ tx_id }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Date:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ processed_at }}</td></tr>
</table>
<p>You can check your withdrawal history in My Profile &gt; My Asset.</p>$tpl$),
  ('withdrawal_confirmed', 'ko', $tpl$[Altos Funding] {{ amount }} USDT 출금이 완료되었습니다$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">출금 완료</h2>
<p>{{ user_name }}님, 안녕하세요.</p>
<p>출금 신청이 완료되었습니다.</p>
<p><strong>출금 정보</strong></p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>출금 금액:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ amount }} USDT</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>수수료:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ fee }} USDT</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>실수령액:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ received_amount }} USDT</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>TxID:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ tx_id }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>처리 일시:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ processed_at }}</td></tr>
</table>
<p>출금 내역은 My Profile &gt; My Asset에서 확인할 수 있습니다.</p>$tpl$),
  ('withdrawal_rejected', 'en', $tpl$[Altos Funding] Your withdrawal request was rejected$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Withdrawal Rejected</h2>
<p>Dear {{ user_name }},</p>
<p>Your withdrawal request has been rejected.</p>
<p><strong>Withdrawal Details</strong></p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Withdrawal Amount:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ amount }} USDT</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Fee:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ fee }} USDT</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Amount Received:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ received_amount }} USDT</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Date:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ processed_at }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Rejected Reason:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ reason }}</td></tr>
</table>
<p>Please review the rejection reason and resubmit your request. If you need assistance, contact support.</p>$tpl$),
  ('withdrawal_rejected', 'ko', $tpl$[Altos Funding] 출금 신청이 거절되었습니다$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">출금 거절</h2>
<p>{{ user_name }}님, 안녕하세요.</p>
<p>출금 신청이 거절되었습니다.</p>
<p><strong>출금 정보</strong></p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>출금 금액:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ amount }} USDT</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>수수료:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ fee }} USDT</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>실수령액:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ received_amount }} USDT</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>처리 일시:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ processed_at }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>거절 사유:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ reason }}</td></tr>
</table>
<p>거절 사유를 확인하신 뒤 다시 신청해 주세요. 도움이 필요하시면 고객센터로 문의해 주세요.</p>$tpl$),
  ('payout_approved', 'en', $tpl$[Altos Funding] Your funded payout is complete$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Funded Payout Successful</h2>
<p>Dear {{ user_name }},</p>
<p>Your withdrawal request has been completed.</p>
<p><strong>Funded Payout Details</strong></p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Account:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Payout Amount:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ amount }} USDT</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Date:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ processed_at }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Request No:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ payout_id }}</td></tr>
</table>
<p>You can check your payout history in My Profile &gt; My Asset.</p>$tpl$),
  ('payout_approved', 'ko', $tpl$[Altos Funding] 펀디드 수익 출금이 완료되었습니다$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">펀디드 수익 출금 완료</h2>
<p>{{ user_name }}님, 안녕하세요.</p>
<p>출금 신청이 완료되었습니다.</p>
<p><strong>펀디드 출금 정보</strong></p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>계좌:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>출금 금액:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ amount }} USDT</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>처리 일시:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ processed_at }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>신청 번호:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ payout_id }}</td></tr>
</table>
<p>출금 내역은 My Profile &gt; My Asset에서 확인할 수 있습니다.</p>$tpl$),
  ('payout_rejected', 'en', $tpl$[Altos Funding] Your funded payout request was rejected$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Funded Payout Rejected</h2>
<p>Dear {{ user_name }},</p>
<p>Your funded payout request has been rejected.</p>
<p><strong>Funded Payout Details</strong></p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Account:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Payout Amount:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ amount }} USDT</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Date:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ processed_at }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Request No:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ payout_id }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Rejected Reason:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ reason }}</td></tr>
</table>
<p>Please review the rejection reason and resubmit your request. If you need assistance, contact support.</p>$tpl$),
  ('payout_rejected', 'ko', $tpl$[Altos Funding] 펀디드 수익 출금 신청이 거절되었습니다$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">펀디드 수익 출금 거절</h2>
<p>{{ user_name }}님, 안녕하세요.</p>
<p>펀디드 수익 출금 신청이 거절되었습니다.</p>
<p><strong>펀디드 출금 정보</strong></p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>계좌:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>출금 금액:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ amount }} USDT</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>처리 일시:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ processed_at }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>신청 번호:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ payout_id }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>거절 사유:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ reason }}</td></tr>
</table>
<p>거절 사유를 확인하신 뒤 다시 신청해 주세요. 도움이 필요하시면 고객센터로 문의해 주세요.</p>$tpl$),
  ('challenge_applied', 'en', $tpl$[Altos Funding] Challenge ticket purchased$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Challenge Ticket Purchased</h2>
<p>Dear {{ user_name }},</p>
<p>Your challenge ticket has been successfully purchased.</p>
<p><strong>Purchase Details</strong></p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Challenge Type:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ challenge_name }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Quantity:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ quantity }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Total Amount:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ amount }} USDT</td></tr>
</table>
<p>You will receive a separate email once your challenge account has been created.</p>$tpl$),
  ('challenge_applied', 'ko', $tpl$[Altos Funding] 챌린지 티켓 구매가 완료되었습니다$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">챌린지 티켓 구매 완료</h2>
<p>{{ user_name }}님, 안녕하세요.</p>
<p>챌린지 티켓 구매가 완료되었습니다.</p>
<p><strong>구매 정보</strong></p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>챌린지 유형:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ challenge_name }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>수량:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ quantity }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>총 금액:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ amount }} USDT</td></tr>
</table>
<p>챌린지 계좌가 생성되면 별도 메일로 안내드립니다.</p>$tpl$),
  ('challenge_account_issued', 'en', $tpl$[Altos Funding] Your challenge account has been issued$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Challenge Account</h2>
<p>Dear {{ user_name }},</p>
<p>Your challenge's account &amp; password has been successfully issued.</p>
<p><strong>Account Details</strong></p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 Login Account:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Password:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_password }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Period:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ start_date }} – {{ end_date }} (GMT)</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Server:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">MexnLimited-Demo</td></tr>
</table>
<p>You can now log in to MT4 and start trading. Good luck!</p>$tpl$),
  ('challenge_account_issued', 'ko', $tpl$[Altos Funding] 챌린지 계좌가 발급되었습니다$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">챌린지 계좌 발급</h2>
<p>{{ user_name }}님, 안녕하세요.</p>
<p>챌린지 계좌와 비밀번호가 발급되었습니다.</p>
<p><strong>계좌 정보</strong></p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 로그인 계정:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>비밀번호:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_password }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>기간:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ start_date }} – {{ end_date }} (GMT)</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>서버:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">MexnLimited-Demo</td></tr>
</table>
<p>이제 MT4에 로그인해 거래를 시작할 수 있습니다. 행운을 빕니다!</p>$tpl$),
  ('challenge_started_notify', 'en', $tpl$[Altos Funding] Your challenge is starting soon$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Your Challenge Is Starting Soon</h2>
<p>Dear {{ user_name }},</p>
<p>Your challenge account is ready. Please use the credentials below to log in to MT4 before trading begins.</p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Challenge:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ challenge_name }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 Login:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Password:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_password }}</td></tr>
</table>
<p>Good luck with your challenge!</p>$tpl$),
  ('challenge_started_notify', 'ko', $tpl$[Altos Funding] 챌린지가 곧 시작됩니다$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">챌린지가 곧 시작됩니다</h2>
<p>{{ user_name }}님, 안녕하세요.</p>
<p>챌린지 계좌가 준비되었습니다. 거래가 시작되기 전에 아래 정보로 MT4에 로그인해 주세요.</p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>챌린지:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ challenge_name }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 로그인:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>비밀번호:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_password }}</td></tr>
</table>
<p>챌린지에서 좋은 결과 있기를 바랍니다!</p>$tpl$),
  ('challenge_started', 'en', $tpl$[Altos Funding] Your challenge trading has started$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Challenge Trading Started</h2>
<p>Dear {{ user_name }},</p>
<p>Your challenge account is now active and trading has started.</p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Challenge:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ challenge_name }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 Login:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Account Type:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ account_type }}</td></tr>
</table>
<p>Good luck with your challenge!</p>$tpl$),
  ('challenge_started', 'ko', $tpl$[Altos Funding] 챌린지 거래가 시작되었습니다$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">챌린지 거래 시작</h2>
<p>{{ user_name }}님, 안녕하세요.</p>
<p>챌린지 계좌가 활성화되어 거래가 시작되었습니다.</p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>챌린지:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ challenge_name }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 로그인:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>계좌 유형:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ account_type }}</td></tr>
</table>
<p>챌린지에서 좋은 결과 있기를 바랍니다!</p>$tpl$),
  ('challenge_closed_notify', 'en', $tpl$[Altos Funding] Your challenge has been closed$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Challenge Closed</h2>
<p>Dear {{ user_name }},</p>
<p>Your challenge account has been closed.</p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Challenge:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ challenge_name }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 Login:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Phase:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ challenge_phase }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Period:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ start_date }} – {{ end_date }} (GMT)</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Final Balance:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ final_balance }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Profit:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ profit_pct }}%</td></tr>
</table>
<p>Please check your dashboard for detailed results.</p>$tpl$),
  ('challenge_closed_notify', 'ko', $tpl$[Altos Funding] 챌린지가 종료되었습니다$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">챌린지 종료</h2>
<p>{{ user_name }}님, 안녕하세요.</p>
<p>회원님의 챌린지 계좌가 종료되었습니다.</p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>챌린지:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ challenge_name }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 로그인:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>단계:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ challenge_phase }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>기간:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ start_date }} – {{ end_date }} (GMT)</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>최종 잔고:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ final_balance }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>수익률:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ profit_pct }}%</td></tr>
</table>
<p>자세한 결과는 대시보드에서 확인해 주세요.</p>$tpl$),
  ('challenge_passed', 'en', $tpl$[Altos Funding] Congratulations! You passed the challenge$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Challenge Result Notification</h2>
<p>Dear {{ user_name }},</p>
<p>Congratulations on ranking in the <strong>top 10%</strong> of all Challenge participants!</p>
<p><strong>Account Details</strong></p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Challenge Type:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ challenge_name }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 Login Account:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Period:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ start_date }} – {{ end_date }} (GMT)</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Result:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">Pass</td></tr>
</table>
<p>Your funded account information will be sent to your email within <strong>24 hours</strong>. If you do not receive the email within this period, please contact us at support.</p>$tpl$),
  ('challenge_passed', 'ko', $tpl$[Altos Funding] 축하합니다! 챌린지에 합격했습니다$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">챌린지 결과 안내</h2>
<p>{{ user_name }}님, 안녕하세요.</p>
<p>전체 챌린지 참가자 중 <strong>상위 10%</strong>에 드신 것을 축하드립니다!</p>
<p><strong>계좌 정보</strong></p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>챌린지 유형:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ challenge_name }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 로그인 계정:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>기간:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ start_date }} – {{ end_date }} (GMT)</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>결과:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">합격</td></tr>
</table>
<p>펀디드 계좌 정보는 <strong>24시간</strong> 안에 메일로 보내 드립니다. 이 기간 안에 메일을 받지 못하시면 고객센터로 문의해 주세요.</p>$tpl$),
  ('challenge_failed', 'en', $tpl$[Altos Funding] Challenge result notification$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Challenge Result Notification</h2>
<p>Dear {{ user_name }},</p>
<p>Unfortunately, you did not meet the required criteria for the Challenge, and your participation has been disqualified.</p>
<p><strong>Account Details</strong></p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Challenge Type:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ challenge_name }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 Login Account:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Period:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ start_date }} – {{ end_date }} (GMT)</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Result:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">Fail</td></tr>
</table>
<p>Don't give up! You can purchase a new challenge ticket and try again.</p>$tpl$),
  ('challenge_failed', 'ko', $tpl$[Altos Funding] 챌린지 결과 안내$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">챌린지 결과 안내</h2>
<p>{{ user_name }}님, 안녕하세요.</p>
<p>아쉽게도 챌린지 기준을 충족하지 못해 불합격 처리되었습니다.</p>
<p><strong>계좌 정보</strong></p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>챌린지 유형:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ challenge_name }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 로그인 계정:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>기간:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ start_date }} – {{ end_date }} (GMT)</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>결과:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">불합격</td></tr>
</table>
<p>포기하지 마세요! 새 챌린지 티켓을 구매해 다시 도전할 수 있습니다.</p>$tpl$),
  ('account_violated', 'en', $tpl$[Altos Funding] Rule violation detected on your account$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Account Rule Violation Detected</h2>
<p>Dear {{ user_name }},</p>
<p>A rule violation was detected on your {{ account_type }} account.</p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 Login:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Violation Reason:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ message }} ({{ rule_key }})</td></tr>
</table>
<p>Consequently, your account has been marked as FAILED and trading has been locked.</p>
<p>Please check your dashboard for more details.</p>$tpl$),
  ('account_violated', 'ko', $tpl$[Altos Funding] 계좌에서 규정 위반이 감지되었습니다$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">계좌 규정 위반 감지</h2>
<p>{{ user_name }}님, 안녕하세요.</p>
<p>회원님의 {{ account_type }} 계좌에서 규정 위반이 감지되었습니다.</p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 로그인:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>위반 사유:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ message }} ({{ rule_key }})</td></tr>
</table>
<p>이에 따라 계좌가 실패(FAILED) 처리되었고 거래가 잠겼습니다.</p>
<p>자세한 내용은 대시보드에서 확인해 주세요.</p>$tpl$),
  ('margin_call_warning', 'en', $tpl$[Altos Funding] Margin call warning$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Margin Call Warning</h2>
<p>Dear {{ user_name }},</p>
<p>A risk warning was triggered on your trading account.</p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 Login:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Rule:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ rule_key }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Message:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ message }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Current Equity:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ current_equity }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Remaining Buffer:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ remaining }}</td></tr>
</table>
<p>Please review your positions and risk exposure immediately.</p>
{% if dashboard_url %}
<div style="text-align:center;margin:24px 0;">
<a href="{{ dashboard_url }}" style="background:#1a1a2e;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;">Open Dashboard</a>
</div>
{% endif %}$tpl$),
  ('margin_call_warning', 'ko', $tpl$[Altos Funding] 마진콜 경고$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">마진콜 경고</h2>
<p>{{ user_name }}님, 안녕하세요.</p>
<p>회원님의 거래 계좌에서 위험 경고가 발생했습니다.</p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 로그인:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>규칙:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ rule_key }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>내용:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ message }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>현재 Equity:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ current_equity }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>남은 여유분:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ remaining }}</td></tr>
</table>
<p>보유 포지션과 위험 노출을 즉시 확인해 주세요.</p>
{% if dashboard_url %}
<div style="text-align:center;margin:24px 0;">
<a href="{{ dashboard_url }}" style="background:#1a1a2e;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;">대시보드 열기</a>
</div>
{% endif %}$tpl$),
  ('account_suspended', 'en', $tpl$[Altos Funding] Your trading account has been suspended$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Account Temporarily Suspended</h2>
<p>Dear {{ user_name }},</p>
<p>Your trading account has been temporarily suspended.</p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 Login:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Reason:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ reason }}</td></tr>
</table>
<p>Your trading access has been temporarily restricted. If you have any questions or believe this is an error, please contact our support team.</p>$tpl$),
  ('account_suspended', 'ko', $tpl$[Altos Funding] 거래 계좌가 일시 정지되었습니다$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">계정 일시 정지</h2>
<p>{{ user_name }}님, 안녕하세요.</p>
<p>회원님의 거래 계좌가 일시 정지되었습니다.</p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 로그인:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>사유:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ reason }}</td></tr>
</table>
<p>거래가 일시적으로 제한되었습니다. 문의 사항이 있거나 착오라고 생각되시면 고객센터로 문의해 주세요.</p>$tpl$),
  ('account_banned', 'en', $tpl$[Altos Funding] Your trading account has been banned$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Account Permanently Banned</h2>
<p>Dear {{ user_name }},</p>
<p>Your trading account has been permanently banned due to a violation of our terms of service.</p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 Login:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Reason:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ reason }}</td></tr>
</table>
<p>Please contact our support team if you believe this is an error or need further information.</p>$tpl$),
  ('account_banned', 'ko', $tpl$[Altos Funding] 거래 계좌가 영구 정지되었습니다$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">계정 영구 정지</h2>
<p>{{ user_name }}님, 안녕하세요.</p>
<p>이용 약관 위반으로 회원님의 거래 계좌가 영구 정지되었습니다.</p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 로그인:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>사유:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ reason }}</td></tr>
</table>
<p>착오라고 생각되시거나 자세한 내용이 필요하시면 고객센터로 문의해 주세요.</p>$tpl$),
  ('funding_account_issued', 'en', $tpl$[Altos Funding] Your funded account has been issued$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Funded Account Issued</h2>
<p>Dear {{ user_name }},</p>
<p>Your funded's account &amp; password has been successfully issued.</p>
<p><strong>Account Details</strong></p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 Login Account:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Password:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_password }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Start Date:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{% if end_date %}{{ start_date }} – {{ end_date }} (GMT){% else %}{{ start_date }} (GMT){% endif %}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Server:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">MexnLimited-Live</td></tr>
</table>
<p>You can now log in to MT4 and start trading. Good luck!</p>$tpl$),
  ('funding_account_issued', 'ko', $tpl$[Altos Funding] 펀디드 계좌가 발급되었습니다$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">펀디드 계좌 발급</h2>
<p>{{ user_name }}님, 안녕하세요.</p>
<p>펀디드 계좌와 비밀번호가 발급되었습니다.</p>
<p><strong>계좌 정보</strong></p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 로그인 계정:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>비밀번호:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_password }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>시작일:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{% if end_date %}{{ start_date }} – {{ end_date }} (GMT){% else %}{{ start_date }} (GMT){% endif %}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>서버:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">MexnLimited-Live</td></tr>
</table>
<p>이제 MT4에 로그인해 거래를 시작할 수 있습니다. 행운을 빕니다!</p>$tpl$),
  ('funding_started_notify', 'en', $tpl$[Altos Funding] Your funded account is starting soon$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Your Funded Account Is Starting Soon</h2>
<p>Dear {{ user_name }},</p>
<p>Your funded account is ready. Please use the credentials below to log in to MT4.</p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Funded Program:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ funding_name }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 Login:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Password:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_password }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Server:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_server }}</td></tr>
</table>
<p>Good luck with your funded trading!</p>$tpl$),
  ('funding_started_notify', 'ko', $tpl$[Altos Funding] 펀디드 계좌 거래가 곧 시작됩니다$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">펀디드 계좌 거래가 곧 시작됩니다</h2>
<p>{{ user_name }}님, 안녕하세요.</p>
<p>펀디드 계좌가 준비되었습니다. 아래 정보로 MT4에 로그인해 주세요.</p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>펀디드 프로그램:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ funding_name }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 로그인:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>비밀번호:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_password }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>서버:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_server }}</td></tr>
</table>
<p>펀디드 거래에서 좋은 결과 있기를 바랍니다!</p>$tpl$),
  ('funding_started', 'en', $tpl$[Altos Funding] Your funded trading has started$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Funded Trading Started</h2>
<p>Dear {{ user_name }},</p>
<p>Your funded account is now active and trading has started.</p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Program:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ funding_name }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 Login:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Account Type:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ account_type }}</td></tr>
</table>
<p>Good luck with your funded trading!</p>$tpl$),
  ('funding_started', 'ko', $tpl$[Altos Funding] 펀디드 거래가 시작되었습니다$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">펀디드 거래 시작</h2>
<p>{{ user_name }}님, 안녕하세요.</p>
<p>펀디드 계좌가 활성화되어 거래가 시작되었습니다.</p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>프로그램:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ funding_name }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 로그인:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>계좌 유형:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ account_type }}</td></tr>
</table>
<p>펀디드 거래에서 좋은 결과 있기를 바랍니다!</p>$tpl$),
  ('funding_suspended', 'en', $tpl$[Altos Funding] Your funded account has been suspended$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Funded Account Suspended</h2>
<p>Dear {{ user_name }},</p>
<p>Your funded account has been temporarily suspended.</p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Funded Program:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ funding_name }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 Login:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Reason:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ reason }}</td></tr>
</table>
<p>If you have any questions, please contact our support team.</p>$tpl$),
  ('funding_suspended', 'ko', $tpl$[Altos Funding] 펀디드 계좌가 일시 정지되었습니다$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">펀디드 계좌 일시 정지</h2>
<p>{{ user_name }}님, 안녕하세요.</p>
<p>회원님의 펀디드 계좌가 일시 정지되었습니다.</p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>펀디드 프로그램:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ funding_name }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 로그인:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>사유:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ reason }}</td></tr>
</table>
<p>문의 사항이 있으시면 고객센터로 문의해 주세요.</p>$tpl$),
  ('funding_terminated', 'en', $tpl$[Altos Funding] Your funded account has been terminated$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Funded Account Terminated</h2>
<p>Dear {{ user_name }},</p>
<p>Your funded account has been terminated.</p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Funded Program:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ funding_name }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 Login:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Reason:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ reason }}</td></tr>
</table>
<p>Please contact our support team if you need further information.</p>$tpl$),
  ('funding_terminated', 'ko', $tpl$[Altos Funding] 펀디드 계좌가 해지되었습니다$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">펀디드 계좌 해지</h2>
<p>{{ user_name }}님, 안녕하세요.</p>
<p>회원님의 펀디드 계좌가 해지되었습니다.</p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>펀디드 프로그램:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ funding_name }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 로그인:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>사유:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ reason }}</td></tr>
</table>
<p>자세한 내용이 필요하시면 고객센터로 문의해 주세요.</p>$tpl$),
  ('funding_closed_notify', 'en', $tpl$[Altos Funding] Your funded account has been closed$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Funded Account Closed</h2>
<p>Dear {{ user_name }},</p>
<p>Your funded account (Login: {{ mt4_login }}) has been closed.</p>
<p>Please refer to your dashboard for the detailed settlement reports.</p>$tpl$),
  ('funding_closed_notify', 'ko', $tpl$[Altos Funding] 펀디드 계좌가 종료되었습니다$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">펀디드 계좌 종료</h2>
<p>{{ user_name }}님, 안녕하세요.</p>
<p>회원님의 펀디드 계좌(로그인: {{ mt4_login }})가 종료되었습니다.</p>
<p>자세한 정산 내역은 대시보드에서 확인해 주세요.</p>$tpl$),
  ('mts_operation_failed', 'en', $tpl$[Altos Funding][Alert] MT4 operation failed: {{ operation }}$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">MTS Operation Failed</h2>
<p>An MT4/MTS operation has failed and requires immediate attention.</p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 Login:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Operation:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ operation }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Context:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ context }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Reference ID:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ reference_id }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Severity:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ severity }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Error:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ error_message }}</td></tr>
</table>$tpl$),
  ('mts_operation_failed', 'ko', $tpl$[Altos Funding][알림] MT4 작업 실패: {{ operation }}$tpl$,
   $tpl$<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">MT4 작업 실패</h2>
<p>MT4/MTS 작업이 실패했습니다. 즉시 확인이 필요합니다.</p>
<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 로그인:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>작업:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ operation }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>상황:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ context }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>참조 ID:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ reference_id }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>심각도:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ severity }}</td></tr>
<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>오류:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ error_message }}</td></tr>
</table>$tpl$),
  ('manual_broadcast', 'en', $tpl${{ subject }}$tpl$,
   $tpl${{ body_html | safe }}
{% if is_marketing %}
<hr/>
<p style="font-size:12px;color:#666;">
If you no longer wish to receive these emails, click <a href="{{ unsubscribe_url }}">Unsubscribe</a>.
</p>
{% endif %}$tpl$),
  ('manual_broadcast', 'ko', $tpl${{ subject }}$tpl$,
   $tpl${{ body_html | safe }}
{% if is_marketing %}
<hr/>
<p style="font-size:12px;color:#666;">
더 이상 이 메일을 받고 싶지 않으시면 <a href="{{ unsubscribe_url }}">수신 거부</a>를 눌러 주세요.
</p>
{% endif %}$tpl$);
