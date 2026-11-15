-- 회원 Account ID(uid)를 임의의 10자리 숫자로 바꾼다 (예: 4829105736).
-- 이미 가입한 회원의 영문 번호(AF...)도 겹치지 않는 새 숫자로 바꾼다.

do $$
declare
  rec record;
  candidate text;
begin
  for rec in select id from core.users where uid !~ '^[1-9][0-9]{9}$' loop
    loop
      candidate := (floor(random() * 9) + 1)::int::text || lpad(floor(random() * 1000000000)::bigint::text, 9, '0');
      exit when not exists (select 1 from core.users where uid = candidate);
    end loop;
    update core.users set uid = candidate where id = rec.id;
  end loop;
end $$;

alter table core.users
  add constraint users_uid_format check (uid ~ '^[1-9][0-9]{9}$');

comment on column core.users.uid is '화면·고객지원에서 쓰는 Account ID. 임의의 10자리 숫자, 중복 불가.';
