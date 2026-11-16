-- 룰셋 팝업 최신 디자인(Make 1114) 반영.
-- 1) 손실·수익 조건을 금액($)으로 관리한다(사용자 결정 2026-11-16).
--    최대 손실 금액은 기존 max_dd_normal_amt를 쓰고, 일일 손실 한도·수익 목표 금액 컬럼을 추가한다.
--    기존 비율(%) 컬럼은 남겨 두며, 금액이 비어 있을 때만 비율로 계산한다.
-- 2) 룰셋 '거래 활동 조건'에 최대 Mini·Micro 거래 계약수와 일관성(Consistency)을 추가한다.
-- max_mini_contracts / max_micro_contracts: 한 번에 보유할 수 있는 최대 Mini·Micro 계약 수. null이면 제한 없음.
-- consistency_pct: 하루 수익이 전체 수익에서 차지할 수 있는 최대 비율(%). null이면 검사하지 않음.

alter table core.rulesets
  add column daily_loss_limit_amt numeric(18,2) check (daily_loss_limit_amt >= 0),
  add column profit_target_amt numeric(18,2) check (profit_target_amt >= 0),
  add column max_mini_contracts integer check (max_mini_contracts > 0),
  add column max_micro_contracts integer check (max_micro_contracts > 0),
  add column consistency_pct numeric(7,3) check (consistency_pct >= 0 and consistency_pct <= 100);

comment on column core.rulesets.max_mini_contracts is '최대 Mini 거래 계약수. null이면 제한 없음';
comment on column core.rulesets.max_micro_contracts is '최대 Micro 거래 계약수. null이면 제한 없음';
comment on column core.rulesets.consistency_pct is '일관성(%): 하루 수익이 전체 수익에서 차지할 수 있는 최대 비율. null이면 검사 안 함';
comment on column core.rulesets.daily_loss_limit_amt is '일일 손실 한도($). null이면 daily_loss_limit_pct로 계산';
comment on column core.rulesets.profit_target_amt is '수익 목표($). null이면 profit_target_pct로 계산';
