-- 트레이딩 룰 자동 검증 2단계 (조치, 2026-11-20 사용자 승인)
-- - Max Drawdown 위반 → 계좌 FAILED + 전량 청산 + MT4 읽기 전용 (Worker)
-- - 펀디드 Daily Loss 위반 → 그날만 정지 (trading_halted_until = 다음 거래일 시작, 상태 ACTIVE 유지)
-- - 대회 종료 → 거래 중이던 계좌 전량 청산 + 잠금
-- - 최종 판정(자동·관리자 확인) → 계좌 상태 PASSED / FAILED

alter table core.trading_accounts add column trading_halted_until timestamptz;

-- 상태 이력에 시스템 조치(룰 위반·최종 판정)도 남긴다. changed_by = null이면 시스템.
alter table core.trading_account_status_history drop constraint trading_account_status_history_action_check;
alter table core.trading_account_status_history
  add constraint trading_account_status_history_action_check
  check (action in ('FREEZE', 'UNFREEZE', 'BAN', 'RULE_VIOLATION', 'EVALUATION'));

-- 1단계 동안 이미 끝난 대회에서 최종 판정(종료 시각까지 본 판정)이 있는 CLOSED 계좌는 마지막 판정 결과로 맞춘다.
-- 결과 메일은 보내지 않는다.
with final as (
  select distinct on (ev.account_id) ev.account_id, ev.result
  from core.challenge_evaluations ev
  join core.trading_accounts ta on ta.id = ev.account_id
  join core.challenges c on c.id = ta.challenge_id
  where c.status = 'CLOSED'
    and ev.period_end >= least(c.end_at, coalesce(c.closed_at, c.end_at))
  order by ev.account_id, ev.created_at desc, ev.id desc
), hist as (
  insert into core.trading_account_status_history (account_id, action, from_status, to_status, reason)
  select a.id, 'EVALUATION', a.status, f.result, '챌린지 최종 판정 ' || f.result || ' (2단계 적용 시 반영)'
  from core.trading_accounts a join final f on f.account_id = a.id
  where a.status = 'CLOSED'
  returning account_id
)
update core.trading_accounts a
set status = f.result, updated_at = now()
from final f
where a.id = f.account_id and a.status = 'CLOSED';
