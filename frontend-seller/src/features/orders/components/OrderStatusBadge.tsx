import { cn } from '@/lib/cn';
import type { OrderStatus } from '@/types/order';

/**
 * Status badge visual mapping.
 *
 * Strict color coding per the dashboard spec:
 *   - Yellow → Pending
 *   - Blue   → Confirmed / Shipping
 *   - Green  → Delivered
 *   - Red    → Cancelled / Failed
 *
 * The label helpers are kept local so we can localize the strings
 * later without touching every consumer. The `cls` table is the single
 * source of truth for "what color is this status".
 */
export interface OrderStatusBadgeProps {
  status: OrderStatus;
  /** Optional size variant — `sm` is denser for use inside table rows. */
  size?: 'sm' | 'md';
  className?: string;
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  shipping: 'Shipping',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  failed: 'Failed',
};

/**
 * Tailwind classes per status. Lifted out of the component so each
 * variant is identifiable and tree-shakeable.
 */
const STATUS_CLS: Record<OrderStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
  shipping: 'bg-blue-50 text-blue-700 border-blue-200',
  delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
};

/**
 * Status chip used in the order list + detail. Always renders an inline
 * pill — never an icon — so the table row stays scannable.
 */
export function OrderStatusBadge({
  status,
  size = 'md',
  className,
}: OrderStatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
        STATUS_CLS[status],
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'inline-block rounded-full',
          size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2',
          // The dot uses a slightly stronger shade of the same family so
          // the badge reads as "tag with dot" rather than "soft button".
          status === 'pending' && 'bg-amber-500',
          status === 'confirmed' && 'bg-blue-500',
          status === 'shipping' && 'bg-blue-500',
          status === 'delivered' && 'bg-emerald-500',
          status === 'cancelled' && 'bg-red-500',
          status === 'failed' && 'bg-red-500',
        )}
      />
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Exported label lookup for callers that just need the human label. */
export function orderStatusLabel(status: OrderStatus): string {
  return STATUS_LABEL[status];
}