import { useCallback } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  orderService,
  type OrderPublic,
  type CancelOrderPayload,
} from '@/services/orderService';

/* ──────────────────────────────────────────────────────────────────────────
 * Order query keys
 *
 * Centralising keys here means invalidation never goes stale. Every
 * mutation invalidates `orderKeys.all()` so the list view, detail view,
 * and any future dashboard widget all stay in sync.
 * ──────────────────────────────────────────────────────────────────────── */

export const orderKeys = {
  all: () => ['orders'] as const,
  list: (params: { page: number; limit: number }) =>
    [...orderKeys.all(), 'list', params.page, params.limit] as const,
  detail: (orderId: string) =>
    [...orderKeys.all(), 'detail', orderId] as const,
};

/* ──────────────────────────────────────────────────────────────────────────
 * useOrderList — paginated list query
 * ──────────────────────────────────────────────────────────────────────── */

export interface UseOrderListArgs {
  page?: number;
  limit?: number;
  enabled?: boolean;
}

export function useOrderList({
  page = 1,
  limit = 10,
  enabled = true,
}: UseOrderListArgs = {}) {
  return useQuery({
    queryKey: orderKeys.list({ page, limit }),
    queryFn: () => orderService.list({ page, limit }),
    enabled,
    // `keepPreviousData` keeps the previous list on screen while the next
    // page is loading, so the user doesn't see a flash of skeletons.
    placeholderData: keepPreviousData,
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * useOrderDetail — single-order query
 * ──────────────────────────────────────────────────────────────────────── */

export function useOrderDetail(orderId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: orderKeys.detail(orderId ?? ''),
    queryFn: () => orderService.getById(orderId as string),
    enabled: Boolean(orderId) && enabled,
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * useCancelOrder — mutation
 *
 * On success we patch BOTH the detail cache and the list cache so the
 * cancelled status propagates everywhere without a hard refetch.
 * ──────────────────────────────────────────────────────────────────────── */

export function useCancelOrder() {
  const queryClient = useQueryClient();

  const invalidate = useCallback(
    (orderId: string) => {
      // Detail cache first — most visible win.
      queryClient.invalidateQueries({
        queryKey: orderKeys.detail(orderId),
      });
      // Then any list query — invalidate the whole namespace so paginated
      // lists re-fetch their data with the new status.
      queryClient.invalidateQueries({ queryKey: orderKeys.all() });
    },
    [queryClient],
  );

  const formatError = (err: unknown): string => {
    const anyErr = err as {
      response?: { data?: { message?: string } };
      message?: string;
    };
    return (
      anyErr?.response?.data?.message ??
      anyErr?.message ??
      'Could not cancel your order. Please try again.'
    );
  };

  const mutation = useMutation<
    OrderPublic,
    unknown,
    { orderId: string; payload: CancelOrderPayload }
  >({
    mutationFn: ({ orderId, payload }) =>
      orderService.cancel(orderId, payload),
    onSuccess: (data) => {
      // Optimistically seed the detail cache with the new data so any
      // page already on /orders/:id sees the cancelled state instantly.
      queryClient.setQueryData(orderKeys.detail(data.id), data);
      invalidate(data.id);
      toast.success('Order cancelled', {
        description: `Order #${data.id.slice(0, 8).toUpperCase()} has been cancelled.`,
      });
    },
    onError: (err) => {
      toast.error('Cancellation failed', { description: formatError(err) });
    },
  });

  return {
    cancel: mutation.mutateAsync,
    isCancelling: mutation.isPending,
    error: mutation.error,
  };
}
