-- 그룹 인원(대회 정원)을 비우면 무제한 (2026-11-18 사용자 결정).
-- 새 시스템은 상품마다 하루 한 번 대회가 열리고, 정원이 없을 수도 있다.
-- null = 정원 없음(누구나 참가), 값이 있으면 그 인원까지만 참가.

alter table core.challenge_schedules alter column group_size drop not null;
alter table core.challenge_schedules alter column group_size drop default;

alter table core.challenges alter column group_size drop not null;
alter table core.challenges alter column group_size drop default;
