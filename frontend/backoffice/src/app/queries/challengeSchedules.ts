import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createHoliday,
  createSchedule,
  deleteHoliday,
  listHolidays,
  listSchedules,
  pauseSchedule,
  triggerSchedule,
  updateHoliday,
  updateSchedule,
} from '@/api/challengeSchedule';
import type { ScheduleInput } from '@/api/challengeSchedule';
import { challengeQueryKeys } from './challenges';

export const scheduleQueryKeys = {
  all: ['admin', 'challenge-schedules'] as const,
  list: () => [...scheduleQueryKeys.all, 'list'] as const,
  holidays: (year: number) => [...scheduleQueryKeys.all, 'holidays', year] as const,
};

export function useSchedulesQuery() {
  return useQuery({
    queryKey: scheduleQueryKeys.list(),
    queryFn: listSchedules,
  });
}

export function useHolidaysQuery(year: number) {
  return useQuery({
    queryKey: scheduleQueryKeys.holidays(year),
    queryFn: () => listHolidays(year),
  });
}

// 스케줄이나 휴장일이 바뀌면 대회 목록도 다시 불러온다.
function useInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: scheduleQueryKeys.all });
    void queryClient.invalidateQueries({ queryKey: challengeQueryKeys.all });
  };
}

export function useSaveScheduleMutation() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number | null; payload: ScheduleInput }) =>
      id == null ? createSchedule(payload) : updateSchedule(id, payload),
    onSuccess: invalidate,
  });
}

export function useSetScheduleActiveMutation() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      active ? updateSchedule(id, { status: 'ACTIVE' }) : pauseSchedule(id),
    onSuccess: invalidate,
  });
}

export function useTriggerScheduleMutation() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: number) => triggerSchedule(id),
    onSuccess: invalidate,
  });
}

export function useCreateHolidayMutation() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (payload: { date: string; name: string }) => createHoliday(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateHolidayMutation() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: number; name?: string; is_active?: boolean }) =>
      updateHoliday(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteHolidayMutation() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: number) => deleteHoliday(id),
    onSuccess: invalidate,
  });
}
