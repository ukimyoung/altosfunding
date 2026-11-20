-- 챌린지 합격 → 펀디드 계좌 자동 발급 (2026-11-20 사용자 승인)
-- - 최종 판정(종료 10분 뒤 자동 판정 또는 관리자 '확인하기')으로 챌린지 계좌가 PASSED가 되면
--   연결된 펀디드 상품(related_id, 없으면 next_product_id)으로 펀디드 계좌를 만든다.
-- - 발급 시각 = 대회 종료 + 챌린지 상품의 funding_start_delay_hours (주말·휴장이면 다음 영업 시각).
-- - MT4 발급은 챌린지와 같은 작업(mt4.provision_challenge_account)이 LIVE 서버에 한다.

alter table core.trading_accounts
  add column source_account_id uuid references core.trading_accounts (id);

comment on column core.trading_accounts.source_account_id is
  '펀디드 계좌: 합격한 챌린지 계좌 id. 챌린지 계좌 1개당 발급 실패(FAILED)가 아닌 펀디드 계좌는 1개만.';

create unique index trading_accounts_source_account_key
  on core.trading_accounts (source_account_id)
  where source_account_id is not null and provision_status <> 'FAILED';
