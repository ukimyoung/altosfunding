import { useMutation, useQuery } from '@tanstack/react-query';
import {
  createManualEmailDraft,
  createManualEmailDraftWithCsv,
  exportManualEmailRecipients,
  getManualEmailJob,
  listManualEmailDrafts,
  searchManualEmailRecipients,
  searchManualEmailUnsubscribedRecipients,
  sendManualEmailDraft,
  updateManualEmailDraft,
  uploadManualEmailImage,
} from '@/api/manualEmail';
import type { ManualEmailDraftPayload, ManualEmailFilter } from '@/api/manualEmail';
import type { UseMutationResult } from '@tanstack/react-query';

export const manualEmailQueryKeys = {
  all: ['admin', 'notifications', 'manual-send'] as const,
  drafts: () => [...manualEmailQueryKeys.all, 'drafts'] as const,
  job: (jobId: string) => [...manualEmailQueryKeys.all, 'job', jobId] as const,
};

export function useSearchManualEmailRecipientsMutation() {
  return useMutation({
    mutationFn: (payload: ManualEmailFilter) => searchManualEmailRecipients(payload),
  });
}

export function useSearchManualEmailUnsubscribedRecipientsMutation() {
  return useMutation({
    mutationFn: (payload: ManualEmailFilter) => searchManualEmailUnsubscribedRecipients(payload),
  });
}

export function useExportManualEmailRecipientsMutation() {
  return useMutation({
    mutationFn: (params: ManualEmailFilter) => exportManualEmailRecipients(params),
  });
}

export function useCreateManualEmailDraftMutation() {
  return useMutation({
    mutationFn: (payload: ManualEmailDraftPayload) => createManualEmailDraft(payload),
  });
}

export function useManualEmailDraftsQuery(enabled = true) {
  return useQuery({
    queryKey: manualEmailQueryKeys.drafts(),
    queryFn: listManualEmailDrafts,
    enabled,
  });
}

export function useCreateManualEmailDraftWithCsvMutation() {
  return useMutation({
    mutationFn: ({ payload, file }: { payload: ManualEmailDraftPayload; file: File }) =>
      createManualEmailDraftWithCsv({ payload, file }),
  });
}

export function useUpdateManualEmailDraftMutation() {
  return useMutation({
    mutationFn: updateManualEmailDraft,
  });
}

export function useUploadManualEmailImageMutation(): UseMutationResult<
  string,
  Error,
  { file: Blob | File; draftId?: string | null }
> {
  return useMutation({
    mutationFn: uploadManualEmailImage,
  });
}

export function useSendManualEmailDraftMutation() {
  return useMutation({
    mutationFn: (draftId: string) => sendManualEmailDraft(draftId),
  });
}

export function useManualEmailJobQuery(jobId?: string | null, enabled = true) {
  const resolvedJobId = jobId ?? '';

  return useQuery({
    queryKey: manualEmailQueryKeys.job(resolvedJobId),
    queryFn: () => getManualEmailJob(resolvedJobId),
    enabled: enabled && Boolean(resolvedJobId),
  });
}
