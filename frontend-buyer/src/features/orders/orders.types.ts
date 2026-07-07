import { z } from 'zod';
import type { BadgeProps } from '@/components/ui/Badge';

/* ──────────────────────────────────────────────────────────────────────────
 * Shared order-feature types and helpers.
 *
 * Sits next to the feature pages so we don't bleed the design system —
 * `OrderStatus`, badge metadata, and the Zod cancel-reason schema are
 * all derived from the same backend contract.
 * ──────────────────────────────────────────────────────────────────────── */

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'shipping'
  | 'delivered'
  | 'cancelled'
  | 'failed';

/* ── Status metadata (label + tone + icon) ──────────────────────────────── */

import {
  Clock,
  CheckCircle2,
  Truck,
  PackageCheck,
  XCircle,
  AlertOctagon,
  type LucideIcon,
} from 'lucide-react';

interface OrderStatusMeta {
  label: string;
  tone: NonNullable<BadgeProps['tone']>;
  icon: LucideIcon;
  /** One-sentence blurb shown in the timeline / detail header. */
  description: string;
}

export const ORDER_STATUS_META: Record<OrderStatus, OrderStatusMeta> = {
  pending: {
    label: 'Pending',
    tone: 'warning',
    icon: Clock,
    description: 'We have your order — waiting for payment confirmation.',
  },
  confirmed: {
    label: 'Confirmed',
    tone: 'info',
    icon: CheckCircle2,
    description: 'Payment confirmed. The seller is preparing your order.',
  },
  shipping: {
    label: 'Shipping',
    tone: 'brand',
    icon: Truck,
    description: 'Your order is on the way to you.',
  },
  delivered: {
    label: 'Delivered',
    tone: 'success',
    icon: PackageCheck,
    description: 'Order delivered. Enjoy!',
  },
  cancelled: {
    label: 'Cancelled',
    tone: 'neutral',
    icon: XCircle,
    description: 'This order was cancelled.',
  },
  failed: {
    label: 'Failed',
    tone: 'danger',
    icon: AlertOctagon,
    description: 'Something went wrong with this order. Please contact support.',
  },
};

export function getOrderStatusMeta(status: OrderStatus): OrderStatusMeta {
  return ORDER_STATUS_META[status] ?? ORDER_STATUS_META.pending;
}

/* ── Zod cancel schema (matches backend `CancelOrderSchema`) ───────────── */

export const cancelOrderSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, 'Please provide at least 5 characters so we can route this properly')
    .max(500, 'Reason must be 500 characters or fewer'),
});

export type CancelOrderFormValues = z.infer<typeof cancelOrderSchema>;

/* ── ID helpers ────────────────────────────────────────────────────────── */

/** Show the first 8 chars of an order ID, uppercased. */
export function shortOrderId(id: string): string {
  if (!id) return '';
  return id.slice(0, 8).toUpperCase();
}

/* ── Date helpers ──────────────────────────────────────────────────────── */

const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatOrderDate(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  return DATE_FMT.format(d);
}
