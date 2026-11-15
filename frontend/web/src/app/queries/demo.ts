import { useMutation, useQuery } from '@tanstack/react-query';
import {
  createDemoAccount,
  getDemoOptions,
  type CreateDemoAccountRequest,
} from '@/api/demo';

export const demoQueryKeys = {
  all: ['demo'] as const,
  options: () => [...demoQueryKeys.all, 'options'] as const,
};

export const useDemoOptionsQuery = (enabled: boolean) =>
  useQuery({
    queryKey: demoQueryKeys.options(),
    queryFn: getDemoOptions,
    enabled,
    // 백오피스에서 선택지를 바꾸면 팝업을 다시 열 때 바로 보이도록 매번 새로 받는다.
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  });

export const useCreateDemoAccountMutation = () =>
  useMutation({
    mutationFn: (payload: CreateDemoAccountRequest) => createDemoAccount(payload),
  });
