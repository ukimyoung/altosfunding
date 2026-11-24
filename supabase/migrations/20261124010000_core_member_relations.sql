-- 회원 조직 관계: 추천인(sponsor)과 수당 조직 상위(placement parent)를 users 밖에서 따로 관리한다.
--
-- PRD(IB 차등 커미션) BR-05·BR-06
--   - sponsor_id           가입할 때 추천 코드로 정해지는 추천인. 추천인 통계·추천인 리워드가 쓴다.
--   - placement_parent_id  커미션을 계산할 때 따라 올라가는 직속 상위. 처음에는 추천인과 같게 넣고,
--                          관리자가 재배치하면 추천인과 달라질 수 있다.
--   - 회원마다 현재 관계 1행 (users에 행이 생기면 트리거가 빈 관계 행을 만든다).
--   - 모든 변경은 member_relation_history에 이전·새 값, 변경자, 사유와 함께 남긴다.
-- 기존 users.referrer_id 값은 sponsor_id·placement_parent_id로 옮기고 컬럼은 지운다.

create table core.member_relations (
  member_id            uuid primary key references core.users (id) on delete cascade,
  sponsor_id           uuid references core.users (id) on delete set null,
  placement_parent_id  uuid references core.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint member_relations_not_self_sponsor check (sponsor_id is distinct from member_id),
  constraint member_relations_not_self_placement check (placement_parent_id is distinct from member_id)
);

create index member_relations_sponsor_idx on core.member_relations (sponsor_id);
create index member_relations_placement_idx on core.member_relations (placement_parent_id);

create trigger member_relations_set_updated_at
  before update on core.member_relations
  for each row execute function core.set_updated_at();
alter table core.member_relations enable row level security;

create table core.member_relation_history (
  id                       bigint generated always as identity primary key,
  member_id                uuid not null references core.users (id) on delete cascade,
  change_type              text not null
                             check (change_type in ('MIGRATION', 'SIGNUP', 'SPONSOR_SET', 'SPONSOR_CHANGE', 'PLACEMENT_CHANGE')),
  old_sponsor_id           uuid references core.users (id) on delete set null,
  new_sponsor_id           uuid references core.users (id) on delete set null,
  old_placement_parent_id  uuid references core.users (id) on delete set null,
  new_placement_parent_id  uuid references core.users (id) on delete set null,
  reason                   text,
  actor_id                 uuid references core.users (id) on delete set null,   -- 관리자 (본인·시스템이면 null)
  created_at               timestamptz not null default now()
);

create index member_relation_history_member_idx on core.member_relation_history (member_id, created_at desc);
alter table core.member_relation_history enable row level security;

-- 회원이 생기면 빈 관계 행을 만든다 (가입 경로가 여러 개라 한곳에서 보장)
create or replace function core.create_member_relation() returns trigger
language plpgsql as $$
begin
  insert into core.member_relations (member_id) values (new.id) on conflict (member_id) do nothing;
  return new;
end $$;

create trigger users_create_member_relation
  after insert on core.users
  for each row execute function core.create_member_relation();

-- 기존 회원 옮기기
insert into core.member_relations (member_id, sponsor_id, placement_parent_id, created_at)
select id, referrer_id, referrer_id, created_at from core.users
on conflict (member_id) do nothing;

insert into core.member_relation_history (member_id, change_type, new_sponsor_id, new_placement_parent_id, reason)
select id, 'MIGRATION', referrer_id, referrer_id, 'users.referrer_id에서 이전'
from core.users where referrer_id is not null;

drop index if exists core.users_referrer_id_idx;
alter table core.users drop column referrer_id;
