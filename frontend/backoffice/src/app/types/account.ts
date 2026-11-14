// 계좌 리스트/상세 drawer에서 쓰는 화면용 계좌 타입

export type Account = {
  id: string;
  accountId?: string | null;
  mt4Login?: string | number | null;
  size: string;
  type: string;
  period: string;
  balance: string;
  profit: string;
  profitColor: string;
  status: string;
};
