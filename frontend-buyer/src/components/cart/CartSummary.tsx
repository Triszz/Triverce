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
  className,
}: CartSummaryProps) {
  const navigate = useNavigate();
  const { totalItems, totalPrice, clear, isClearing } = useCart();

  const handleCheckout = () => {
    if (totalItems === 0) return;
    // Notify host (e.g. the Cart Drawer) so it can close BEFORE we
    // navigate. Doing it in this order means the drawer's close
    // transition starts immediately and the new page is visible
    // behind it as the slide-over animates out.
    onCheckout?.();
    navigate(checkoutHref);
  };

  const handleClear = async () => {
    try {
      await clear();
      toast.success('Cart cleared');
    } catch {
      // Hook has already toasted the error.
    }
  };

  if (totalItems === 0 && !compact) {
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
            <PriceTag value={totalPrice} size="md" />
          </div>
          <div className="flex items-center justify-between">
            <span>Shipping</span>
            <span className="text-slate-500">Calculated at checkout</span>
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
        <PriceTag value={totalPrice} size={compact ? 'md' : 'lg'} className="font-semibold" />
      </div>

      <Button
        variant="primary"
        size="lg"
        fullWidth
        disabled={totalItems === 0}
        onClick={handleCheckout}
      >
        Checkout
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
