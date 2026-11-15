-- 상품 ID를 4자리 숫자 상품코드로 바꾼다. (예: 1001)
-- 앞 1자리는 티어: 1 = 챌린지, 2 = 펀디드, 3 = 데모, 4 = 라이브
-- 뒤 3자리는 티어별 일련번호(001~999). 새 상품코드는 Core가 만든다.
-- 기존 'CHALLENGE_10K' 같은 값은 티어별로 만든 순서대로 새 코드로 바꾼다.
-- 상품을 참조하는 컬럼(챌린지 회차·자동 생성 스케줄·다음 단계 상품)도 함께 바뀌도록 ON UPDATE CASCADE로 다시 건다.

alter table core.challenge_schedules drop constraint challenge_schedules_product_id_fkey;
alter table core.challenge_schedules
  add constraint challenge_schedules_product_id_fkey
  foreign key (product_id) references core.products (id) on update cascade;

alter table core.challenges drop constraint challenges_product_id_fkey;
alter table core.challenges
  add constraint challenges_product_id_fkey
  foreign key (product_id) references core.products (id) on update cascade;

alter table core.products drop constraint products_next_product_id_fkey;
alter table core.products
  add constraint products_next_product_id_fkey
  foreign key (next_product_id) references core.products (id) on update cascade on delete set null;

-- 새 코드가 기존 값과 겹치지 않도록 임시 값으로 한 번 옮긴 뒤 최종 코드로 바꾼다.
create temporary table product_code_map as
select
  id as old_id,
  (case tier_type when 'CHALLENGE' then 1 when 'FUNDED' then 2 when 'DEMO' then 3 else 4 end)::text
    || lpad(row_number() over (partition by tier_type order by created_at, id)::text, 3, '0') as new_id
from core.products;

update core.products p
set id = '__tmp__' || m.new_id
from product_code_map m
where p.id = m.old_id;

update core.products
set id = substr(id, 8)
where id like '\_\_tmp\_\_%';

drop table product_code_map;

alter table core.products
  add constraint products_id_code_check check (
    id ~ '^[1-4][0-9]{3}$'
    and left(id, 1) = case tier_type when 'CHALLENGE' then '1' when 'FUNDED' then '2' when 'DEMO' then '3' else '4' end
  );

comment on column core.products.id is '상품코드 4자리. 앞자리 티어(1 챌린지, 2 펀디드, 3 데모, 4 라이브) + 일련번호 3자리';
