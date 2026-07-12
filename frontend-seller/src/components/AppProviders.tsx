import { QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { queryClient } from '@/stores/queryClient';

/**
 * Wraps the React tree with the shared QueryClient.
 * Mirrors `frontend-buyer/src/components/AppProviders.tsx`.
 */
export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
