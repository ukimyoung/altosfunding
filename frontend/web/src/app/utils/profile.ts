import type { MeResponse } from '@/api/user';

export const hasRequiredProfileName = (me?: MeResponse | null) =>
  Boolean(me?.first_name?.trim() && me?.last_name?.trim());
