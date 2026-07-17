import apiClient from '@/lib/apiClient';
import type {
  ApiResponse,
  CancelOrderPayload,
  Order,
  OrdersPage,
  UpdateOrderStatusPayload,
} from '@/types/order';

/* ──────────────────────────────────────────────────────────────────────────
 * Seller-orders service — wraps the seller-side endpoints of
 * `backend/src/modules/order/order.controller.ts`.
 *
 * Endpoint summary (all under `/api/orders`, all JWT-required):
 *   GET   /orders?page=&limit=     → OrdersPage  (seller-scoped)
 *   GET   /orders/:id              → Order       (full detail + statusLogs)
 *   PATCH /orders/:id/status       → Order       (state transitions)
 *   PATCH /orders/:id/cancel       → Order       (with refund for paid)
 *
 * The seller dashboard never creates orders (that's a customer flow on
 * the buyer app). Checkout lives behind `requireRole('customer')` and is
 * intentionally NOT exposed here.
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Fetch a paginated list of orders for the calling seller.
 *
 * The backend's `getMyOrders` (see `OrderService.getMyOrders`,
 * service.ts:174) branches by role: a seller sees orders where
 * `sellerId === userId`; a customer sees orders where
 * `customerId === userId`. The dashboard only ever calls this with a
 * seller token, so the seller branch is what we get.
 *
 * NOTE: The current backend contract has no `status` query param.
 * Status filtering on the seller dashboard has to happen client-side
 * until the backend adds a filter (tracked as a follow-up).
 */
async function getSellerOrders(params: {
  page?: number;
  limit?: number;
} = {}): Promise<OrdersPage> {
  const { data } = await apiClient.get<ApiResponse<OrdersPage>>('/orders', {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 10,
    },
  });
  return data.data;
}

/**
 * Fetch a single order with full detail.
 *
 * The seller dashboard calls this for the detail view. The backend
 * enforces ownership via `OrderService.getOrderById` (service.ts:193)
 * which 403s if `order.sellerId !== userId` — so it's safe to call
 * unconditionally with a seller token.
 */
async function getOrderById(orderId: string): Promise<Order> {
  const { data } = await apiClient.get<ApiResponse<Order>>(
    `/orders/${orderId}`,
  );
  if (!data.success) throw new Error('Order not found');
  return data.data;
}

/**
 * Move an order forward in its state machine.
 *
 * `PATCH /api/orders/:id/status` is gated to `seller`/`admin` roles and
 * validates the payload with `UpdateOrderStatusSchema`. Invalid
 * transitions get a 400 with a descriptive `message` — the hooks layer
 * surfaces that as a toast.
 *
 * The backend re-fetches the order after the status update, so the
 * returned object always reflects the latest row (including any
 * status log that was just appended).
 */
async function updateOrderStatus(
  orderId: string,
  payload: UpdateOrderStatusPayload,
): Promise<Order> {
  const { data } = await apiClient.patch<ApiResponse<Order>>(
    `/orders/${orderId}/status`,
    payload,
  );
  return data.data;
}

/**
 * Cancel an order (with refund if applicable).
 *
 * The seller route through `cancelOrder` only succeeds when the order's
 * current status can transition to `cancelled` (see
 * `OrderEntity.canTransitionTo`). For paid orders, the backend also
 * initiates a refund through the payment gateway — failures there
 * abort the cancellation and bubble up as a 400.
 *
 * The dashboard should prefer `updateOrderStatus` for normal
 * transitions and reserve this endpoint for explicit "cancel with
 * refund" flows.
 */
async function cancelOrder(
  orderId: string,
  payload: CancelOrderPayload,
): Promise<Order> {
  const { data } = await apiClient.patch<ApiResponse<Order>>(
    `/orders/${orderId}/cancel`,
    payload,
  );
  return data.data;
}

export const orderService = {
  getSellerOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
};