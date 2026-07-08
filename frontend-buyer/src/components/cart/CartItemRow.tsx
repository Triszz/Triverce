import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PriceTag } from '@/components/ui/PriceTag';
import { Button } from '@/components/ui/Button';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { useCart } from '@/hooks/useCart';
import type { CartItemPublic } from '@/services/cartService';
import { cn } from '@/lib/cn';

/* ──────────────────────────────────────────────────────────────────────────
 * CartItemRow
 * ──────────────────────────────────────────────────────────────────────── */

export interface CartItemRowProps {
  item: CartItemPublic;
  /** When true, render a more compact layout suitable for the side-drawer. */
  compact?: boolean;
  /**
   * Fired when the user clicks an in-row navigation link (e.g. the
   * product name). The Cart Drawer passes its `close` so the slide-over
   * doesn't obscure the destination page after navigation.
   */
  onNavigate?: () => void;
  className?: string;
}

/**
 * CartItemRow — single line item used by both the slide-over drawer and
 * the full-page cart. Renders:
 *   • Thumbnail (linked to product detail if a slug is known)
 *   • Product name + variant SKU
 *   • Quantity stepper (debounced)
 *   • Subtotal (price × qty)
 *   • Remove button (uses optimistic remove from useCart)
 */
export function CartItemRow({
  item,
  compact = false,
  onNavigate,
  className,
}: CartItemRowProps) {
  const { updateItem, removeItem, isUpdating, isRemoving } = useCart();

  const handleCommit = useMemo(
    () => async (next: number) => {
      try {
        await updateItem(item.id, { quantity: next });
      } catch {
        // Hook already toasted — swallow here so the stepper stays calm.
      }
    },
    [updateItem, item.id],
  );

  const handleRemove = async () => {
    try {
      await removeItem(item.id);
      toast.success(`Removed "${item.productName ?? 'item'}" from cart`);
    } catch {
      // Hook already toasted.
    }
  };

  const productHref = item.productSlug ? `/product/${item.productSlug}` : null;
  const unitPrice = item.price ?? 0;

  return (
    <li
      className={cn(
        'flex gap-3 sm:gap-4 py-4 border-b border-slate-100 last:border-b-0',
        className,
      )}
    >
      {/* Thumbnail */}
      <div
        className={cn(
          'shrink-0 rounded-lg overflow-hidden bg-slate-50 border border-slate-100',
          compact ? 'h-16 w-16' : 'h-20 w-20 sm:h-24 sm:w-24',
        )}
      >
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.productName ?? 'Product image'}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-slate-300 text-lg font-semibold">
            {(item.productName ?? '?').charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Middle column */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {productHref ? (
              <Link
                to={productHref}
                onClick={onNavigate}
                className="block text-sm font-medium text-slate-900 hover:text-[#002b5b] line-clamp-2 transition-colors"
              >
                {item.productName ?? 'Product'}
              </Link>
            ) : (
              <p className="text-sm font-medium text-slate-900 line-clamp-2">
                {item.productName ?? 'Product'}
              </p>
            )}
            {item.sku && (
              <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                {item.sku}
              </p>
            )}
          </div>

          {!compact && (
            <PriceTag value={unitPrice} size="sm" className="shrink-0" />
          )}
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <QuantityStepper
            value={item.quantity}
            max={item.availableStock}
            onCommit={handleCommit}
            onCommitError={() => {
              // No-op: the stepper resets its own draft to `null` on
              // failure so the input snaps back to the server value.
              // TanStack Query's onError in useCart already invalidates
              // the cart query, so item.quantity will update on re-fetch.
            }}
            isPending={isUpdating}
          />

          <PriceTag
            value={item.subtotal}
            size={compact ? 'sm' : 'md'}
            className="font-semibold"
          />
        </div>
      </div>

      {/* Remove (top-right) */}
      <div className="shrink-0 self-start">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRemove}
          disabled={isRemoving}
          aria-label={`Remove ${item.productName ?? 'item'}`}
          className="text-slate-400 hover:text-danger-600 hover:bg-danger-50 -mr-2 -mt-1"
        >
          {isRemoving ? (
            <Loader2 size={14} className="animate-spin" aria-hidden />
          ) : (
            <Trash2 size={14} aria-hidden />
          )}
        </Button>
      </div>
    </li>
  );
}
