import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { activateUser, banUser, createUser, getUserDetail, getUserPartnerStats, getUserSummary, listUsers, suspendUser, updateUser, withdrawUser } from '@/api/user';
import type { BanUserRequest, CreateUserRequest, ListUsersParams, PartnerStatsParams, SuspendUserRequest, UpdateUserRequest } from '@/api/user';

export const usersQueryKeys = {
  all: ['admin', 'users'] as const,
  listUsers: (params: ListUsersParams) => [...usersQueryKeys.all, 'ListUsers', params] as const,
  getUserSummary: () => [...usersQueryKeys.all, 'GetUserSummary'] as const,
  getUserDetail: (userId: string) => [...usersQueryKeys.all, 'GetUserDetail', userId] as const,
  getPartnerStats: (userId: string, params: PartnerStatsParams) =>
    [...usersQueryKeys.all, 'GetPartnerStats', userId, params] as const,
};

export function useListUsersQuery(params: ListUsersParams) {
  return useQuery({
    queryKey: usersQueryKeys.listUsers(params),
    queryFn: () => listUsers(params),
    placeholderData: keepPreviousData,
  });
}

export function useUserSummaryQuery() {
  return useQuery({
    queryKey: usersQueryKeys.getUserSummary(),
    queryFn: getUserSummary,
  });
}

export function useGetUserDetailQuery(userId?: string) {
  return useQuery({
    queryKey: usersQueryKeys.getUserDetail(userId ?? ''),
    queryFn: () => getUserDetail(userId ?? ''),
    enabled: Boolean(userId),
  });
}

export function useGetUserPartnerStatsQuery(
  userId: string | undefined,
  params: PartnerStatsParams,
  enabled = true,
) {
  return useQuery({
    queryKey: usersQueryKeys.getPartnerStats(userId ?? '', params),
    queryFn: () => getUserPartnerStats(userId ?? '', params),
    enabled: enabled && Boolean(userId),
    placeholderData: keepPreviousData,
  });
}

export function useCreateUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateUserRequest) => createUser(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersQueryKeys.all });
    },
  });
}

export function useUpdateUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: UpdateUserRequest }) =>
      updateUser(userId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersQueryKeys.all });
    },
  });
}

export function useSuspendUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: SuspendUserRequest }) =>
      suspendUser(userId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersQueryKeys.all });
    },
  });
}

export function useBanUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: BanUserRequest }) =>
      banUser(userId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersQueryKeys.all });
    },
  });
}

export function useWithdrawUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => withdrawUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersQueryKeys.all });
    },
  });
}

export function useActivateUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => activateUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersQueryKeys.all });
    },
  });
}
