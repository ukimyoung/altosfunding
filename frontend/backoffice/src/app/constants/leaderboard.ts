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
} as const;

export function getLeaderboardTierConfig(productName: string) {
  if (productName.includes('500')) {
    return LEADERBOARD_TIER_CONFIG['500'];
  }
  if (productName.includes('300')) {
    return LEADERBOARD_TIER_CONFIG['300'];
  }

  return LEADERBOARD_TIER_CONFIG['100'];
}

export const STATUS_CONFIG = {
  ACTIVE: { label: "ACTIVE", icon: "▶", bg: "rgba(22,163,74,0.1)", color: "#16A34A", border: "rgba(22,163,74,0.2)" },
  CLOSED: { label: "CLOSED", icon: "■", bg: "rgba(113,113,122,0.1)", color: "#71717A", border: "rgba(113,113,122,0.2)" },
} as const;

export const PROMOTION_TOP_PERCENT = 10;
export const VIP_SLOT_LIMIT = 5;
