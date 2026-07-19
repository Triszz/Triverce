import apiClient from '@/lib/apiClient';
import type {
  MarkAllReadResponse,
  MarkReadResponse,
  NotificationsApiResponse,
} from '../types/notification';

/* ──────────────────────────────────────────────────────────────────────────
 * Notifications service — wraps the seller-side endpoints of
 * `backend/src/modules/notification/notification.controller.ts`.
 *
 * Endpoint summary (all under `/api/notifications`, JWT-required):
 *   GET   /notifications          → NotificationsPage (list + unreadCount)
 *   PATCH /notifications/:id/read → { updated: boolean }
 *   PATCH /notifications/read-all → { updated: number }
 *
 * All three are seller-scoped — the sellerId is derived from the JWT by
 * the backend, never sent from the client.
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Fetch the most-recent notifications + the unread badge count.
 *
 * `limit` defaults to 20 on the backend (capped at 100) — keeps the
 * bell dropdown's first paint small even for sellers with thousands
 * of historical notifications.
 */
async function listNotifications(limit: number = 20): Promise<{
  notifications: Awaited<ReturnType<typeof apiClient.get<NotificationsApiResponse>>>['data']['data']['notifications'];
  unreadCount: number;
}> {
  const { data } = await apiClient.get<NotificationsApiResponse>(
    '/notifications',
    { params: { limit } },
  );
  return data.data;
}

/**
 * Mark a single notification as read.
 *
 * Idempotent on the backend — returns `{ updated: true }` only when
 * the row actually transitioned from unread → read, but the caller
 * can ignore the return value safely (a no-op double-click is fine).
 */
async function markRead(notificationId: string): Promise<boolean> {
  const { data } = await apiClient.patch<MarkReadResponse>(
    `/notifications/${notificationId}/read`,
  );
  return data.data.updated;
}

/**
 * Mark every unread notification as read in a single round-trip.
 *
 * Returns the number of rows the backend actually transitioned, which
 * is useful for a confirmation toast like "Marked 3 as read".
 */
async function markAllRead(): Promise<number> {
  const { data } = await apiClient.patch<MarkAllReadResponse>(
    '/notifications/read-all',
  );
  return data.data.updated;
}

export const notificationService = {
  listNotifications,
  markRead,
  markAllRead,
};
