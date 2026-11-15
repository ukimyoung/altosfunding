import api from './axios';

export interface Product {
  status: string;
  challenge_id: string;
  challenge_name: string;
  product_id: string;
  description: string;
  price_usdt: number;
  capital: number;
  is_recommended: boolean;
  current_participants: number;
  group_size: number;
  start_at: string;
}

export interface ListProductsResponse {
  challenges: Product[];
  total_active_accounts: number;
}

export const listProducts = async () => {
  const response = await api.get<ListProductsResponse>('/v1/challenges/summary');

  return response.data;
};

/** 룰셋 조건. 금액(_amt)은 상품 자본금 기준으로 서버가 계산한다. */
export interface ChallengeOfferRules {
  ruleset_id: string;
  ruleset_name: string;
  profit_target_pct: number | null;
  profit_target_amt: number | null;
  max_drawdown_pct: number;
  max_drawdown_amt: number;
  daily_loss_limit_pct: number;
  daily_loss_limit_amt: number;
  dd_calc_method: 'STATIC' | 'EOD' | 'INTRADAY' | string;
  min_trading_days: number;
  pass_condition_type: 'RELATIVE' | 'ABSOLUTE' | string;
  pass_condition_pct: number | null;
  pass_condition_amt: number | null;
}

export interface ChallengeOfferFunded {
  product_id: string;
  name: string;
  capital: number;
  leverage: number;
  payout_ratio: number;
  rules: ChallengeOfferRules | null;
}

export interface ChallengeOfferRound {
  challenge_id: string;
  challenge_name: string;
  start_at: string;
  end_at: string;
  current_participants: number;
  group_size: number;
}

/** Start New Challenge 카드 한 장 = 판매 중인 챌린지 상품 하나 */
export interface ChallengeOffer {
  product_id: string;
  name: string;
  description: string | null;
  capital: number;
  price_usdt: number;
  /** null이면 할인 없음 */
  discount_price_usdt: number | null;
  /** 실제 결제 금액 (할인가격이 있으면 할인가격) */
  final_price_usdt: number;
  is_recommended: boolean;
  leverage: number;
  duration_days: number;
  rules: ChallengeOfferRules | null;
  funded: ChallengeOfferFunded | null;
  /** 지금 신청할 수 있는 모집 중 회차. null이면 선택할 수 없다. */
  open_challenge: ChallengeOfferRound | null;
}

export interface ListChallengeOffersResponse {
  items: ChallengeOffer[];
}

export const listChallengeOffers = async () => {
  const response = await api.get<ListChallengeOffersResponse>('/v1/challenges/products');

  return response.data;
};
