import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createEventTemplate,
  getEventTemplateDetail,
  getNotificationLog,
  listEventTemplates,
  listEventTypes,
  listNotificationLogs,
  previewEventTemplate,
  updateEventTemplate,
} from '@/api/eventTemplate';
import type {
  CreateEventTemplatePayload,
  ListNotificationLogsParams,
  PreviewEventTemplatePayload,
  UpdateEventTemplatePayload,
} from '@/api/eventTemplate';

export const eventTemplatesQueryKeys = {
  all: ['admin', 'templates'] as const,
  list: () => [...eventTemplatesQueryKeys.all, 'list'] as const,
  eventTypes: () => [...eventTemplatesQueryKeys.all, 'event-types'] as const,
  detail: (templateId: string) => [...eventTemplatesQueryKeys.all, 'detail', templateId] as const,
  logs: (params: ListNotificationLogsParams) =>
    [...eventTemplatesQueryKeys.all, 'logs', params] as const,
  log: (logId: number) => [...eventTemplatesQueryKeys.all, 'log', logId] as const,
};

export function useListEventTemplatesQuery() {
  return useQuery({
    queryKey: eventTemplatesQueryKeys.list(),
    queryFn: listEventTemplates,
  });
}

export function useListEventTypesQuery(enabled = true) {
  return useQuery({
    queryKey: eventTemplatesQueryKeys.eventTypes(),
    queryFn: listEventTypes,
    enabled,
  });
}

export function useGetEventTemplateDetailQuery(templateId?: string | null) {
  const resolvedTemplateId = templateId ?? '';

  return useQuery({
    queryKey: eventTemplatesQueryKeys.detail(resolvedTemplateId),
    queryFn: () => getEventTemplateDetail(resolvedTemplateId),
    enabled: Boolean(resolvedTemplateId),
  });
}

export function useListNotificationLogsQuery(params: ListNotificationLogsParams, enabled = true) {
  return useQuery({
    queryKey: eventTemplatesQueryKeys.logs(params),
    queryFn: () => listNotificationLogs(params),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useGetNotificationLogQuery(logId: number | null) {
  return useQuery({
    queryKey: eventTemplatesQueryKeys.log(logId ?? 0),
    queryFn: () => getNotificationLog(logId as number),
    enabled: logId !== null,
  });
}

export function usePreviewEventTemplateMutation() {
  return useMutation({
    mutationFn: (payload: PreviewEventTemplatePayload) => previewEventTemplate(payload),
  });
}

export function useUpdateEventTemplateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      templateId,
      payload,
    }: {
      templateId: string;
      payload: UpdateEventTemplatePayload;
    }) => updateEventTemplate(templateId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: eventTemplatesQueryKeys.detail(variables.templateId),
      });
      queryClient.invalidateQueries({ queryKey: eventTemplatesQueryKeys.list() });
    },
  });
}

export function useCreateEventTemplateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateEventTemplatePayload) => createEventTemplate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventTemplatesQueryKeys.list() });
    },
  });
}
