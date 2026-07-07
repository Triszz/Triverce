import { CheckCircle2, Circle } from 'lucide-react';
import type { OrderStatusLogPublic } from '@/services/orderService';
import { formatOrderDate } from '@/features/orders/orders.types';

/* ──────────────────────────────────────────────────────────────────────────
 * OrderTimeline — vertical, dot-and-line visualisation of the order's
 * `statusLogs` array.
 *
 *   • Logs are displayed newest-first (top → bottom goes back in time),
 *     so the user sees the most recent change first.
 *   • The first dot is filled (most recent); older entries use a hollow
 *     ring so the visual hierarchy is obvious at a glance.
 *   • `note` is rendered as a small muted caption under the status name
 *     when present (e.g. "Payment paid" auto-notes from the webhook).
 * ──────────────────────────────────────────────────────────────────────── */

export interface OrderTimelineProps {
  logs: OrderStatusLogPublic[];
  className?: string;
}

export function OrderTimeline({ logs, className }: OrderTimelineProps) {
  if (logs.length === 0) {
    return (
      <p className="text-sm text-slate-500 italic">
        No status changes recorded yet.
      </p>
    );
  }

  // Newest first.
  const sorted = [...logs].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <ol className={className} role="list">
      {sorted.map((log, idx) => {
        const isLatest = idx === 0;
        const isLast = idx === sorted.length - 1;
        const toLabel = humanizeStatus(log.toStatus);

        return (
          <li key={`${log.createdAt}-${idx}`} className="relative pl-8 pb-5 last:pb-0">
            {/* Vertical connector line */}
            {!isLast && (
              <span
                aria-hidden
                className="absolute left-[11px] top-6 bottom-0 w-px bg-slate-200"
              />
            )}

            {/* Dot */}
            <span
              aria-hidden
              className="absolute left-0 top-1 inline-flex items-center justify-center"
            >
              {isLatest ? (
                <CheckCircle2
                  size={22}
                  className="text-[#002b5b] fill-brand-50"
                />
              ) : (
                <Circle
                  size={22}
                  className="text-slate-300 fill-white"
                  strokeWidth={1.5}
                />
              )}
            </span>

            {/* Body */}
            <div className="min-w-0">
              <p
                className={
                  isLatest
                    ? 'text-sm font-semibold text-slate-900'
                    : 'text-sm font-medium text-slate-700'
                }
              >
                {toLabel}
              </p>
              {log.note && (
                <p className="mt-0.5 text-xs text-slate-500">{log.note}</p>
              )}
              <p className="mt-0.5 text-[11px] text-slate-400 tabular-nums">
                {formatOrderDate(log.createdAt)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* Tiny helper so the timeline shows "Confirmed" instead of "confirmed". */
function humanizeStatus(status: string): string {
  if (!status) return '';
  return status.charAt(0).toUpperCase() + status.slice(1);
}
