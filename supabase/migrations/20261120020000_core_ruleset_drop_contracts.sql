-- CFD 서비스라 선물 계약수 개념을 쓰지 않는다(사용자 결정 2026-11-20).
-- 룰셋의 최대 Mini·Micro 거래 계약수 컬럼을 삭제한다.
alter table core.rulesets
  drop column if exists max_mini_contracts,
  drop column if exists max_micro_contracts;
