import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getEventTemplateDetail,
  listEventTemplates,
  listEventTypes,
  listNotificationLogs,
  previewEventTemplate,
  updateEventTemplate,
} from '@/api/eventTemplate';
import type {
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
    },
  });
}
