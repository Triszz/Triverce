import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Re-fetch when the user comes back to a tab — keeps dashboard
      // stats fresh without polling.
      refetchOnWindowFocus: true,
      retry: 1,
      staleTime: 30_000,
    },
    mutations: {
      retry: 0,
    },
  },
});
