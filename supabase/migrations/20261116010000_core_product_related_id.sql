-- 펀디드 상품이 어떤 챌린지 상품에 연결되는지 (백오피스 펀디드 상품 팝업의 '연관 챌린지 상품').
-- 값은 챌린지 상품의 상품코드 (예: 1001). 펀디드 상품에만 넣는다.
-- 챌린지 상품 하나에는 펀디드 상품 하나만 연결한다.

alter table core.products
  add column related_id text
    references core.products (id) on update cascade on delete set null;

alter table core.products
  add constraint products_related_id_not_self check (related_id is null or related_id <> id);

create unique index products_related_id_key on core.products (related_id) where related_id is not null;

comment on column core.products.related_id is
  '연관 챌린지 상품 id (펀디드 상품에만 사용, 예: 1001). 챌린지 상품 하나에 펀디드 상품 하나만 연결된다.';
