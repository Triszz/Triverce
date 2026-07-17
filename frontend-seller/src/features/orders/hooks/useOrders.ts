import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { orderService } from '../services/orderService';
import type {
  CancelOrderPayload,
  Order,
  OrdersPage,
  UpdateOrderStatusPayload,
} from '@/types/order';

/* ──────────────────────────────────────────────────────────────────────────
 * Query-key conventions
 *
 * `SELLER_ORDERS_KEY` invalidates every seller-order list cache (any
 * page, any filter). Per-page keys append the page/limit so React Query
 * can cache them independently. The detail key isolates a single order
 * so status updates can invalidate just that row.
 * ────────────────────────────────────────────────────────────────────────── */

const SELLER_ORDERS_KEY = ['seller-orders'] as const;
const orderKey = (id: string) => ['order', id] as const;

/**
 * Pull a friendly message from an axios-shaped error. Mirrors the
 * helper used by `useProducts.ts` — kept local so this hook file is
 * self-contained.
 */
function extractError(error: unknown, fallback: string): string {
  return (
    (error as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ??
    (error as Error)?.message ??
    fallback
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * List
 * ────────────────────────────────────────────────────────────────────────── */

interface UseOrdersArgs {
  page?: number;
  limit?: number;
}

/**
 * Seller's paginated order list. The backend currently exposes no
 * status filter on this endpoint (see `orderService.getSellerOrders`),
 * so any visible filtering on the list page has to happen client-side
 * against the returned `data.orders`. Future ticket: add a `status`
 * query param to `GET /api/orders` and pipe it through here.
 */
export function useOrders({ page = 1, limit = 10 }: UseOrdersArgs = {}) {
  return useQuery<OrdersPage>({
    queryKey: [...SELLER_ORDERS_KEY, { page, limit }],
    queryFn: () => orderService.getSellerOrders({ page, limit }),
    // Orders change whenever a status moves forward; default staleTime
    // is fine and mutations invalidate the right keys explicitly.
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * Detail
 * ────────────────────────────────────────────────────────────────────────── */

export function useOrderDetails(orderId: string | undefined) {
  return useQuery<Order>({
    queryKey: orderKey(orderId ?? ''),
    enabled: Boolean(orderId),
    queryFn: () => orderService.getOrderById(orderId as string),
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * Status mutation
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Move an order to the next status (e.g. `pending → confirmed`).
 *
 * Invalidation strategy:
 *   1. The detail cache for this exact order — the row's status,
 *      `updatedAt`, and `statusLogs` all changed.
 *   2. The seller-orders list — the row appears with the new badge in
 *      the list view.
 *
 * Optimistic update: intentionally NOT done here. Status transitions
 * carry server-side validation (`VALID_TRANSITIONS`) and may be
 * refused with a descriptive 400; mirroring the request optimistically
 * would briefly show a wrong badge before the rollback. Stale data for
 * ~300 ms during a 200 OK is acceptable.
 */
export function useUpdateOrderStatus(orderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateOrderStatusPayload) =>
      orderService.updateOrderStatus(orderId, payload),
    onSuccess: () => {
      toast.success('Order status updated');
      queryClient.invalidateQueries({ queryKey: orderKey(orderId) });
      queryClient.invalidateQueries({ queryKey: SELLER_ORDERS_KEY });
    },
    onError: (error: unknown) => {
      toast.error(extractError(error, 'Failed to update order status'));
    },
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * Cancel-with-refund mutation
 *
 * Distinct from the status mutation because it can also initiate a
 * refund (see `OrderService.cancelOrder`, service.ts:247). The detail
 * page exposes this through its own "Cancel order" button so the
 * two flows aren't visually conflated.
 * ────────────────────────────────────────────────────────────────────────── */

export function useCancelOrder(orderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CancelOrderPayload) =>
      orderService.cancelOrder(orderId, payload),
    onSuccess: () => {
      toast.success('Order cancelled');
      queryClient.invalidateQueries({ queryKey: orderKey(orderId) });
      queryClient.invalidateQueries({ queryKey: SELLER_ORDERS_KEY });
    },
    onError: (error: unknown) => {
      toast.error(extractError(error, 'Failed to cancel order'));
    },
  });
}