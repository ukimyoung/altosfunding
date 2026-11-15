-- 회원 상태 변경 이력 (정지·영구정지·활성화·탈퇴). 백오피스 회원 상세의 "상태 변경 이력"에 쓴다.
create table core.user_status_history (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references core.users (id) on delete cascade,
  from_status text not null,
  to_status   text not null,
  reason      text,
  -- 변경한 사람 (관리자 또는 본인). 탈퇴 등으로 지워져도 이력은 남긴다.
  changed_by  uuid references core.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index user_status_history_user_idx on core.user_status_history (user_id, created_at desc);

alter table core.user_status_history enable row level security;

-- 등급은 NORMAL / VIP 두 가지만 쓴다.
alter table core.users
  add constraint users_grade_check check (grade in ('NORMAL', 'VIP'));
