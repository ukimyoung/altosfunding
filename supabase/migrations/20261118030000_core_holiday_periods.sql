-- 휴장일을 날짜 하루 단위에서 기간(From ~ To, 날짜+시각, UTC)으로 바꾼다.
-- 예: 2026-12-24 14:00 ~ 2026-12-25 13:00. 이 기간 안에 시작 시각이 걸리는 대회는 다음 영업일 같은 시각으로 미룬다.
-- 기존 날짜 행은 그날 00:00 ~ 다음날 00:00 (UTC)으로 옮긴다.

alter table core.holidays
  add column start_at timestamptz,
  add column end_at   timestamptz;

update core.holidays
   set start_at = date::timestamp at time zone 'UTC',
       end_at   = (date + 1)::timestamp at time zone 'UTC';

alter table core.holidays
  alter column start_at set not null,
  alter column end_at   set not null,
  add constraint holidays_period_check check (end_at > start_at),
  drop column date;

create index holidays_period_idx on core.holidays (start_at, end_at) where is_active;
