-- 제휴 회원 사전 가입.
--
-- 관리자가 백오피스에서 고른 제휴 회원(core.partner_members)의 Altos 계정을 미리 만든다.
-- 미리 만든 계정은 비밀번호가 없고 activated_at이 비어 있다(활성화 전).
-- 회원이 Member ID로 처음 로그인하면 지금과 같은 계정 활성화 화면으로 안내하고,
-- 활성화하면 새로 만들지 않고 이 계정에 비밀번호·인증 이메일·약관 동의·activated_at을 채운다.
--
-- activated_at: 제휴 계정(auth_provider = 'PARTNER')만 쓴다. 이미 활성화한 제휴 계정은 가입 시각으로 채운다.
-- pre_registered_at·pre_registered_by: 사전 가입으로 만든 계정이면 그 시각과 실행한 관리자.

alter table core.users
  add column activated_at timestamptz,
  add column pre_registered_at timestamptz,
  add column pre_registered_by uuid references core.users (id);

update core.users set activated_at = created_at where auth_provider = 'PARTNER';

create index users_partner_pending_idx on core.users (created_at)
  where auth_provider = 'PARTNER' and activated_at is null;
