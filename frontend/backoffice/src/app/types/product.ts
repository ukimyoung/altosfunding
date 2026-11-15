// 챌린지/펀디드 상품 화면과 모달에서 쓰는 화면용 상품 타입

export interface ChallengeProduct {
  id: string;
  amount: number | null;
  // 할인가격. null이면 할인 없이 원가격(amount)으로 판매
  discountAmount?: number | null;
  tier: 'STARTER' | 'PROFESSIONAL' | 'ELITE';
  leverage: number | null;
  balance: number | null;
  tradingPeriod: number | null;
  passConditionType: string;
  passConditionValue: number;
  maxDrawdown: number | null;
  marginCall?: string;
  stopOut: string;
  drawdownMethod: string;
  retryPolicy: string;
  ruleset?: string;
  rulesetName?: string;
  mostPopular: boolean;
  status: 'ACTIVE' | 'SUSPENDED';
  productName: string;
  mtsGroupId: string;
  capital: number | null;
  accountRangeStart: number | null;
  accountRangeEnd: number | null;
  profitTarget: string;
  dailyDrawdown: string;
  creationDelayHours?: number | null;
  challengeNameTemplate: string;
  seasonLabel: string;
  scheduleStatus: string;
  groupSize: number;
  assignmentMethod: string;
  intervalDays: number;
  durationDays: number;
  maxOccurrences: number;
  startTime: string;
  endTime: string;
  excludeHoliday: boolean;
  totalGenerated: number;
  lastGeneratedDate: string;
}

export interface FundedProduct {
  id: string;
  amount: number | null;
  tier: 'STARTER' | 'PROFESSIONAL' | 'ELITE';
  leverage: number | null;
  balance: number | null;
  tradingPeriod: number | null;
  profitTarget: string;
  dailyDrawdown: string;
  maxDrawdown: number | null;
  maxDrawdownVip?: number | null;
  marginCall?: string;
  stopOut: string;
  ruleset?: string;
  rulesetName?: string;
  mostPopular: boolean;
  status: 'ACTIVE' | 'SUSPENDED';
  productName: string;
  mtsGroupId: string;
  capital: number | null;
  accountRangeStart: number | null;
  accountRangeEnd: number | null;
  creationDelayHours: number | null;
}
