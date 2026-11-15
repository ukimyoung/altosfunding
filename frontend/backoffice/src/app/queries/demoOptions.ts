import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getDemoOptionsConfig, updateDemoConfig } from '@/api/demoOptions';
import type { DemoConfigKey } from '@/api/demoOptions';

export const demoOptionsQueryKeys = {
  all: ['admin', 'demo-options'] as const,
};

export function useDemoOptionsConfigQuery() {
  return useQuery({
    queryKey: demoOptionsQueryKeys.all,
    queryFn: getDemoOptionsConfig,
  });
}

// 선택지 목록과 기본값을 한 번에 바꿀 때도 있어 여러 키를 순서대로 저장한다.
export function useUpdateDemoConfigMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (changes: { key: DemoConfigKey; value: number | number[] }[]) => {
      for (const change of changes) {
        await updateDemoConfig(change.key, change.value);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: demoOptionsQueryKeys.all });
    },
  });
}
