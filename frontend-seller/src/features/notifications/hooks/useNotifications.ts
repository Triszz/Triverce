import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationService } from '../services/notificationService';
import type { Notification, NotificationsPage } from '../types/notification';

/**
 * Query key for the notifications feed. Centralized so every hook
 * (query + mutations) invalidates the same key and the cache stays
 * consistent.
 */
export const NOTIFICATIONS_QUERY_KEY = ['notifications'] as const;

/**
 * useNotifications — fetches the seller's notification feed and
 * exposes the unread count for the bell badge.
 *
 * `refetchInterval` polls every 30 s so a seller watching the
 * dashboard sees new orders appear without a manual refresh. Polling
 * (not WebSocket / SSE) is intentional: the dashboard runs over
 * plain HTTP, and 30 s is well under any human "I'm waiting for
 * something" threshold without hammering the server.
 *
 * `staleTime` is set shorter than the polling interval so the cached
 * value always re-fetches on the timer tick even if React Query
 * thinks the data is fresh.
 */
export function useNotifications(limit: number = 20) {
  return useQuery({
    queryKey: [...NOTIFICATIONS_QUERY_KEY, { limit }],
    queryFn: async (): Promise<NotificationsPage> =>
      notificationService.listNotifications(limit),
    refetchInterval: 30 * 1000,
    staleTime: 10 * 1000,
    retry: 1,
  });
}

/**
 * Mutation: mark a single notification as read.
 *
 * Uses optimistic updates so the blue-dot indicator disappears the
 * instant the user clicks the row (no waiting on the network). The
 * cache is rolled back to the server's response on settle.
 *
 * Notifications are keyed by id; if the optimistic id is missing from
 * the cached list (e.g. it was just evicted), the mutation is a no-op.
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) =>
      notificationService.markRead(notificationId),

    onMutate: async (notificationId) => {
      // Cancel any in-flight refetch so it doesn't overwrite our
      // optimistic update.
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });

      // Snapshot all matching query variants (different `limit`
      // values share the same logical list).
      const snapshots = queryClient.getQueriesData<NotificationsPage>({
        queryKey: NOTIFICATIONS_QUERY_KEY,
      });

      // Apply the optimistic transition: unread → read + decrement
      // unreadCount. Touches every cached variant so the bell badge
      // stays in sync regardless of which limit the dropdown used.
      for (const [key, snapshot] of snapshots) {
        if (!snapshot) continue;
        queryClient.setQueryData<NotificationsPage>(key, {
          notifications: snapshot.notifications.map((n) =>
            n.id === notificationId ? { ...n, isRead: true } : n,
          ),
          unreadCount: Math.max(
            0,
            snapshot.unreadCount -
              (snapshot.notifications.find((n) => n.id === notificationId)?.isRead
                ? 0
                : 1),
          ),
        });
      }

      return { snapshots };
    },

    onError: (_err, _vars, context) => {
      // Rollback to the pre-mutation snapshot if the server call
      // failed.
      if (!context) return;
      for (const [key, snapshot] of context.snapshots) {
        queryClient.setQueryData(key, snapshot);
      }
    },

    onSettled: () => {
      // Always re-sync with the server — covers optimistic drift.
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });
}

/**
 * Mutation: mark every unread notification as read.
 *
 * Optimistic: bumps `unreadCount` to 0 and sets `isRead: true` on
 * every cached notification in one shot, then re-syncs from the
 * server to capture the actual count of rows touched (used in the
 * toast).
 */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationService.markAllRead(),

    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });

      const snapshots = queryClient.getQueriesData<NotificationsPage>({
        queryKey: NOTIFICATIONS_QUERY_KEY,
      });

      for (const [key, snapshot] of snapshots) {
        if (!snapshot) continue;
        queryClient.setQueryData<NotificationsPage>(key, {
          notifications: snapshot.notifications.map((n) => ({
            ...n,
            isRead: true,
          })),
          unreadCount: 0,
        });
      }

      return { snapshots };
    },

    onError: (_err, _vars, context) => {
      if (!context) return;
      for (const [key, snapshot] of context.snapshots) {
        queryClient.setQueryData(key, snapshot);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });
}

/**
 * Pure helper: filter a notifications list to just the unread ones.
 *
 * Kept here (not inside the component) so other surfaces (toasts,
 * future sidebar widgets) can reuse it without duplicating the
 * predicate.
 */
export function filterUnread(notifications: Notification[]): Notification[] {
  return notifications.filter((n) => !n.isRead);
}
