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
    retry: false,
  });

export const useCreateDemoAccountMutation = () =>
  useMutation({
    mutationFn: (payload: CreateDemoAccountRequest) => createDemoAccount(payload),
  });
