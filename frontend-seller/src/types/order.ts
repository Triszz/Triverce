/**
 * Domain types for the seller-dashboard Orders module.
 *
 * These interfaces are 1:1 mirrors of the backend's `toPublic()` shapes
 * for the order module (see `backend/src/modules/order/`):
 *
 *   - `OrderEntity.toPublic()` → `Order`
 *   - `OrderItemEntity.toPublic()` → `OrderItem`
 *   - `OrderStatusLogEntity.toPublic()` → `OrderStatusLog`
 *
 * Fields the backend does NOT include in `toPublic()` are omitted here:
 *   - `customerId` — deliberately excluded by the entity; the seller
 *     dashboard has no use for it.
 *
 * Wire-shape quirks documented inline below — these matter for binding:
 *   1. The list endpoint (`GET /api/orders`) loads items but **not
 *      status logs**. So `statusLogs` is always `[]` on list rows; the
 *      detail fetch is the only source of the full timeline.
 *   2. `imageUrl` on order items is now populated via the variant
 *      relation (Issue #1 fix), and `paymentMethod` / `paymentStatus`
 *      are populated via the payment relation (Issue #3 fix). Both
 *      are nullable for legacy rows that pre-date the join.
 */

/* ──────────────────────────────────────────────────────────────────────────
 * Enums (mirror backend `OrderStatus` and the DTO enum literals)
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Mirrors `OrderStatus` in `schema.prisma` and the `z.enum(...)` literal
 * in `order.dto.ts → UpdateOrderStatusSchema`.
 *
 * Note: `pending` and `failed` are reachable by the order pipeline but
 * NOT valid update targets via `PATCH /api/orders/:id/status`. Use
 * `UpdateableOrderStatus` for the action-button workflow.
 */
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'shipping'
  | 'delivered'
  | 'cancelled'
  | 'failed';

/**
 * Subset of `OrderStatus` accepted by `PATCH /api/orders/:id/status`.
 *
 * Derived directly from `UpdateOrderStatusSchema`:
 *   `z.enum(["confirmed", "shipping", "delivered", "cancelled"])`
 *
 * `pending` (newly created orders only) and `failed` (terminal) are
 * intentionally excluded.
 */
export type UpdateableOrderStatus = Extract<
  OrderStatus,
  'confirmed' | 'shipping' | 'delivered' | 'cancelled'
>;

/**
 * Server-side transition table (see `OrderEntity.VALID_TRANSITIONS`).
 * Mirrored here so the UI can decide which action buttons to render
 * without round-tripping for the current order.
 *
 * Why mirror instead of derive from server: keeps the dashboard
 * responsive (no fetch needed to render action chips), and the table
 * is part of the public contract — the backend will 400 with a
 * descriptive error if our local copy drifts.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, UpdateableOrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipping', 'cancelled'],
  shipping: ['delivered'],
  delivered: [],
  cancelled: [],
  failed: [],
};

/** Returns the legal next statuses for a given current status. */
export function nextOrderStatuses(
  current: OrderStatus,
): readonly UpdateableOrderStatus[] {
  return ORDER_TRANSITIONS[current];
}

/* ──────────────────────────────────────────────────────────────────────────
 * Order item
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Mirrors `OrderItemEntity.toPublic()`.
 *
 * `subtotal` is computed server-side (`unitPrice * quantity`); the
 * dashboard should never recompute it.
 *
 * `imageUrl` + `attributes` were added in Issue #1 to replace the
 * earlier placeholder chip on the order detail page. The backend now
 * `include`s the variant relation in `loadItems` and forwards the
 * `image_url` and resolved attribute values (`{name, value}`).
 * `imageUrl` is `null` for variants that never had one uploaded; the
 * UI renders a fallback icon in that case. `attributes` is `[]` for
 * variants that have no attributes configured.
 */
export interface OrderItem {
  id: string;
  variantId: string;
  productName: string;
  variantSku: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  imageUrl: string | null;
  attributes: OrderItemAttribute[];
}

/** Resolved attribute on an order item (e.g. `{name: "size", value: "M"}`). */
export interface OrderItemAttribute {
  name: string;
  value: string;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Status log entry
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Mirrors `OrderStatusLogEntity.toPublic()`. Used by the detail view
 * to render the audit trail ("Pending → Confirmed by Tri on 12 Jun").
 *
 * Note: `changedBy` is the user id (seller id or customer id). The
 * detail page may want to map it to a display name; that requires a
 * separate users endpoint (not in scope here).
 */
export interface OrderStatusLog {
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  /** User id of who made the change, or `null` for system events. */
  changedBy: string | null;
  note: string | null;
  createdAt: string;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Order (the main payload returned by list + detail endpoints)
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Wire shape of a single order returned by `GET /api/orders` and
 * `GET /api/orders/:id`. Identical for both endpoints; the only
 * runtime difference is that list responses have an empty
 * `statusLogs` array (see header note).
 *
 * `paymentMethod` / `paymentStatus` were added in Issue #3 to replace
 * the earlier meaningless "Linked" indicator. They mirror the
 * `OrderEntity.OrderPaymentPayload` shape on the backend; values are
 * `null` when the order has no linked payment row.
 */
export interface Order {
  id: string;
  sellerId: string;
  status: OrderStatus;
  totalAmount: number;
  shippingName: string;
  shippingPhone: string;
  shippingAddress: string;
  note: string | null;
  cancelledReason: string | null;
  /** Linked `Payment.id` if a payment row exists; `null` otherwise. */
  paymentId: string | null;
  /** Gateway used (`vnpay`, `momo`, `stripe`, `cod`). `null` if no payment. */
  paymentMethod: PaymentMethod | null;
  /** Current status of the linked payment row. `null` if no payment. */
  paymentStatus: PaymentState | null;
  items: OrderItem[];
  statusLogs: OrderStatusLog[];
  createdAt: string;
  updatedAt: string;
}

/** Mirrors `PaymentGateway` in `backend/src/modules/payment/payment.entity.ts`. */
export type PaymentMethod = 'momo' | 'stripe' | 'vnpay' | 'cod';

/** Mirrors `PaymentStatus` in `backend/src/modules/payment/payment.entity.ts`. */
export type PaymentState =
  | 'pending'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'refunded';

/* ──────────────────────────────────────────────────────────────────────────
 * Paginated list envelope
 *
 * The backend returns `{ success, data: { orders, total, page, limit } }`
 * (NOT the standard `meta` envelope used by the product endpoints).
 * See `OrderController.getMyOrders` lines 45–51 and
 * `OrderService.getMyOrders` return type lines 178–183.
 * ────────────────────────────────────────────────────────────────────────── */

export interface OrdersPage {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
}

/* ──────────────────────────────────────────────────────────────────────────
 * API envelope helpers
 * ────────────────────────────────────────────────────────────────────────── */

/** Standard `success: true` envelope used by every order endpoint. */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Status-update payload
 *
 * Mirrors `UpdateOrderStatusSchema`. Optional `note` is sent on every
 * transition; the backend persists it on the new `OrderStatusLog`.
 * ────────────────────────────────────────────────────────────────────────── */

export interface UpdateOrderStatusPayload {
  status: UpdateableOrderStatus;
  note?: string;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Cancel payload
 *
 * Mirrors `CancelOrderSchema`. The seller flow uses this via
 * `PATCH /api/orders/:id/cancel` (different from status update — this
 * also triggers a refund for paid orders).
 * ────────────────────────────────────────────────────────────────────────── */

export interface CancelOrderPayload {
  reason: string;
}