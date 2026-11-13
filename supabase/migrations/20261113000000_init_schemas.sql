-- 초기 스키마: 서비스별로 스키마를 나눠 한 Supabase 프로젝트 안에서 관리합니다.
--   core          : Core Backend (회원, 챌린지, 계좌, 거래 기록 등)
--   notification  : Notification Hub (알림, 발송 이력)
-- 실제 테이블은 이후 마이그레이션에서 추가합니다.

create schema if not exists core;
create schema if not exists notification;
