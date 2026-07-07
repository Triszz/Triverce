import { Link } from 'react-router-dom';
import { Package, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PriceTag } from '@/components/ui/PriceTag';
import { cn } from '@/lib/cn';
import {
  deriveShippingFee,
  FREE_SHIPPING_THRESHOLD,
  type OrderSummaryProps,
  type PlaceOrderButtonProps,
} from './checkout.types';

/* ──────────────────────────────────────────────────────────────────────────
 * OrderSummary — checkout sidebar showing what's being purchased and the
 * money math. The fee policy + currency helpers live in
 * `checkout.types.ts` so this file can stay focused on JSX (and keep
 * the `react-refresh/only-export-components` rule happy).
 * ──────────────────────────────────────────────────────────────────────── */

export function OrderSummary({ items, subtotal, action, className }: OrderSummaryProps) {
  const shipping = deriveShippingFee(subtotal);
  const total = subtotal + shipping;
  const qualifiesForFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;

  return (
    <aside
      aria-label="Order summary"
      className={cn(
        'bg-white rounded-xl border border-slate-100 shadow-sm',
        'lg:sticky lg:top-24',
        className,
      )}
    >
      <div className="p-6">
        <header className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900">Order summary</h2>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
            <Package size={13} aria-hidden />
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
        </header>

        {/* Line-item preview */}
        {items.length > 0 && (
          <ul role="list" className="divide-y divide-slate-100 border-y border-slate-100 -mx-6 px-6">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-3 py-3"
              >
                <div className="h-12 w-12 shrink-0 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.productName ?? ''}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ShoppingBag size={18} className="text-slate-400" aria-hidden />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {item.productName ?? 'Product'}
                  </p>
                  <p className="text-xs text-slate-500">Qty {item.quantity}</p>
                </div>
                <PriceTag
                  value={item.subtotal}
                  size="sm"
                  className="font-medium tabular-nums"
                />
              </li>
            ))}
          </ul>
        )}

        {/* Money math */}
        <dl className="mt-5 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-slate-600">Subtotal</dt>
            <dd className="tabular-nums text-slate-900">
              <PriceTag value={subtotal} size="md" />
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-slate-600">Shipping</dt>
            <dd className="tabular-nums">
              {shipping === 0 ? (
                <span className="text-success-700 font-medium">Free</span>
              ) : (
                <PriceTag value={shipping} size="md" />
              )}
            </dd>
          </div>

          {/* Free-shipping nudge */}
          {!qualifiesForFreeShipping && subtotal > 0 && (
            <p className="text-xs text-slate-500 pt-1">
              Add{' '}
              <span className="font-semibold text-slate-700">
                <PriceTag
                  value={FREE_SHIPPING_THRESHOLD - subtotal}
                  size="sm"
                  className="inline"
                />
              </span>{' '}
              more to qualify for free shipping.
            </p>
          )}

          <div className="border-t border-slate-200 pt-3 mt-3">
            <div className="flex items-baseline justify-between">
              <dt className="text-base font-semibold text-slate-900">Total</dt>
              <dd className="tabular-nums">
                <PriceTag value={total} size="xl" className="font-bold text-slate-900" />
              </dd>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Taxes included. Final amount is computed at order confirmation.
            </p>
          </div>
        </dl>

        {action && <div className="mt-6">{action}</div>}

        <p className="mt-4 text-center text-xs text-slate-500">
          Need to tweak the cart?{' '}
          <Link
            to="/cart"
            className="font-medium text-[#002b5b] hover:text-[#001f3f] underline-offset-2 hover:underline"
          >
            Back to cart
          </Link>
        </p>
      </div>
    </aside>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Convenience action component — a fully-styled "Place Order" button that
 * callers can drop straight into <OrderSummary action={…} />.
 * ──────────────────────────────────────────────────────────────────────── */

export function PlaceOrderButton({
  isLoading,
  disabled,
  label = 'Place order',
  loadingLabel = 'Placing order…',
  onSubmit,
}: PlaceOrderButtonProps) {
  return (
    <Button
      type="submit"
      variant="primary"
      size="lg"
      fullWidth
      isLoading={isLoading}
      disabled={disabled}
      onClick={onSubmit}
    >
      {isLoading ? loadingLabel : label}
    </Button>
  );
}