-- 백오피스 챌린지 상품 추가·수정 팝업 '최소거래일'.
-- 상품별 값이며, 비어 있으면(null) 연결된 룰셋의 min_trading_days를 쓴다.
alter table core.products
  add column if not exists min_trading_days integer check (min_trading_days is null or min_trading_days >= 0);
