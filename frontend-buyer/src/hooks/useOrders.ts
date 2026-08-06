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
  type OrderCounts,
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
  list: (params: { page: number; limit: number; status?: string }) =>
    [...orderKeys.all(), 'list', params.page, params.limit, params.status ?? 'all'] as const,
  detail: (orderId: string) =>
    [...orderKeys.all(), 'detail', orderId] as const,
  /** Per-status counts for the tab bar. Single cache entry. */
  counts: () => [...orderKeys.all(), 'counts'] as const,
};

/* ──────────────────────────────────────────────────────────────────────────
 * useOrderList — paginated list query
 * ──────────────────────────────────────────────────────────────────────── */

export interface UseOrderListArgs {
  page?: number;
  limit?: number;
  /** Optional status filter (mirrors `ListOrdersParams.status`). */
  status?: OrderPublic['status'];
  enabled?: boolean;
}

export function useOrderList({
  page = 1,
  limit = 10,
  status,
  enabled = true,
}: UseOrderListArgs = {}) {
  return useQuery({
    // The status filter is part of the key so each tab has its own cache.
    // Switching tabs doesn't force a refetch if the data is still fresh
    // for that tab — it just hits the cache for the other segment.
    queryKey: orderKeys.list({ page, limit, status }),
    queryFn: () => orderService.list({ page, limit, status }),
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
      // Counts cache too — the cancelled bucket goes up, the
      // previous-status bucket goes down. One refetch rebuilds the
      // entire tab-bar count set instead of patching per bucket.
      queryClient.invalidateQueries({ queryKey: orderKeys.counts() });
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

/* ──────────────────────────────────────────────────────────────────────────
 * useOrderCounts — per-status counts for the MyOrdersPage tab bar.
 *
 * Single fetch on mount → every tab pill renders its count without
 * triggering 6 paginated list calls. Shares the `orderKeys.counts()`
 * cache entry, so anywhere that needs the counts can subscribe
 * without redundant fetches.
 * ──────────────────────────────────────────────────────────────────────── */

export function useOrderCounts() {
  return useQuery<OrderCounts>({
    queryKey: orderKeys.counts(),
    queryFn: () => orderService.getCounts(),
    // Counts change whenever an order's status flips (placed, paid,
    // cancelled, etc.). The MyOrdersPage UI already invalidates this
    // key after cancel; a 30s staleTime covers the read-only case.
    staleTime: 30_000,
  });
}
