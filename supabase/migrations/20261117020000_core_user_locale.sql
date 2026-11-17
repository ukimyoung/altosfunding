-- 회원별 언어. 회원에게 보내는 알림 메일(입출금 승인, KYC 결과 등)을 이 언어로 보낸다.
-- 가입·로그인 때와 웹에서 언어를 바꿀 때 저장한다 (en | ko).
alter table core.users
  add column locale text not null default 'en' check (locale in ('en', 'ko'));
