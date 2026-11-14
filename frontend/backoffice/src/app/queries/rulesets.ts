import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createRuleset, getRulesetDetail, listRulesets, updateRuleset } from '@/api/ruleset';
import type { ListRulesetsParams, UpsertRulesetPayload } from '@/api/ruleset';

export const rulesetsQueryKeys = {
  all: ['admin', 'rulesets'] as const,
  listRulesets: (params: ListRulesetsParams) =>
    [...rulesetsQueryKeys.all, 'ListRulesets', params] as const,
  listRulesetsRoot: () => [...rulesetsQueryKeys.all, 'ListRulesets'] as const,
  getRulesetDetail: (rulesetId: string) =>
    [...rulesetsQueryKeys.all, 'GetRulesetDetail', rulesetId] as const,
};

export function useListRulesetsQuery(
  params: ListRulesetsParams = {},
  enabled = true,
) {
  return useQuery({
    queryKey: rulesetsQueryKeys.listRulesets(params),
    queryFn: () => listRulesets(params),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useGetRulesetDetailQuery(rulesetId?: string | null, enabled = true) {
  const resolvedRulesetId = rulesetId ?? '';

  return useQuery({
    queryKey: rulesetsQueryKeys.getRulesetDetail(resolvedRulesetId),
    queryFn: () => getRulesetDetail(resolvedRulesetId),
    enabled: enabled && Boolean(resolvedRulesetId),
  });
}

export function useCreateRulesetMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpsertRulesetPayload) => createRuleset(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: rulesetsQueryKeys.listRulesetsRoot() });
    },
  });
}

export function useUpdateRulesetMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpsertRulesetPayload) => updateRuleset(payload),
    onSuccess: (ruleset) => {
      void queryClient.invalidateQueries({ queryKey: rulesetsQueryKeys.listRulesetsRoot() });
      void queryClient.invalidateQueries({
        queryKey: rulesetsQueryKeys.getRulesetDetail(ruleset.id),
      });
    },
  });
}
