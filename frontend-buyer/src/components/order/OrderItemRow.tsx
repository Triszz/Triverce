import { Hash } from 'lucide-react';
import type { OrderItemPublic } from '@/services/orderService';
import { formatVND } from '@/features/checkout/checkout.types';
import { cn } from '@/lib/cn';

/* ──────────────────────────────────────────────────────────────────────────
 * OrderItemRow — a single line in the order detail's "Items" table.
 *
 *   • Product column takes the majority of the row (w-1/2) so long
 *     product names have room to breathe.
 *   • QTY / Unit price / Subtotal are right-aligned and tabular-nums
 *     so the financial columns line up visually.
 *   • Consistent `px-5 py-4` padding on every cell so the contents
 *     never sit flush against the table edges.
 *
 * Designed to be a child of a `<table>` element — the parent card
 * wraps a real <table> for accessibility / column alignment.
 * ──────────────────────────────────────────────────────────────────────── */

export interface OrderItemRowProps {
  item: OrderItemPublic;
  className?: string;
}

export function OrderItemRow({ item, className }: OrderItemRowProps) {
  return (
    <tr
      className={cn(
        'border-b border-slate-100 last:border-b-0',
        'transition-colors hover:bg-slate-50/50',
        className,
      )}
    >
      {/* Product + SKU — left-aligned, ~50% of row width */}
      <td className="w-1/2 py-4 px-5 align-top">
        <p className="text-sm font-medium text-slate-900 leading-snug">
          {item.productName}
        </p>
        <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-500">
          <Hash size={10} aria-hidden />
          <span className="font-mono">{item.variantSku}</span>
        </p>
      </td>

      {/* Quantity — right-aligned */}
      <td className="py-4 px-5 align-top text-right text-sm text-slate-700 tabular-nums whitespace-nowrap">
        ×{item.quantity}
      </td>

      {/* Unit price — right-aligned, muted */}
      <td className="py-4 px-5 align-top text-right text-sm text-slate-500 tabular-nums whitespace-nowrap">
        {formatVND(item.unitPrice)}
      </td>

      {/* Subtotal — right-aligned, bolder */}
      <td className="py-4 px-5 align-top text-right text-sm font-semibold text-slate-900 tabular-nums whitespace-nowrap">
        {formatVND(item.subtotal)}
      </td>
    </tr>
  );
}