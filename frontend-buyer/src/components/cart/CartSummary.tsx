import { useNavigate } from 'react-router-dom';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { PriceTag } from '@/components/ui/PriceTag';
import { useCart } from '@/hooks/useCart';
import { cn } from '@/lib/cn';

export interface CartSummaryProps {
  /** Compact layout omits free-shipping copy and tightens spacing. */
  compact?: boolean;
  /** Where the checkout button routes. Defaults to /checkout. */
  checkoutHref?: string;
  /**
   * Optional hook fired right before navigating to `checkoutHref`.
   * The Cart Drawer passes its `close` so the slide-over doesn't
   * obscure the destination page after navigation.
   */
  onCheckout?: () => void;
  /**
   * Multi-vendor cart selection — when supplied, the summary's
   * subtotal / total / checkout enablement are driven by the
   * selected items only, not the entire cart. The default behaviour
   * (omitted) is unchanged: total cart subtotal, total cart items.
   */
  selectedSubtotal?: number;
  /**
   * Total shipping across the SELECTED stores — i.e. the SUM of
   * each selected store's per-store shipping fee. Cart-only prop;
   * the drawer (compact=true) doesn't supply it, so its shipping
   * line stays as a friendly note instead of a number.
   */
  selectedShippingTotal?: number;
  /** Number of distinct stores represented in the selected items. */
  selectedStoreCount?: number;
  /** Total selected line-item count (used for the checkout button copy). */
  selectedItemCount?: number;
  /**
   * The IDs of the selected items — required (alongside the
   * selection-mode props above) when `buildCheckoutHref` is
   * supplied. The summary forwards them so the resulting URL
   * encodes the buyer's selection.
   */
  selectedItemIds?: string[];
  /**
   * Optional URL-builder that produces the checkout destination
   * with the selected item IDs encoded. When omitted, the
   * checkout button uses `checkoutHref` as-is. The cart page uses
   * this to forward the selection to the checkout flow.
   */
  buildCheckoutHref?: (ids: string[]) => string;
  className?: string;
}

/**
 * CartSummary — total + Checkout CTA.
 *
 * Renders inside both the slide-over drawer (compact) and the full
 * `/cart` page (expanded with shipping/total breakdown). The summary
 * is also responsible for the "Clear cart" affordance to keep the
 * mutation in a single place.
 */
export function CartSummary({
  compact = false,
  checkoutHref = '/checkout',
  onCheckout,
  selectedSubtotal,
  selectedShippingTotal,
  selectedStoreCount,
  selectedItemCount,
  selectedItemIds,
  buildCheckoutHref,
  className,
}: CartSummaryProps) {
  const navigate = useNavigate();
  const { totalItems, totalPrice, clear, isClearing } = useCart();

  // When the parent supplies selection-aware values, the summary
  // renders those instead of the cart-wide totals. The Cart Page
  // passes these props; the slide-over drawer keeps the original
  // "all items" semantics by leaving them undefined.
  const isSelectionMode = selectedSubtotal !== undefined;
  const displaySubtotal = selectedSubtotal ?? totalPrice;
  const displayItemCount = selectedItemCount ?? totalItems;
  const displayStoreCount = selectedStoreCount ?? 0;
  // Shipping total in selection mode = sum of per-store shippings
  // computed by the parent. 0 in the legacy non-selection mode.
  const displayShippingTotal = selectedShippingTotal ?? 0;
  const displayTotal = displaySubtotal + displayShippingTotal;
  // Checkout is disabled when there are no items to buy. In
  // selection mode that's `selectedItemCount === 0`; otherwise it's
  // `totalItems === 0`.
  const checkoutDisabled = isSelectionMode
    ? displayItemCount === 0
    : totalItems === 0;

  const handleCheckout = () => {
    if (checkoutDisabled) return;
    // Notify host (e.g. the Cart Drawer) so it can close BEFORE we
    // navigate. Doing it in this order means the drawer's close
    // transition starts immediately and the new page is visible
    // behind it as the slide-over animates out.
    onCheckout?.();
    const destination =
      buildCheckoutHref && isSelectionMode && selectedItemIds
        ? buildCheckoutHref(selectedItemIds)
        : checkoutHref;
    navigate(destination);
  };

  const handleClear = async () => {
    try {
      await clear();
      toast.success('Cart cleared');
    } catch {
      // Hook has already toasted the error.
    }
  };

  if (totalItems === 0 && !compact && !isSelectionMode) {
    // On the full page, the empty state is rendered by CartPage itself;
    // CartSummary here only shows the empty footer.
    return null;
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-3',
        compact ? 'w-full' : 'w-full max-w-md ml-auto',
        className,
      )}
    >
      {!compact && (
        <div className="space-y-2 text-sm text-slate-600">
          <div className="flex items-center justify-between">
            <span>Subtotal</span>
            <PriceTag value={displaySubtotal} size="md" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span>Shipping</span>
            {/*
             * Multi-vendor shipping display:
             *   • Selection mode (Cart Page) — render the actual
             *     sum of per-store shipping fees computed by the
             *     parent. The per-store breakdown is shown in each
             *     Store Card; this line is the consolidated total.
             *   • Legacy mode (Drawer / non-selected) — keep the
             *     friendly "Calculated at checkout" note since the
             *     drawer is non-selection-aware.
             *
             * When the consolidated shipping is 0 (i.e. every
             * selected store qualified for free shipping) we show
             * "Free" in the success colour instead of "₫0".
             */}
            {isSelectionMode ? (
              displayShippingTotal === 0 ? (
                <span className="font-semibold text-success-700">Free</span>
              ) : (
                <PriceTag
                  value={displayShippingTotal}
                  size="md"
                  className="font-semibold tabular-nums"
                />
              )
            ) : (
              <span className="text-slate-500 text-right">
                {displayStoreCount > 0
                  ? `Calculated at checkout (${displayStoreCount} ${
                      displayStoreCount === 1 ? 'package' : 'packages'
                    })`
                  : 'Calculated at checkout'}
              </span>
            )}
          </div>
          <div className="border-t border-slate-200 my-2" />
        </div>
      )}

      <div
        className={cn(
          'flex items-center justify-between gap-3',
          compact ? 'text-sm' : 'text-base',
        )}
      >
        <span className={cn('font-medium', compact ? 'text-slate-600' : 'text-slate-900')}>
          {compact ? 'Total' : 'Total'}
        </span>
        <PriceTag
          value={isSelectionMode ? displayTotal : displaySubtotal}
          size={compact ? 'md' : 'lg'}
          className="font-semibold"
        />
      </div>

      <Button
        variant="primary"
        size="lg"
        fullWidth
        disabled={checkoutDisabled}
        onClick={handleCheckout}
      >
        {isSelectionMode && checkoutDisabled
          ? 'Select items to checkout'
          : isSelectionMode && displayItemCount > 0
            ? `Checkout · ${displayItemCount} ${
                displayItemCount === 1 ? 'item' : 'items'
              }`
            : 'Checkout'}
      </Button>

      {!compact && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-500">
            Free shipping on orders over ₫500,000.
          </p>
          <button
            type="button"
            onClick={handleClear}
            disabled={isClearing || totalItems === 0}
            className={cn(
              'inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-danger-600 transition-colors',
              'disabled:opacity-40 disabled:hover:text-slate-500',
            )}
          >
            {isClearing ? (
              <Loader2 size={12} className="animate-spin" aria-hidden />
            ) : (
              <Trash2 size={12} aria-hidden />
            )}
            Clear cart
          </button>
        </div>
      )}
    </div>
  );
}
