-- 리워드 정책 (백오피스 '운영 관리 > 리워드/레퍼럴 관리 > 리워드 정책 설정').
-- 기존 서버와 같이 core.platform_config의 REWARD scope에 키 3개로 둔다.
--   referral_reward_amount    추천인 리워드 지급액 (USD, 숫자)
--   referral_reward_condition 지급 조건: FIRST_PURCHASE(피추천인 첫 챌린지 구매 시) | FUNDED_UPGRADE(피추천인 펀디드 승급 시)
--   trading_bonus_rate        트레이딩 보너스 추가율 (회사 몫에서 더 주는 비율, 0.01 = 1%p)
-- 이미 값이 있으면 그대로 둔다.
insert into core.platform_config (scope, key, value, description) values
  ('REWARD', 'referral_reward_amount', '40', '추천인 리워드 지급액 (USD)'),
  ('REWARD', 'referral_reward_condition', '"FIRST_PURCHASE"', '추천인 리워드 지급 조건 (FIRST_PURCHASE | FUNDED_UPGRADE)'),
  ('REWARD', 'trading_bonus_rate', '0.01', '트레이딩 보너스 추가율 (0.01 = 1%p)')
on conflict (scope, key) do nothing;
