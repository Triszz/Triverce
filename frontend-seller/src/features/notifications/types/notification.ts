/**
 * Domain types for the seller-dashboard Notifications module.
 *
 * Mirrors the wire shape returned by:
 *   GET    /api/notifications
 *   PATCH  /api/notifications/:id/read
 *   PATCH  /api/notifications/read-all
 *
 * (See `backend/src/modules/notification/`.)
 *
 * `type` is the free-form discriminator the backend uses:
 *   - 'NEW_ORDER'        — a customer placed an order
 *   - 'ORDER_CANCELLED'  — an order was cancelled (by customer, seller, or admin)
 * Future notification kinds can be added without a schema change — just
 * extend this union when the frontend needs to render a new icon or
 * treat it specially.
 */
export type NotificationType = 'NEW_ORDER' | 'ORDER_CANCELLED' | string;

export interface Notification {
  id: string;
  sellerId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  /** Deep link the dashboard navigates to on click, e.g. '/orders/abc-123'. */
  actionUrl: string | null;
  /** ISO-8601 string from the backend (JSON can't carry `Date`). */
  createdAt: string;
}

export interface NotificationsPage {
  notifications: Notification[];
  unreadCount: number;
}

export interface NotificationsApiResponse {
  success: boolean;
  data: NotificationsPage;
}

export interface MarkReadResponse {
  success: boolean;
  data: { updated: boolean };
}

export interface MarkAllReadResponse {
  success: boolean;
  data: { updated: number };
}
