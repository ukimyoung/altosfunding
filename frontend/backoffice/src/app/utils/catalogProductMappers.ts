import type { CatalogProduct } from '@/api/catalogProduct';
import type { ChallengeProduct, FundedProduct } from '@/app/types/product';
import type { LiveDemoProduct } from '@/app/components/products/LiveDemoProductModal';

export const getCatalogProductUpdateValue = <T>(
  value: T | null | '',
  previousValue: T | null | '',
): T | null | undefined => {
  if (value !== '' && value != null) return value;
  return previousValue !== '' && previousValue != null ? null : undefined;
};

const baseProductFields = (product: CatalogProduct) => ({
  id: product.product_id,
  amount: product.price_usdt,
  tier: 'STARTER' as const,
  leverage: product.leverage,
  balance: product.capital,
  tradingPeriod: product.duration_days,
  maxDrawdown: null,
  marginCall: product.margin_call_pct == null ? '' : String(product.margin_call_pct),
  stopOut: product.stop_out_pct == null ? '' : String(product.stop_out_pct),
  ruleset: product.ruleset_id ?? '',
  rulesetName: product.ruleset_name ?? '',
  mostPopular: false,
  status: product.is_active ? ('ACTIVE' as const) : ('SUSPENDED' as const),
  productName: product.name ?? '',
  mtsGroupId: product.mt4_group ?? '',
  capital: product.capital,
  accountRangeStart: product.mt4_login_pool_start,
  accountRangeEnd: product.mt4_login_pool_end,
});

export const mapCatalogProductToChallengeProduct = (
  product: CatalogProduct,
): ChallengeProduct => ({
  ...baseProductFields(product),
  discountAmount: product.discount_price_usdt ?? null,
  mostPopular: product.is_recommended ?? false,
  passConditionType: '-',
  passConditionValue: 0,
  drawdownMethod: '-',
  retryPolicy: '-',
  profitTarget: '-',
  dailyDrawdown: '-',
  creationDelayHours: product.funding_start_delay_hours,
  challengeNameTemplate: '-',
  seasonLabel: '-',
  scheduleStatus: '-',
  groupSize: 0,
  assignmentMethod: '-',
  intervalDays: 0,
  durationDays: 0,
  maxOccurrences: 0,
  startTime: '-',
  endTime: '-',
  excludeHoliday: false,
  totalGenerated: 0,
  lastGeneratedDate: '-',
});

export const mapCatalogProductToFundedProduct = (product: CatalogProduct): FundedProduct => ({
  ...baseProductFields(product),
  profitTarget: '-',
  dailyDrawdown: '-',
  maxDrawdownVip: null,
  creationDelayHours: product.funding_start_delay_hours,
});

export const mapCatalogProductToLiveDemoProduct = (
  product: CatalogProduct,
): LiveDemoProduct => ({
  id: product.product_id,
  productName: product.name ?? '',
  amount: product.price_usdt,
  mtsGroupId: product.mt4_group ?? '',
  capital: product.capital,
  leverage: product.leverage,
  tradingPeriod: product.duration_days,
  marginCall: product.margin_call_pct,
  stopOut: product.stop_out_pct,
  accountRangeStart: product.mt4_login_pool_start,
  accountRangeEnd: product.mt4_login_pool_end,
  ruleset: product.ruleset_id ?? '',
  rulesetName: product.ruleset_name ?? '',
  status: product.is_active ? ('ACTIVE' as const) : ('SUSPENDED' as const),
});
