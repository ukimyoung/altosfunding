-- 챌린지 상품: 펀디드 계좌 발급 방법 (2026-11-23 사용자 요청)
-- AUTO   = 합격 후 대회 종료 + funding_start_delay_hours 에 자동 발급 (기존 동작)
-- MANUAL = 수동 발급 (백오피스 화면에서 선택만 저장. 자동 발급을 멈추는 동작은 아직 없음)

alter table core.products
  add column funded_issue_method text not null default 'AUTO'
    check (funded_issue_method in ('AUTO', 'MANUAL'));

comment on column core.products.funded_issue_method is
  '챌린지 상품: 펀디드 계좌 발급 방법. AUTO(자동, 기본) | MANUAL(수동)';
