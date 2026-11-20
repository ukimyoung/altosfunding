import type { ChallengeRevenueColumn, FundedRevenueDailyRow, RevenuePeriod } from "../types/revenue";

export const REVENUE_PAGE_SIZE = 10;

/** Core 상품 목록을 못 불러왔을 때만 쓰는 디자인 기본 열 (Make 1114) */
export const CHALLENGE_REVENUE_FALLBACK_COLUMNS: ChallengeRevenueColumn[] = [
  { product_id: "starter", label: "Starter", price_usdt: 100 },
  { product_id: "professional", label: "Professional", price_usdt: 300 },
  { product_id: "elite", label: "Elite", price_usdt: 500 },
  { product_id: "prime", label: "Prime", price_usdt: 1000 },
];

export const REVENUE_PERIODS: RevenuePeriod[] = ["주별", "월별", "연별"];

export const REVENUE_KNOWN_USERS = [
  "john", "john.doe", "john.doe@email.com",
  "jane", "jane.smith", "jane.smith@email.com",
  "mike", "mike.johnson", "mike.johnson@email.com",
  "sarah", "sarah.lee", "sarah.lee@email.com",
  "chris", "chris.park", "chris.park@email.com",
  "emma", "emma.wilson", "emma.wilson@email.com",
];

export const FUNDED_REVENUE_SAMPLE_DATA: FundedRevenueDailyRow[] = [
  { date: "2026-05-02", reqCount: 3,  reqAmt: 12000,  traderAmt: 9600,  companyAmt: 2400  },
  { date: "2026-05-08", reqCount: 5,  reqAmt: 28500,  traderAmt: 22800, companyAmt: 5700  },
  { date: "2026-05-15", reqCount: 2,  reqAmt: 8000,   traderAmt: 6400,  companyAmt: 1600  },
  { date: "2026-05-22", reqCount: 7,  reqAmt: 41200,  traderAmt: 32960, companyAmt: 8240  },
  { date: "2026-06-01", reqCount: 4,  reqAmt: 19800,  traderAmt: 15840, companyAmt: 3960  },
  { date: "2026-06-05", reqCount: 6,  reqAmt: 33500,  traderAmt: 26800, companyAmt: 6700  },
  { date: "2026-06-12", reqCount: 3,  reqAmt: 14200,  traderAmt: 11360, companyAmt: 2840  },
  { date: "2026-06-18", reqCount: 8,  reqAmt: 52000,  traderAmt: 41600, companyAmt: 10400 },
  { date: "2026-06-25", reqCount: 5,  reqAmt: 27300,  traderAmt: 21840, companyAmt: 5460  },
  { date: "2026-07-02", reqCount: 4,  reqAmt: 22100,  traderAmt: 17680, companyAmt: 4420  },
  { date: "2026-07-09", reqCount: 9,  reqAmt: 61500,  traderAmt: 49200, companyAmt: 12300 },
  { date: "2026-07-13", reqCount: 3,  reqAmt: 15800,  traderAmt: 12640, companyAmt: 3160  },
];
