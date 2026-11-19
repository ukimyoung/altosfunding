export const LEADERBOARD_TIER_CONFIG = {
  "100": {
    label: "$100 Starter",
    bg: "rgba(22,163,74,0.1)",
    color: "#16A34A",
    border: "rgba(22,163,74,0.2)"
  },
  "300": {
    label: "$300 Professional",
    bg: "rgba(124,106,247,0.12)",
    color: "#7C6AF7",
    border: "rgba(124,106,247,0.2)"
  },
  "500": {
    label: "$500 Elite",
    bg: "rgba(217,119,6,0.1)",
    color: "#D97706",
    border: "rgba(217,119,6,0.2)"
  },
  "prime": {
    label: "Prime",
    bg: "rgba(37,99,235,0.1)",
    color: "#2563EB",
    border: "rgba(37,99,235,0.2)"
  },
} as const;

/** 상품명(예: 'Challenge Elite')의 티어 이름이나 금액으로 뱃지 색을 고른다. */
export function getLeaderboardTierConfig(productName: string) {
  const name = productName.toLowerCase();
  if (name.includes('prime')) {
    return LEADERBOARD_TIER_CONFIG.prime;
  }
  if (name.includes('elite') || name.includes('500')) {
    return LEADERBOARD_TIER_CONFIG['500'];
  }
  if (name.includes('professional') || name.includes('300')) {
    return LEADERBOARD_TIER_CONFIG['300'];
  }

  return LEADERBOARD_TIER_CONFIG['100'];
}

/** 상품명에서 'Challenge ' 접두어를 떼어 티어 이름으로 보여 준다 (대회 목록과 같은 규칙). */
export function toLeaderboardTierLabel(productName: string) {
  return productName.replace(/^Challenge\s+/i, '') || productName;
}

export const STATUS_CONFIG = {
  ACTIVE: { label: "ACTIVE", icon: "▶", bg: "rgba(22,163,74,0.1)", color: "#16A34A", border: "rgba(22,163,74,0.2)" },
  CLOSED: { label: "CLOSED", icon: "■", bg: "rgba(113,113,122,0.1)", color: "#71717A", border: "rgba(113,113,122,0.2)" },
} as const;

export const PROMOTION_TOP_PERCENT = 10;
export const VIP_SLOT_LIMIT = 5;
