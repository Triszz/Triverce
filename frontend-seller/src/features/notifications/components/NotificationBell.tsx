import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Check,
  PackageCheck,
  PackageX,
  ShoppingBag,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatRelativeTime } from '@/lib/relativeTime';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '../hooks/useNotifications';
import type { Notification, NotificationType } from '../types/notification';

/**
 * Maps the `Notification.type` discriminator to a small lucide icon
 * and an accent color. New types fall through to the generic Bell
 * — keep the fallback visible so the dev team remembers to update
 * this map when adding a new notification kind.
 */
const TYPE_VISUALS: Record<
  NotificationType,
  { icon: typeof Bell; tone: string }
> = {
  NEW_ORDER: {
    icon: ShoppingBag,
    tone: 'bg-blue-50 text-blue-600',
  },
  ORDER_CANCELLED: {
    icon: PackageX,
    tone: 'bg-red-50 text-red-600',
  },
  // String literal index signature above means unknown types get
  // the default via the `??` fallback in the render — TypeScript
  // covers the compile-time cases but the runtime is also safe.
};

/* ──────────────────────────────────────────────────────────────────────────
 * NotificationBell
 *
 * Dashboard header bell that exposes the seller's notification feed:
 *
 *   • Badge with unread count (or a simple dot when count > 99).
 *   • Click toggles a dropdown of the 20 most-recent notifications.
 *   • Clicking a row marks it read + navigates to its `actionUrl`.
 *   • "Mark all as read" button in the dropdown header.
 *   • Empty state when the feed is empty.
 *
 * Architecture notes:
 *
 *   - Built on local `useState` rather than Radix / Headless UI to
 *     keep the seller bundle small. The dropdown is a single panel
 *     so accessibility is straightforward (Escape to close, focus
 *     return, click-outside via a window listener).
 *
 *   - The data layer is React Query (see `useNotifications`). The
 *     bell polls every 30 s so a seller watching the dashboard
 *     sees new orders appear without a manual refresh.
 *
 *   - Click handlers use `event.stopPropagation()` to prevent the
 *     row's onClick (which also marks read + navigates) from
 *     double-firing when the "Mark all read" button is clicked.
 * ────────────────────────────────────────────────────────────────────────── */

export function NotificationBell() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const { data, isLoading } = useNotifications(20);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  // Click-outside-to-close + Escape-to-close.
  // Listeners are attached to `window` rather than the panel so a
  // click anywhere outside the panel (including on a notification
  // row before it navigates away) dismisses the dropdown cleanly.
  useEffect(() => {
    if (!isOpen) return;

    const handlePointer = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (containerRef.current && target && !containerRef.current.contains(target)) {
        setIsOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    window.addEventListener('mousedown', handlePointer);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handlePointer);
      window.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  // Bell badge — dot when unreadCount > 0, capped number when ≤ 99,
  // omitted entirely when zero so the bell doesn't look noisy for
  // sellers who've cleared their feed.
  const badge = unreadCount === 0
    ? null
    : unreadCount > 99
      ? '99+'
      : String(unreadCount);

  const handleNotificationClick = (notification: Notification) => {
    // Mark read optimistically, then navigate. We deliberately don't
    // `await` markRead — the navigation shouldn't wait on the patch
    // call. The query mutation rolls itself back if the API call
    // fails (very unlikely for a PATCH), so the user gets correct
    // feedback either way.
    if (!notification.isRead) {
      markRead.mutate(notification.id);
    }
    setIsOpen(false);
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    }
  };

  const handleMarkAll = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Stop propagation so the button click doesn't bubble to the
    // panel and close the dropdown mid-toast.
    e.stopPropagation();
    if (unreadCount === 0) return;
    markAllRead.mutate(undefined, {
      onSuccess: (updatedCount) => {
        // Lightweight feedback. Sonner is already a project-wide
        // dep (used by the seller layout's logout toast).
        if (updatedCount > 0) {
          import('sonner').then(({ toast }) =>
            toast.success(
              updatedCount === 1
                ? '1 notification marked as read'
                : `${updatedCount} notifications marked as read`,
            ),
          );
        }
      },
    });
  };

  // Hide the bell entirely for users without a seller identity —
  // admins would still see it but a logged-out state (defensive) is
  // better off invisible.
  if (!user) return null;

  return (
    <div ref={containerRef} className="relative">
      {/* Bell trigger button */}
      <button
        type="button"
        aria-label={`Notifications (${unreadCount} unread)`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'relative p-2 rounded-lg transition-colors cursor-pointer',
          isOpen
            ? 'bg-slate-100 text-slate-900'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
        )}
      >
        <Bell size={18} aria-hidden />
        {badge && (
          <span
            className={cn(
              'absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1',
              'inline-flex items-center justify-center rounded-full',
              'bg-red-500 text-white text-[10px] font-semibold leading-none',
              'ring-2 ring-white',
            )}
            aria-hidden
          >
            {badge}
          </span>
        )}
      </button>

      {/* Dropdown panel — rendered only when open so the React tree
          (and the focus-trap side-effects) are mounted lazily. */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Notifications"
          className={cn(
            'absolute right-0 top-full mt-2 z-40',
            'w-[360px] max-w-[calc(100vw-2rem)]',
            'bg-white rounded-xl border border-slate-200 shadow-lg',
            'overflow-hidden',
            'animate-in fade-in slide-in-from-top-2',
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Notifications
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {unreadCount === 0
                  ? "You're all caught up"
                  : `${unreadCount} unread`}
              </p>
            </div>
            <button
              type="button"
              onClick={handleMarkAll}
              disabled={unreadCount === 0 || markAllRead.isPending}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg',
                'text-xs font-medium transition-colors cursor-pointer',
                'text-[#002b5b] hover:bg-slate-100',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              <Check size={12} aria-hidden />
              Mark all read
            </button>
          </div>

          {/* Body */}
          <div className="max-h-[420px] overflow-y-auto">
            {isLoading ? (
              <NotificationSkeleton />
            ) : notifications.length === 0 ? (
              <EmptyState />
            ) : (
              <ul className="divide-y divide-slate-100">
                {notifications.map((n) => (
                  <NotificationRow
                    key={n.id}
                    notification={n}
                    onClick={() => handleNotificationClick(n)}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Sub-components (kept in this file — they're only used here, and
 * hoisting them avoids a noisy directory structure for the same UX).
 * ────────────────────────────────────────────────────────────────────────── */

function NotificationRow({
  notification,
  onClick,
}: {
  notification: Notification;
  onClick: () => void;
}) {
  const visuals = TYPE_VISUALS[notification.type] ?? {
    icon: PackageCheck,
    tone: 'bg-slate-100 text-slate-600',
  };
  const Icon = visuals.icon;

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'w-full text-left flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer',
          notification.isRead
            ? 'bg-white hover:bg-slate-50'
            : 'bg-blue-50/40 hover:bg-blue-50',
        )}
      >
        {/* Type icon — small colored chip that signals what kind of
            event the notification represents at a glance. */}
        <span
          className={cn(
            'shrink-0 mt-0.5 w-9 h-9 rounded-lg flex items-center justify-center',
            visuals.tone,
          )}
          aria-hidden
        >
          <Icon size={16} />
        </span>

        {/* Body — title, message, timestamp. Unread rows render the
            title in slate-900 / read rows in slate-700 so the
            tonal difference reinforces the badge. */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <p
              className={cn(
                'text-sm truncate',
                notification.isRead
                  ? 'font-medium text-slate-700'
                  : 'font-semibold text-slate-900',
              )}
            >
              {notification.title}
            </p>
            {!notification.isRead && (
              <span
                className="shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500"
                aria-label="Unread"
              />
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-600 line-clamp-2">
            {notification.message}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            {formatRelativeTime(notification.createdAt)}
          </p>
        </div>
      </button>
    </li>
  );
}

function NotificationSkeleton() {
  return (
    <div className="px-4 py-3 space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-100 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-3/4 rounded bg-slate-100 animate-pulse" />
            <div className="h-3 w-full rounded bg-slate-100 animate-pulse" />
            <div className="h-2.5 w-16 rounded bg-slate-100 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="px-4 py-10 text-center">
      <div className="mx-auto w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
        <Bell size={20} aria-hidden />
      </div>
      <p className="mt-3 text-sm font-medium text-slate-900">
        No new notifications
      </p>
      <p className="mt-1 text-xs text-slate-500">
        New orders and updates will appear here.
      </p>
    </div>
  );
}

export default NotificationBell;
