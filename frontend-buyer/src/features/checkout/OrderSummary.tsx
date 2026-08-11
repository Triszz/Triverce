import { Link } from 'react-router-dom';
import { Package, ShoppingBag, Store } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PriceTag } from '@/components/ui/PriceTag';
import { cn } from '@/lib/cn';
import {
  computePerStoreShipping,
  groupCartItemsByStore,
  sumSubtotals,
  type StoreGroup,
} from '@/features/cart/cartGrouping';
import type { OrderSummaryProps, PlaceOrderButtonProps } from './checkout.types';

/* ──────────────────────────────────────────────────────────────────────────
 * OrderSummary — checkout sidebar showing what's being purchased and the
 * money math.
 *
 * Multi-vendor behaviour (Shopee / Amazon-style):
 *   • Items are grouped by store; each group has a header.
 *   • Shipping is calculated PER STORE: a store's shipping is 0
 *     when its subtotal reaches the free-shipping threshold, else
 *     it's the standard fee. The grand shipping is the sum.
 *   • The money-math `<dl>` lists every store's subtotal + shipping
 *     so the buyer can audit the total — they're not hidden inside
 *     a single line.
 * ──────────────────────────────────────────────────────────────────────── */

export function OrderSummary({ items, subtotal, action, className }: OrderSummaryProps) {
  /*
   * Per-store bucketing + per-store shipping. Computed off the
   * items array the parent supplies — usually the buyer's
   * selected-and-forwarded slice, in which case these numbers
   * match the cart page exactly. Computing them here keeps the
   * summary self-contained: the parent only needs to pass `items`
   * and `subtotal`.
   */
  const storeGroups = groupCartItemsByStore(items);
  const perStoreShipping = computePerStoreShipping(items);
  const grandShipping = perStoreShipping.totalShipping;
  const total = subtotal + grandShipping;
  /*
   * All selected stores together qualify for free shipping iff
   * EVERY store individually qualifies — in practice a single
   * store that hits the threshold means that store's portion is
   * free, but the buyer still pays for the other stores. We
   * surface the "Free shipping" copy only when the grand shipping
   * is 0 (i.e. all stores either individually qualified, or there
   * aren't any stores at all).
   */
  const grandShippingIsFree = grandShipping === 0 && items.length > 0;

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
            {storeGroups.length > 1 && (
              <>
                <span aria-hidden>·</span>
                <span>
                  {storeGroups.length}{' '}
                  {storeGroups.length === 1 ? 'store' : 'stores'}
                </span>
              </>
            )}
          </span>
        </header>

        {/* Per-store item previews — replaces the flat list with a
         * grouped one so the buyer sees which seller each item
         * comes from. Each group has its own header. */}
        {items.length > 0 ? (
          <div className="divide-y divide-slate-100 border-y border-slate-100 -mx-6">
            {storeGroups.map((group) => (
              <StoreSection
                key={group.storeKey}
                group={group}
                shippingFee={perStoreShipping.byStoreKey.get(group.storeKey) ?? 0}
              />
            ))}
          </div>
        ) : null}

        {/* Money math — grand totals only. The per-store
         * breakdown (each store's subtotal + shipping) now lives
         * inside the matching `StoreSection` above, immediately
         * under the items, so the buyer never has to mentally
         * reconcile a detached "PER STORE" list against the global
         * totals. */}
        <dl className="mt-5 space-y-2 text-sm">
          {/*
           * Grand totals — visually separated from the items
           * above by a top border + extra padding. The border
           * colour matches the existing `border-slate-200` token
           * used on the Total-row divider so the visual language
           * stays consistent with the rest of the checkout
           * surface.
           */}
          <div className="border-t border-slate-200 pt-4 mt-4">
            <div className="flex items-center justify-between">
              <dt className="text-slate-600">Subtotal</dt>
              <dd className="tabular-nums text-slate-900">
                <PriceTag value={subtotal} size="md" />
              </dd>
            </div>
            <div className="flex items-center justify-between mt-2">
              <dt className="text-slate-600">Shipping</dt>
              <dd className="tabular-nums">
                {grandShippingIsFree ? (
                  <span className="text-success-700 font-medium">Free</span>
                ) : (
                  <PriceTag value={grandShipping} size="md" />
                )}
              </dd>
            </div>
          </div>

          {/* Free-shipping nudge — only render when there's an
           * outstanding per-store fee. The nudge points to the
           * smallest gap so the buyer sees the cheapest path to
           * free shipping. */}
          {!grandShippingIsFree && subtotal > 0 && (
            <p className="text-xs text-slate-500 pt-1">
              {/*
                For brevity we use the gap to the threshold from
                the smallest per-store subtotal — that's the store
                most likely to flip to free shipping on the next
                add. (Sum of all gaps would mislead the buyer
                since flipping one store to free doesn't affect
                the others.)
              */}
              {(() => {
                let smallestGap = Number.POSITIVE_INFINITY;
                for (const group of storeGroups) {
                  const storeSubtotal = sumSubtotals(group.items);
                  const storeShipping =
                    perStoreShipping.byStoreKey.get(group.storeKey) ?? 0;
                  if (storeShipping === 0) continue;
                  const gap =
                    500_000 - storeSubtotal > 0 ? 500_000 - storeSubtotal : 0;
                  if (gap < smallestGap) smallestGap = gap;
                }
                if (!Number.isFinite(smallestGap) || smallestGap <= 0) {
                  return null;
                }
                return (
                  <>
                    Add{' '}
                    <span className="font-semibold text-slate-700">
                      <PriceTag
                        value={smallestGap}
                        size="sm"
                        className="inline"
                      />
                    </span>{' '}
                    more to a store to qualify for free shipping on that order.
                  </>
                );
              })()}
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
 * StoreSection — visual block for a single store inside OrderSummary.
 *
 *   ┌─────────────────────────────────────────┐
 *   │ 🏪 Store Name                           │   ← header
 *   ├─────────────────────────────────────────┤
 *   │ [thumb] Product · Qty 2          ₫X     │   ← items
 *   │ [thumb] Product · Qty 1          ₫Y     │
 *   ├─────────────────────────────────────────┤
 *   │ Store subtotal               ₫X+Y       │   ← footer
 *   │ Store shipping             Free / ₫Z   │
 *   └─────────────────────────────────────────┘
 *
 * The footer mirrors the buyer-familiar Shopee / Amazon pattern
 * (per-seller subtotal + per-seller shipping stacked under the
 * items). Placing these inside the store block keeps the
 * per-store math visually attached to the items it describes —
 * no detached "PER STORE" recap at the bottom of the summary.
 * ──────────────────────────────────────────────────────────────────────── */

interface StoreSectionProps {
  group: StoreGroup;
  /** Per-store shipping fee, pre-computed by the parent. */
  shippingFee: number;
}

function StoreSection({ group, shippingFee }: StoreSectionProps) {
  const storeSubtotal = sumSubtotals(group.items);
  const storeFree = shippingFee === 0;
  /*
   * VND formatter — kept local because StoreSection owns the
   * visual contract for this footer (label + value, slate-600 +
   * slate-900 / emerald-600). Reusing the global `PriceTag` would
   * add wrapper chrome and a different size token, breaking the
   * tight two-row layout the design calls for.
   */
  const formatMoney = (value: number) =>
    new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(value);

  return (
    <section className="px-6 py-3 first:pt-4 last:pb-4">
      <header className="flex items-center justify-between gap-2 mb-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <Store size={12} className="text-slate-500" aria-hidden />
          <span className="truncate">{group.storeName}</span>
        </span>
        {/*
         * The header used to render the shipping fee as an inline
         * chip (e.g. "Free shipping" or a PriceTag). The fee now
         * lives in the Store Footer below — colocating it with
         * the subtotal removes the redundant header badge and
         * keeps each store's money math in one place.
         */}
      </header>
      <ul role="list" className="space-y-2">
        {group.items.map((item) => (
          <li key={item.id} className="flex items-start gap-3 py-1.5">
            <div className="h-10 w-10 shrink-0 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.productName ?? ''}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <ShoppingBag size={16} className="text-slate-400" aria-hidden />
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

      {/*
       * Store footer — placed directly under the items list with
       * a thin top border so the eye parses it as "this store's
       * subtotal + shipping" rather than a continuation of the
       * line items. The two rows use identical layout
       * (`flex justify-between`) so they read as a pair.
       *
       * "Free" is rendered in emerald-600 when the store
       * qualifies for free shipping — matches the user-supplied
       * design language and gives the buyer a positive
       * affirmation rather than just hiding the cost.
       */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-1.5 text-sm">
        <div className="flex justify-between text-slate-600">
          <span>Store subtotal</span>
          <span className="font-medium text-slate-900 tabular-nums">
            {formatMoney(storeSubtotal)}
          </span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>Store shipping</span>
          <span
            className={
              storeFree
                ? 'text-emerald-600 font-medium'
                : 'font-medium text-slate-900 tabular-nums'
            }
          >
            {storeFree ? 'Free' : formatMoney(shippingFee)}
          </span>
        </div>
      </div>
    </section>
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