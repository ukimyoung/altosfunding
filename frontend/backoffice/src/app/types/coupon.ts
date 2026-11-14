export type CouponProduct = "Starter" | "Professional" | "Elite";
export type CouponStatus = "활성" | "비활성" | "기간만료" | "소진됨";

export interface Member {
  id: string;
  name: string;
  email: string;
}

export interface UsageEntry {
  id?: number;
  userName: string;
  userEmail: string;
  discountApplied: number;
  datetime: string;
  orderNo: string;
  originalAmountUsd: number;
  discountAmountUsd?: number;
  finalAmountUsd?: number;
}

export interface Coupon {
  id: string;
  code: string;
  name: string;
  partnerId: string;
  partnerEmail?: string | null;
  partnerName?: string | null;
  discountValue: number;
  commissionRate: number;
  scopeAll: boolean;
  scopeProducts: CouponProduct[];
  maxUses: number;
  usedCount?: number;
  perUserLimit: "once" | "unlimited";
  startDate: string;
  endDate: string;
  status: "active" | "inactive";
  displayStatus?: CouponStatus;
  usageHistory: UsageEntry[];
}
