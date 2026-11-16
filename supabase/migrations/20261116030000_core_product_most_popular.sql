-- 'MOST POPULAR' 뱃지를 룰셋이 아닌 상품 단위로 관리한다 (사용자 지시 2026-11-16).
-- 1) 상품의 '추천' 표시(is_recommended)와 뜻이 같으므로 이름을 is_most_popular로 바꿔 하나로 합친다.
--    (웹 Start New Challenge·랜딩 Account Size 카드의 MOST POPULAR 뱃지)
-- 2) 룰셋의 is_most_popular는 더 이상 쓰지 않으므로 삭제한다.
-- 3) 상품명이 'Challenge Elite'인 챌린지 상품에 뱃지를 표시하고, 나머지 상품의 뱃지는 끈다.

alter table core.products rename column is_recommended to is_most_popular;

comment on column core.products.is_most_popular is 'MOST POPULAR 뱃지 표시 (랜딩 Account Size, Start New Challenge 카드)';

alter table core.rulesets drop column is_most_popular;

update core.products
set is_most_popular = (tier_type = 'CHALLENGE' and lower(trim(name)) = 'challenge elite')
where is_most_popular is distinct from (tier_type = 'CHALLENGE' and lower(trim(name)) = 'challenge elite');
