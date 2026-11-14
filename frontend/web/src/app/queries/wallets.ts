import { useQuery } from '@tanstack/react-query';
import {
  listWalletNetworks,
  listWalletTransactions,
  type ListWalletTransactionsParams,
} from '@/api/wallets';

export const walletsQueryKeys = {
  all: ['wallets'] as const,
  networks: () => [...walletsQueryKeys.all, 'networks'] as const,
  transactions: (params: ListWalletTransactionsParams) =>
    [...walletsQueryKeys.all, 'transactions', params] as const,
};

export function useWalletNetworksQuery(enabled = true) {
  return useQuery({
    queryKey: walletsQueryKeys.networks(),
    queryFn: listWalletNetworks,
    enabled,
    retry: false,
  });
}

export function useWalletTransactionsQuery(params: ListWalletTransactionsParams) {
  return useQuery({
    queryKey: walletsQueryKeys.transactions(params),
    queryFn: () => listWalletTransactions(params),
    retry: false,
  });
}
