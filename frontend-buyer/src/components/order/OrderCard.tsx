import { Link } from 'react-router-dom';
import { ChevronRight, Package, Calendar, Box } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { formatVND } from '@/features/checkout/checkout.types';
import {
  getOrderStatusMeta,
  shortOrderId,
  formatOrderDate,
  type OrderStatus,
} from '@/features/orders/orders.types';
import type { OrderPublic } from '@/services/orderService';
import { cn } from '@/lib/cn';

/* ──────────────────────────────────────────────────────────────────────────
 * OrderCard — single row in the "My orders" list.
 *
 * Renders a clickable card that surfaces:
 *   • Short order ID + creation timestamp
 *   • Semantic status badge
 *   • Total amount (VND) + item count
 *
 * Navigation: the whole card is a link to /orders/:id; the chevron
 * mirrors the affordance and the `aria-label` makes the link's target
 * explicit for screen readers.
 * ──────────────────────────────────────────────────────────────────────── */

export interface OrderCardProps {
  order: OrderPublic;
  className?: string;
}

export function OrderCard({ order, className }: OrderCardProps) {
  const meta = getOrderStatusMeta(order.status as OrderStatus);
  const StatusIcon = meta.icon;
  const itemCount = order.items.reduce((sum, it) => sum + it.quantity, 0);

  return (
    <Link
      to={`/orders/${order.id}`}
      aria-label={`View order ${shortOrderId(order.id)}`}
      className={cn(
        'group block rounded-xl border border-slate-100 bg-white shadow-sm p-5',
        'transition-all duration-200 ease-out',
        'hover:shadow-md hover:-translate-y-0.5 hover:border-slate-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#002b5b] focus-visible:ring-offset-2',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: order ID + meta */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-mono text-sm font-semibold text-slate-900">
              #{shortOrderId(order.id)}
            </span>
            <Badge tone={meta.tone} size="sm">
              <StatusIcon size={11} aria-hidden />
              {meta.label}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Calendar size={12} aria-hidden />
              {formatOrderDate(order.createdAt)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Box size={12} aria-hidden />
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </span>
          </div>
        </div>

        {/* Right: amount + chevron */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
              Total
            </p>
            <p className="text-base font-bold text-slate-900 tabular-nums">
              {formatVND(order.totalAmount)}
            </p>
          </div>
          <ChevronRight
            size={18}
            aria-hidden
            className="text-slate-300 group-hover:text-[#002b5b] group-hover:translate-x-0.5 transition-all"
          />
        </div>
      </div>

      {/* Item preview chips — first 3 line items as small pills */}
      {order.items.length > 0 && (
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <Package size={12} className="text-slate-400 shrink-0" aria-hidden />
          <span className="text-xs text-slate-500 truncate">
            {order.items
              .slice(0, 3)
              .map((it) => it.productName)
              .join(' · ')}
            {order.items.length > 3 && (
              <span className="text-slate-400">
                {' '}
                +{order.items.length - 3} more
              </span>
            )}
          </span>
        </div>
      )}
    </Link>
  );
}
