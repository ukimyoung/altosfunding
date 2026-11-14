import type { Coupon, CouponStatus, Member } from "../types/coupon";
import type { AdminCoupon, CouponUsage } from "../../api/coupon";
import type { UsageEntry } from "../types/coupon";

function today() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function computeCouponStatus(coupon: Coupon): CouponStatus {
  if (coupon.displayStatus) return coupon.displayStatus;
  if (coupon.status === "inactive") return "비활성";
  if (coupon.endDate < today()) return "기간만료";
  return "활성";
}

export function formatDateKST(isoString: string) {
  const date = new Date(isoString);
  const kst = new Date(date.getTime() + 9 * 3600 * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())} ${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())} (GMT+9)`;
}

export function generateCouponCode(member: Member | null) {
  const base = member
    ? member.name.replace(/\s+/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10)
    : "COUPON";
  const randomSuffix = String(Math.floor(Math.random() * 90) + 10);
  return base + randomSuffix;
}

export function avatarChar(name: string) {
  return name.trim()[0]?.toUpperCase() ?? "?";
}

function formatCouponDate(value: string | null) {
  return value ? value.slice(0, 10) : "—";
}

export function mapAdminCoupon(coupon: AdminCoupon): Coupon {
  const applicableProducts = coupon.applicable_tiers.flatMap((tier) => {
    const normalizedTier = tier.toUpperCase();
    if (normalizedTier === "STARTER") return ["Starter" as const];
    if (normalizedTier === "PROFESSIONAL") return ["Professional" as const];
    if (normalizedTier === "ELITE") return ["Elite" as const];
    return [];
  });

  return {
    id: String(coupon.id),
    code: coupon.code,
    name: coupon.name,
    partnerId: coupon.partner_id ?? "",
    partnerEmail: coupon.partner_email,
    partnerName: coupon.partner_name,
    discountValue: Number((coupon.discount_rate * 100).toFixed(2)),
    commissionRate: Number((coupon.commission_rate * 100).toFixed(2)),
    scopeAll: coupon.applicable_tiers.length === 0,
    scopeProducts: applicableProducts,
    maxUses: coupon.max_uses,
    usedCount: coupon.used_count,
    perUserLimit: "once",
    startDate: formatCouponDate(coupon.valid_from),
    endDate: formatCouponDate(coupon.valid_until),
    status: coupon.is_active ? "active" : "inactive",
    displayStatus: ({
      ACTIVE: "활성",
      INACTIVE: "비활성",
      EXPIRED: "기간만료",
      EXHAUSTED: "소진됨",
    } as Record<string, CouponStatus>)[coupon.status],
    usageHistory: [],
  };
}

export function mapCouponUsage(usage: CouponUsage): UsageEntry {
  const originalAmount = Number(usage.original_amount);
  const discountAmount = Number(usage.discount_amount);

  return {
    id: usage.id,
    userName: usage.user_name,
    userEmail: usage.user_email,
    discountApplied: originalAmount > 0
      ? Number(((discountAmount / originalAmount) * 100).toFixed(2))
      : 0,
    datetime: usage.used_at,
    orderNo: usage.order_id,
    originalAmountUsd: originalAmount,
    discountAmountUsd: discountAmount,
    finalAmountUsd: Number(usage.final_amount),
  };
}
