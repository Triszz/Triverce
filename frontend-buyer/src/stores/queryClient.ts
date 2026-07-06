import { QueryClient } from '@tanstack/react-query';

/**
 * Single QueryClient instance, used by `AppProviders` to wrap the app.
 * Reasonable defaults for a buyer storefront:
 *   • 1-minute stale time — product/category data can change but not by the minute.
 *   • 5-minute garbage-collection window.
 *   • On focus, refetch stale-but-not-inactive queries.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 0,
    },
  },
});
