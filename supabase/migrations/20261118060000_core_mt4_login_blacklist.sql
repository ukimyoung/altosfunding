-- MT4 계좌번호 수동 블랙리스트 (백오피스 운영 관리 > 계좌 관리)
-- 관리자가 core.mt4_logins에 BLACKLISTED 행을 미리 넣어 두면, 발급 때 번호를 넣다가 충돌하므로 자동으로 건너뛴다.
-- source: SYSTEM(발급 과정에서 자동 기록) | ADMIN(관리자가 등록·전환). 관리자가 등록한 BLACKLISTED만 해제(행 삭제)할 수 있다.
alter table core.mt4_logins
  add column source text not null default 'SYSTEM' check (source in ('SYSTEM', 'ADMIN')),
  add column created_by uuid references core.users (id) on delete set null;

create index mt4_logins_server_status_idx on core.mt4_logins (mt4_server, status, mt4_login);
