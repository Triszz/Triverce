import { QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { queryClient } from '@/stores/queryClient';

/**
 * Wraps the React tree with the shared QueryClient.
 * Keep this provider-ordered above any component that uses TanStack Query
 * (services, hooks, page components).
 */
export function AppProviders({ children }: PropsWithChildren) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
