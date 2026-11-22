import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getDashboardSummary, getDashboardTrends } from '@/api/dashboard';
import type { DashboardRange, DashboardTrendParams } from '@/api/dashboard';

export const dashboardQueryKeys = {
  all: ['admin', 'dashboard'] as const,
  summary: (range: DashboardRange) => [...dashboardQueryKeys.all, 'summary', range] as const,
  trends: (params: DashboardTrendParams) => [...dashboardQueryKeys.all, 'trends', params] as const,
};

// 처리 대기 건수·시스템 상태가 들어 있어 화면이 보이는 동안 1분마다 다시 읽는다 (창이 가려지면 멈춤).
export function useDashboardSummaryQuery(range: DashboardRange) {
  return useQuery({
    queryKey: dashboardQueryKeys.summary(range),
    queryFn: () => getDashboardSummary(range),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
}

export function useDashboardTrendsQuery(params: DashboardTrendParams) {
  return useQuery({
    queryKey: dashboardQueryKeys.trends(params),
    queryFn: () => getDashboardTrends(params),
    placeholderData: keepPreviousData,
  });
}
