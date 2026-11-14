export type DispatchTiming = 'immediate' | 'scheduled';
export type DispatchTargetType = 'all' | 'manual';
export type DispatchSearchState = 'idle' | 'results' | 'empty';
export type DispatchVipFilter = '전체' | '일반' | 'VIP';

export interface DispatchVariable {
  label: string;
  token: string;
}

export interface DispatchSearchRow {
  name: string;
  email: string;
  accounts: number;
  joinDate: string;
  type: string;
  unsubscribed: boolean;
}
