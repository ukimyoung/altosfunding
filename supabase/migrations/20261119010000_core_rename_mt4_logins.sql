-- core.mt4_logins → core.mt4_account_issued_history (MT4 계좌번호 발급 기록)
-- 'logins'가 접속 기록처럼 읽혀서 이름만 바꾼다. 데이터·컬럼·동작은 그대로.
-- 테이블 이름과 함께 mt4_logins_로 시작하는 제약조건·인덱스·트리거 이름도 바꾼다.
alter table core.mt4_logins rename to mt4_account_issued_history;

do $$
declare
  r record;
begin
  -- 제약조건 (primary key 이름을 바꾸면 그 인덱스 이름도 함께 바뀐다)
  for r in
    select conname from pg_constraint
    where conrelid = 'core.mt4_account_issued_history'::regclass and conname like 'mt4\_logins\_%'
  loop
    execute format('alter table core.mt4_account_issued_history rename constraint %I to %I',
                   r.conname, 'mt4_account_issued_history_' || substr(r.conname, length('mt4_logins_') + 1));
  end loop;

  -- 나머지 인덱스
  for r in
    select c.relname from pg_index i join pg_class c on c.oid = i.indexrelid
    where i.indrelid = 'core.mt4_account_issued_history'::regclass and c.relname like 'mt4\_logins\_%'
  loop
    execute format('alter index core.%I rename to %I',
                   r.relname, 'mt4_account_issued_history_' || substr(r.relname, length('mt4_logins_') + 1));
  end loop;
end $$;

alter trigger mt4_logins_set_updated_at on core.mt4_account_issued_history
  rename to mt4_account_issued_history_set_updated_at;
