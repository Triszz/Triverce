import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import type { OrderItemPublic } from '@/services/orderService';
import { formatVND } from '@/features/checkout/checkout.types';
import { cn } from '@/lib/cn';

/* ──────────────────────────────────────────────────────────────────────────
 * OrderItemRow — a single line in the order detail's "Items" section.
 *
 * The original implementation was a `<table>` row with 4 columns
 * (Product / Qty / Unit price / Subtotal). After the UI/UX upgrade
 * that added product thumbnails, clickable product names, and a
 * variant attribute line, the table layout started fighting the
 * content (long names + images + variant captions rarely fit a
 * rigid 4-column grid on tablet breakpoints). This rewrite drops
 * the table for a flex-row layout that keeps the same visual
 * hierarchy while accommodating the extra cells.
 *
 *   [thumb] [name + variant + qty, flex-1]   [unit] [qty] [subtotal]
 *
 * The component no longer renders a `<tr>`; the parent renders a
 * `<div role="list">` of these rows.
 * ──────────────────────────────────────────────────────────────────────── */

export interface OrderItemRowProps {
  item: OrderItemPublic;
  className?: string;
}

/* Format variant attributes for the caption line, e.g.
 * "Color: Red, Size: M". Returns null when the item has no
 * attributes so the line is omitted entirely. */
function formatVariantAttributes(
  attributes: OrderItemPublic['attributes'],
): string | null {
  if (!attributes || attributes.length === 0) return null;
  return attributes
    .map((a) => `${a.name.charAt(0).toUpperCase() + a.name.slice(1)}: ${a.value}`)
    .join(', ');
}

export function OrderItemRow({ item, className }: OrderItemRowProps) {
  const variantCaption = formatVariantAttributes(item.attributes);
  // Product link target — falls back to the cart page when the
  // slug is missing (e.g. legacy orders from before this field
  // was added). `to="#" + e.preventDefault()` keeps the row
  // looking like a link without an actual navigation.
  const productHref = item.productSlug
    ? `/product/${item.productSlug}`
    : null;

  return (
    <div
      role="listitem"
      className={cn(
        'flex flex-wrap items-start gap-4 py-4 px-5',
        'border-b border-slate-100 last:border-b-0',
        'transition-colors hover:bg-slate-50/50',
        className,
      )}
    >
      {/* Thumbnail — square, light border, falls back to a
       * neutral icon when no image is available. */}
      <div
        className={cn(
          'h-20 w-20 shrink-0 rounded-md border border-slate-200 bg-slate-50',
          'overflow-hidden flex items-center justify-center',
        )}
      >
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.productName}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <ShoppingBag size={24} className="text-slate-400" aria-hidden />
        )}
      </div>

      {/* Name + variant + qty — flex-1 so it claims the leftover
       * horizontal space. Truncate keeps long names tidy. */}
      <div className="min-w-0 flex-1">
        {productHref ? (
          <Link
            to={productHref}
            className={cn(
              'text-base font-semibold text-slate-900 leading-snug',
              'hover:text-brand-600 transition-colors line-clamp-2',
            )}
          >
            {item.productName}
          </Link>
        ) : (
          <p className="text-base font-semibold text-slate-900 leading-snug line-clamp-2">
            {item.productName}
          </p>
        )}
        {variantCaption && (
          <p className="mt-1 text-sm text-slate-500">{variantCaption}</p>
        )}
        <p className="mt-1 text-sm text-slate-500">Qty {item.quantity}</p>
      </div>

      {/* Unit price + subtotal — right-aligned, tabular so the
       * numbers line up across rows. On narrow screens the
       * financial cells wrap to a second visual line (parent is
       * `flex-wrap`) so we never clip the totals. */}
      <div className="ml-auto flex flex-col items-end gap-1 whitespace-nowrap">
        <p className="text-base text-slate-500 tabular-nums">
          {formatVND(item.unitPrice)}
        </p>
        <p className="text-base font-bold text-slate-900 tabular-nums">
          {formatVND(item.subtotal)}
        </p>
      </div>
    </div>
  );
}
