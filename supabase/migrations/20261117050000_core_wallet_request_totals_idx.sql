-- 백오피스 '입출금 내역' 상단 카드(총 입금·총 출금 금액)용 인덱스.
-- 합계는 별도 테이블 없이 요청 테이블에서 바로 더한다
--   select sum(amount) from core.deposit_requests where status = 'APPROVED' [and created_at 기간]
-- 기존 (status, created_at) 인덱스에 amount를 포함(include)해 테이블을 읽지 않고(index-only scan) 합산하게 바꾼다.
-- 목록 화면의 상태·기간 조회도 같은 인덱스를 그대로 쓴다.

create index deposit_requests_status_created_amount_idx
  on core.deposit_requests (status, created_at) include (amount);
drop index if exists core.deposit_requests_status_idx;

create index withdrawal_requests_status_created_amount_idx
  on core.withdrawal_requests (status, created_at) include (amount);
drop index if exists core.withdrawal_requests_status_idx;
