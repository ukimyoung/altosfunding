-- 챌린지 상품은 원가격(price_usdt)을 할인해서 판매한다.
-- 할인가격이 비어 있으면(null) 할인 없이 원가격으로 판매한다.
-- 상품 수정은 신규 구매분부터 적용된다(구매 시점 가격은 주문에 따로 남긴다).

alter table core.products
  add column discount_price_usdt numeric(18,2)
    check (discount_price_usdt >= 0);

alter table core.products
  add constraint products_discount_price_not_above_price
    check (discount_price_usdt is null or discount_price_usdt <= price_usdt);

comment on column core.products.discount_price_usdt is '할인가격(USDT). null이면 할인 없음, 원가격(price_usdt) 이하여야 한다.';
