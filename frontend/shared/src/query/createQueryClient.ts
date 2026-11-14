import { QueryClient } from '@tanstack/react-query';

// web과 backoffice가 같은 기본값을 쓴다.
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
        staleTime: 0,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
