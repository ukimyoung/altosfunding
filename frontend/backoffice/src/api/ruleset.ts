import api from './axios';

export type RulesetDrawdownMethod = 'STATIC' | 'EOD' | 'INTRADAY';
export type RulesetRetryPolicy = 'NONE' | 'ONCE' | 'UNLIMITED' | 'FORBIDDEN';

export interface AdminRuleset {
  id: string;
  name: string;
  daily_loss_limit_pct: number;
  max_dd_normal_pct: number;
  max_dd_normal_amt: number | null;
  max_dd_vip_pct: number;
  max_dd_vip_amt: number | null;
  max_dd_lookback_days: number;
  dd_calc_method: RulesetDrawdownMethod;
  stop_out_pct: number | null;
  profit_target_pct: number | null;
  min_trading_days: number;
  inactivity_days: number;
  connected_products_count: number;
  retry_policy: RulesetRetryPolicy;
  pass_condition_type: string;
  pass_condition_pct: number | null;
  pass_condition_amt: number | null;
  pass_condition_vip_type: string;
  pass_condition_vip_pct: number | null;
  pass_condition_vip_amt: number | null;
  is_most_popular: boolean;
  apply_scope: string;
}

export interface RulesetDetailResponse extends AdminRuleset {}

export interface RulesetRequestBody {
  name: string;
  daily_loss_limit_pct: number;
  max_dd_normal_pct: number;
  dd_calc_method: RulesetDrawdownMethod;
  pass_condition_type: string;
  pass_condition_pct?: number;
  pass_condition_amt?: number;
  pass_condition_vip_type: string;
  pass_condition_vip_pct?: number;
  pass_condition_vip_amt?: number;
  profit_target_pct: number;
  min_trading_days: number;
  inactivity_days: number;
  retry_policy: RulesetRetryPolicy;
  is_most_popular: boolean;
  apply_scope: string;
}

export type CreateRulesetRequest = RulesetRequestBody;
export type UpdateRulesetRequest = RulesetRequestBody;

export interface ListRulesetsParams {
  page?: number;
  size?: number;
}

export interface ListRulesetsResponse {
  items: AdminRuleset[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export type UpsertRulesetPayload = RulesetRequestBody & {
  id?: string;
};

export const listRulesets = async (
  params: ListRulesetsParams = {},
): Promise<ListRulesetsResponse> => {
  const page = params.page ?? 1;
  const size = params.size ?? 20;
  const response = await api.get<ListRulesetsResponse>('/v1/admin/rulesets', {
    params: { ...params, page, size },
  });

  return response.data;
};

export const getRulesetDetail = async (rulesetId: string): Promise<RulesetDetailResponse> => {
  const response = await api.get<RulesetDetailResponse>(`/v1/admin/rulesets/${rulesetId}`);
  return response.data;
};

export const createRuleset = async (
  payload: UpsertRulesetPayload,
): Promise<AdminRuleset> => {
  const { id: _id, ...requestBody } = payload;
  const endpoint = '/v1/admin/rulesets';

  const response = await api.post<AdminRuleset>(endpoint, requestBody);
  return response.data;
};

export const updateRuleset = async (
  payload: UpsertRulesetPayload,
): Promise<AdminRuleset> => {
  const { id, ...requestBody } = payload;
  const endpoint = `/v1/admin/rulesets/${id ?? ''}`;

  const response = await api.patch<AdminRuleset>(endpoint, requestBody);
  return response.data;
};
