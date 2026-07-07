import apiClient from './apiClient';

/* ──────────────────────────────────────────────────────────────────────────
 * Order service — thin wrapper around the `/orders` endpoints.
 *
 * Backend routes (see backend/src/modules/order/order.route.ts) are all
 * behind `authenticate + requireRole(...)`, so the service assumes an
 * authenticated customer. Higher-level concerns (toasts, redirects, query
 * keys) live in the checkout feature, not here.
 * ──────────────────────────────────────────────────────────────────────── */

/** Payment gateway accepted by the backend `CreateOrderDto`. */
export type CheckoutGateway = 'momo' | 'stripe' | 'vnpay' | 'cod';

/** Public shape of an order item (mirrors `OrderItemEntity.toPublic()`). */
export interface OrderItemPublic {
  id: string;
  variantId: string;
  productName: string;
  variantSku: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

/** Public shape of an order status log entry. */
export interface OrderStatusLogPublic {
  fromStatus: string | null;
  toStatus: string;
  changedBy: string | null;
  note: string | null;
  createdAt: string;
}

/** Public shape of an order (mirrors `OrderEntity.toPublic()`). */
export interface OrderPublic {
  id: string;
  sellerId: string;
  status: 'pending' | 'confirmed' | 'shipping' | 'delivered' | 'cancelled' | 'failed';
  totalAmount: number;
  shippingName: string;
  shippingPhone: string;
  shippingAddress: string;
  note: string | null;
  cancelledReason: string | null;
  paymentId: string | null;
  items: OrderItemPublic[];
  statusLogs: OrderStatusLogPublic[];
  createdAt: string;
  updatedAt: string;
}

/** Payload accepted by `POST /orders` (mirrors backend `CreateOrderDto`). */
export interface CreateOrderPayload {
  shippingName: string;
  shippingPhone: string;
  shippingAddress: string;
  note?: string;
  gateway: CheckoutGateway;
  returnUrl: string;
  cancelUrl: string;
}

/** Response shape for `POST /orders`. */
export interface CheckoutResponse {
  orders: OrderPublic[];
  paymentMethod: CheckoutGateway;
  paymentId?: string;
  paymentIds?: string[];
  paymentUrl: string;
}

/** Payload accepted by `PATCH /orders/:id/cancel` (mirrors backend `CancelOrderDto`). */
export interface CancelOrderPayload {
  reason: string;
}

interface ApiSuccess<T> {
  success: true;
  data: T;
}

/**
 * Backend list-envelope for `/orders` (see `OrderController.getMyOrders`):
 *
 *   { success: true, data: { orders: OrderPublic[], total, page, limit } }
 *
 * NOTE: the pagination meta is NOT wrapped in a separate `meta` field —
 * it lives as siblings on the same `data` object as the `orders` array.
 * (Contrast: `/products` uses a flat array shape via `ApiSuccess<T[]>`
 *  — see `productService.list` for that path.)
 */
interface ApiSuccessOrderList {
  success: true;
  data: {
    orders: OrderPublic[];
    total: number;
    page: number;
    limit: number;
  };
}

function unwrap<T>(payload: ApiSuccess<T>): T {
  if (!payload.success) throw new Error('Order request failed');
  return payload.data;
}

export interface ListOrdersParams {
  page?: number;
  limit?: number;
}

export const orderService = {
  /**
   * POST /orders — checkout the current active cart.
   *
   * For VNPay/Momo/Stripe, the response carries a `paymentUrl` the client
   * should redirect the user to. For COD, no redirect is needed and the
   * caller can navigate straight to the orders list.
   */
  createOrder: async (payload: CreateOrderPayload): Promise<CheckoutResponse> => {
    const { data } = await apiClient.post<ApiSuccess<CheckoutResponse>>(
      '/orders',
      payload,
    );
    return unwrap(data);
  },

  /** GET /orders — paginated list of the current customer's orders.
   *
   *  Returns: { orders: OrderPublic[]; total; page; limit }
   *
   *  The backend envelope is `{ success, data: { orders, total, page, limit } }`
   *  — meta fields are siblings of `orders` inside `data`, NOT a nested
   *  `meta` object. See `ApiSuccessOrderList`.
   */
  list: async (
    params: ListOrdersParams = {},
  ): Promise<{ orders: OrderPublic[]; total: number; page: number; limit: number }> => {
    const { data } = await apiClient.get<ApiSuccessOrderList>('/orders', {
      params,
    });
    if (!data.success || !data.data) {
      throw new Error('Order list returned an unexpected envelope');
    }
    return {
      orders: data.data.orders ?? [],
      total: data.data.total ?? 0,
      page: data.data.page ?? 1,
      limit: data.data.limit ?? (params.limit ?? 10),
    };
  },

  /** GET /orders/:id — single order with items + status logs. */
  getById: async (orderId: string): Promise<OrderPublic> => {
    const { data } = await apiClient.get<ApiSuccess<OrderPublic>>(
      `/orders/${encodeURIComponent(orderId)}`,
    );
    return unwrap(data);
  },

  /** PATCH /orders/:id/cancel — customer-initiated cancellation. */
  cancel: async (
    orderId: string,
    payload: CancelOrderPayload,
  ): Promise<OrderPublic> => {
    const { data } = await apiClient.patch<ApiSuccess<OrderPublic>>(
      `/orders/${encodeURIComponent(orderId)}/cancel`,
      payload,
    );
    return unwrap(data);
  },
};