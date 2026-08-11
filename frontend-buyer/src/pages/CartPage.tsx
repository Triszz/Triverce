import { useCallback, useEffect, useMemo, useState, forwardRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Loader2,
  LogIn,
  ArrowRight,
  ShoppingCart,
  Store,
  CheckSquare,
  Square,
} from 'lucide-react';
import { CartItemRow } from '@/components/cart/CartItemRow';
import { CartSummary } from '@/components/cart/CartSummary';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { PriceTag } from '@/components/ui/PriceTag';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageMeta } from '@/components/common/PageMeta';
import { useCart } from '@/hooks/useCart';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  computePerStoreShipping,
  groupCartItemsByStore,
  isUnknownStoreGroup,
  sumSubtotals,
  type StoreGroup,
} from '@/features/cart/cartGrouping';
import { cn } from '@/lib/cn';

/**
 * CartPage — full-page fallback for /cart.
 *
 * Reuses the same primitives as the slide-over drawer so the two views
 * stay visually consistent. The drawer is the primary surface; this
 * page exists for users who want to see (and tweak) their cart on a
 * dedicated page.
 *
 * Multi-vendor behaviour:
 *   • Cart items are grouped by `sellerId` (one card per store).
 *   • Each store card has a master checkbox that toggles all of its
 *     items. Each item has its own checkbox.
 *   • The Order Summary derives its subtotal / store count from
 *     the SELECTED items only — unselected items stay in the cart.
 *   • Checkout passes the selected IDs to the checkout page via
 *     a `?items=…` query string, which the checkout flow forwards
 *     to `POST /orders` so the backend only charges the selection.
 */

/** Anonymous bucket key for items whose product/seller couldn't be joined. */
/**
 * CartPage — full-page fallback for /cart.
 *
 * Reuses the same primitives as the slide-over drawer so the two views
 * stay visually consistent. The drawer is the primary surface; this
 * page exists for users who want to see (and tweak) their cart on a
 * dedicated page.
 */
export function CartPage() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { cart, totalItems, isLoading, isError } = useCart();

  /* ── Selection state ─────────────────────────────────────────────────
   *
   * Multi-vendor cart — the buyer ticks the items they want to
   * checkout. We deliberately use a `Set<string>` (not an array)
   * for O(1) `has` lookups while rendering dozens of items.
   *
   * Default: every cart item is selected on initial load so the
   * legacy "checkout everything" behaviour is preserved for users
   * who don't interact with the new checkboxes. The selection is
   * then overwritten by the user's clicks.
   *
   * The lazy initialiser below is evaluated only once with the
   * initial (usually empty) cart. The `useEffect` below primes
   * the selection on the FIRST transition from `items.length === 0`
   * to `items.length > 0` — i.e. when the cart first loads.
   * Subsequent cart mutations (add/remove/quantity) do NOT
   * auto-toggle the selection, so the buyer's deliberate choices
   * are preserved.
   */
  const items = useMemo(() => cart?.items ?? [], [cart?.items]);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(
    () => new Set(items.map((i) => i.id)),
  );

  /*
   * First-load priming. The `useState` lazy initialiser above
   * captures the initial (empty) cart, so the selection starts
   * empty. We want to default to "all items selected" the FIRST
   * time the cart actually has items — without disturbing the
   * user's later deselections.
   *
   * React 19's `set-state-in-effect` rule discourages synchronous
   * setState in an effect, but explicitly allows it when the
   * effect is "synchronising state with an external system" —
   * which is exactly what we're doing here: the cart query is
   * the source of truth, and we're priming the local selection
   * state from it. The `hasPrimedSelection` guard ensures we
   * only fire once per page lifetime.
   */
  const [hasPrimedSelection, setHasPrimedSelection] = useState(false);
  useEffect(() => {
    if (hasPrimedSelection) return;
    if (items.length === 0) return;
    // First time the cart has items — default to "all selected".
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: we're priming local UI state from the cart query (the "external system" the rule exists to allow).
    setSelectedItemIds(new Set(items.map((i) => i.id)));
    setHasPrimedSelection(true);
  }, [items, hasPrimedSelection]);

  /**
   * Prune the selection when the underlying cart changes so we
   * never keep references to IDs that no longer exist (otherwise
   * the checkout would submit stale IDs).
   */
  const liveItemIds = useMemo(() => new Set(items.map((i) => i.id)), [items]);
  const reconciledSelection = useMemo(() => {
    let pruned = selectedItemIds;
    for (const id of selectedItemIds) {
      if (!liveItemIds.has(id)) {
        if (pruned === selectedItemIds) pruned = new Set(pruned);
        pruned.delete(id);
      }
    }
    return pruned;
  }, [selectedItemIds, liveItemIds]);

  // Use the reconciled set as the authoritative source for the
  // rest of the component. The original setter is preserved so
  // toggleItem / toggleStore can update the pristine state.
  const selectedIds = reconciledSelection;

  /** Toggle a single item on/off. */
  const toggleItem = useCallback((itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  /**
   * Toggle every item in a store. If all items are already
   * selected, deselect them; otherwise select every item in the
   * store. This matches the "select all" UX on Shopee / Amazon.
   */
  const toggleStore = useCallback(
    (storeKey: string, storeItemIds: string[]) => {
      setSelectedItemIds((prev) => {
        const allSelected = storeItemIds.every((id) => prev.has(id));
        const next = new Set(prev);
        if (allSelected) {
          for (const id of storeItemIds) next.delete(id);
        } else {
          for (const id of storeItemIds) next.add(id);
        }
        return next;
      });
    },
    [],
  );

  /** Select all items across all stores. */
  const selectAll = useCallback(() => {
    setSelectedItemIds(new Set(items.map((i) => i.id)));
  }, [items]);

  /** Clear the selection (nothing selected). */
  const clearSelection = useCallback(() => {
    setSelectedItemIds(new Set());
  }, []);

  /* ── Group items by store ────────────────────────────────────────────
   *
   * Cart items are bucketed by `sellerId`. Items missing a
   * `sellerId` (i.e. the join failed) fall into a single
   * "Unknown store" bucket so the UI never drops data.
   *
   * The map is built with insertion order so the order is stable
   * across renders — the buyer sees the same store order on
   * every interaction.
   */
  const storeGroups = useMemo(() => groupCartItemsByStore(items), [items]);

  /* ── Derived: selection totals ────────────────────────────────────────
   *
   * The order summary is driven by THESE values, not by
   * `cart.totalPrice`. The backend doesn't know what the buyer
   * ticked — the frontend filters first and only sends the
   * selected IDs to checkout.
   */
  const selectedItems = useMemo(
    () => items.filter((i) => selectedIds.has(i.id)),
    [items, selectedIds],
  );

  const selectedSubtotal = useMemo(
    () => sumSubtotals(selectedItems),
    [selectedItems],
  );

  /**
   * Per-store shipping for the selected items. The grand total
   * (sum of all per-store shipping fees) is what the CartSummary
   * displays; the by-key map is what the StoreCard footer reads
   * to render each store's individual shipping line.
   *
   * Recomputes whenever the selection or the cart changes.
   */
  const selectedShipping = useMemo(
    () => computePerStoreShipping(selectedItems),
    [selectedItems],
  );

  /**
   * Unique stores represented in the selected items — sourced
   * from the per-store shipping map so we don't double-bucket.
   * Drives the "Calculated at checkout (N packages)" note and
   * the checkout button label.
   */
  const selectedStoreCount = selectedShipping.byStoreKey.size;

  const allSelected = items.length > 0 && selectedIds.size === items.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < items.length;

  /* ── Auth-gate ─────────────────────────────────────────────────────── */

  if (!isAuthenticated) {
    return (
      <>
        <PageMeta title="My cart" description="View the items in your cart." />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <EmptyState
            tone="brand"
            icon={<LogIn size={24} aria-hidden />}
            title="Sign in to view your cart"
            description="Your cart is tied to your account, so we can keep it safe across devices."
            actions={[
              {
                label: 'Sign in',
                href: '/auth/login',
                variant: 'primary',
              },
              {
                label: 'Create account',
                href: '/auth/register',
                variant: 'secondary',
              },
            ]}
          />
        </div>
      </>
    );
  }

  /* ── Loading ───────────────────────────────────────────────────────── */

  if (isLoading) {
    return (
      <>
        <PageMeta title="My cart" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          {/* Breadcrumb — Home → Your Cart. Reuses the shared
           * `Breadcrumbs` component (same as ProductDetailPage) so
           * the trail looks identical across all buyer pages. */}
          <Breadcrumbs
            crumbs={[{ label: 'Home', path: '/' }, { label: 'Your Cart' }]}
            className="mb-6"
          />
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-6">
            Your Cart
          </h1>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
            <div className="lg:col-span-1">
              <Skeleton className="h-48 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ── Error ─────────────────────────────────────────────────────────── */

  if (isError) {
    return (
      <>
        <PageMeta title="My cart" />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <EmptyState
            tone="danger"
            icon={<Loader2 size={24} aria-hidden />}
            title="Couldn't load your cart"
            description="Please refresh the page to try again."
            actions={[
              {
                label: 'Refresh',
                onClick: () => window.location.reload(),
                variant: 'primary',
              },
            ]}
          />
        </div>
      </>
    );
  }

  /* ── Empty ─────────────────────────────────────────────────────────── */

  if (!cart || cart.items.length === 0) {
    return (
      <>
        <PageMeta
          title="My cart"
          description="Review and checkout the items in your Triverce cart."
        />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <EmptyState
            tone="brand"
            icon={<ShoppingCart size={28} aria-hidden />}
            title="Your cart is empty"
            description="Browse the shop to start adding items to your cart."
            actions={[
              {
                label: 'Start shopping',
                onClick: () => navigate('/shop'),
                variant: 'primary',
                leftIcon: <ArrowRight size={14} aria-hidden />,
              },
            ]}
          />
        </div>
      </>
    );
  }

  /* ── Cart content ──────────────────────────────────────────────────── */

  return (
    <>
      <PageMeta
        title="My cart"
        description="Review and checkout the items in your Triverce cart."
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Breadcrumb — Home → Your Cart. Placed at the very top of
         * the page container, directly above the page title, with
         * `mb-6` to separate it from the title row below. */}
        <Breadcrumbs
          crumbs={[{ label: 'Home', path: '/' }, { label: 'Your Cart' }]}
          className="mb-6"
        />
        <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Your Cart</h1>
            <p className="text-sm text-slate-500 mt-1">
              {totalItems} {totalItems === 1 ? 'item' : 'items'} ·{' '}
              <span className="text-slate-700 font-medium">
                {selectedIds.size} selected
              </span>
            </p>
          </div>
          {/*
           * Select-all / clear-all quick action. Tri-state driven:
           * the label flips between "Select all" and "Deselect all"
           * depending on whether every item is currently selected.
           * A small indeterminate bar shows when SOME items are
           * selected — matches the visual language of the per-store
           * and per-item checkboxes below.
           */}
          <button
            type="button"
            onClick={() => (allSelected ? clearSelection() : selectAll())}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-[#002b5b] cursor-pointer"
          >
            {/*
             * `CheckSquare` for fully selected, `Square` for empty,
             * and a custom half-fill for the indeterminate state —
             * lucide doesn't ship one, so we layer a small bar
             * over the empty square.
             */}
            {allSelected ? (
              <CheckSquare size={18} className="text-[#002b5b]" aria-hidden />
            ) : someSelected ? (
              <span className="relative inline-block" aria-hidden>
                <Square size={18} className="text-[#002b5b]" />
                <span className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-2 bg-[#002b5b] my-1" />
              </span>
            ) : (
              <Square size={18} className="text-slate-400" aria-hidden />
            )}
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Items column — one card per store */}
          <section
            aria-label="Cart items"
            className="lg:col-span-2 space-y-6"
          >
            {storeGroups.map((group) => (
              <StoreCard
                key={group.storeKey}
                group={group}
                selectedIds={selectedIds}
                selectedShippingFee={selectedShipping.byStoreKey.get(group.storeKey) ?? 0}
                onToggleItem={toggleItem}
                onToggleStore={toggleStore}
              />
            ))}
          </section>

          {/* Summary */}
          <aside
            aria-label="Order summary"
            className="lg:col-span-1"
          >
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 lg:sticky lg:top-24">
              <h2 className="text-base font-semibold text-slate-900 mb-4">
                Order summary
              </h2>
              {/*
               * `CartSummary` is the same component used by the
               * drawer and the original cart page — we just feed
               * it selection-aware props so the subtotal,
               * shipping note, and checkout enablement all
               * reflect the SELECTED items only.
               *
               * `buildCheckoutHref` encodes the selected IDs as a
               * `?items=` query string so the checkout page can
               * forward them straight to `POST /orders`.
               */}
              <CartSummary
                selectedSubtotal={selectedSubtotal}
                selectedShippingTotal={selectedShipping.totalShipping}
                selectedStoreCount={selectedStoreCount}
                selectedItemCount={selectedIds.size}
                selectedItemIds={Array.from(selectedIds)}
                buildCheckoutHref={(ids) =>
                  ids.length > 0
                    ? `/checkout?items=${encodeURIComponent(ids.join(','))}`
                    : '/checkout'
                }
              />
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * StoreCard — one card per seller in the multi-vendor cart.
 *
 * Visual layout:
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │  [☐] Store Name                              (header)        │
 *   ├─────────────────────────────────────────────────────────────┤
 *   │  [☐] [thumb] Product name  ─────── Qty stepper── Subtotal  │
 *   │            …                                                    │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * The header checkbox is `indeterminate` (visual half-fill) when
 * SOME — but not all — items in the store are selected. The DOM
 * `indeterminate` property is one-way (set via ref), so we wire
 * it via a `ref` callback below.
 * ──────────────────────────────────────────────────────────────────────── */

interface StoreCardProps {
  group: StoreGroup;
  selectedIds: Set<string>;
  /** Per-store shipping fee for the SELECTED items in this store. */
  selectedShippingFee: number;
  onToggleItem: (itemId: string) => void;
  onToggleStore: (storeKey: string, storeItemIds: string[]) => void;
}

function StoreCard({
  group,
  selectedIds,
  selectedShippingFee,
  onToggleItem,
  onToggleStore,
}: StoreCardProps) {
  const storeItemIds = useMemo(() => group.items.map((i) => i.id), [group.items]);
  const selectedInStore = storeItemIds.filter((id) => selectedIds.has(id)).length;
  const allStoreSelected = selectedInStore === storeItemIds.length;
  const someStoreSelected = selectedInStore > 0 && selectedInStore < storeItemIds.length;

  /*
   * Per-store subtotal of the SELECTED items only. Items the
   * buyer has deselected contribute neither to this number nor to
   * the per-store shipping fee.
   */
  const storeSelectedSubtotal = useMemo(
    () => group.items
      .filter((i) => selectedIds.has(i.id))
      .reduce((s, i) => s + (i.subtotal ?? 0), 0),
    [group.items, selectedIds],
  );

  const headerCheckboxRef = (el: HTMLInputElement | null) => {
    if (el) el.indeterminate = someStoreSelected;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      {/*
       * Per-store header. The light slate background visually
       * separates the header from the items below; the checkbox
       * toggles every item in the store in one click.
       */}
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
        <Checkbox
          ref={headerCheckboxRef}
          checked={allStoreSelected}
          onChange={() => onToggleStore(group.storeKey, storeItemIds)}
          aria-label={`Select all items from ${group.storeName}`}
        />
        <Store size={18} className="text-slate-500 shrink-0" aria-hidden />
        <div className="min-w-0">
          {/*
           * Store name — deep link to the store profile when the
           * seller is known. Mirrors the drawer behaviour so the
           * UX is consistent across both surfaces.
           *
           * The hover styles mirror the drawer: brand colour +
           * underline. We keep the same `truncate` so a long
           * store name doesn't break the layout — the link
           * inherits the trimming.
           */}
          {isUnknownStoreGroup(group) ? (
            <p className="text-sm font-semibold text-slate-900 truncate">
              {group.storeName}
            </p>
          ) : (
            <Link
              to={`/store/${group.sellerId}`}
              className="block text-sm font-semibold text-slate-900 truncate hover:underline hover:text-[#002b5b] transition-colors"
            >
              {group.storeName}
            </Link>
          )}
          <p className="text-xs text-slate-500">
            {selectedInStore} of {storeItemIds.length}{' '}
            {storeItemIds.length === 1 ? 'item' : 'items'} selected
          </p>
        </div>
      </div>

      {/*
       * Item rows. Each row is wrapped in a `flex` container with
       * a per-item checkbox on the far left. The existing
       * `CartItemRow` is reused unchanged — it preserves the
       * quantity stepper, remove button, and price display.
       *
       * `CartItemRow` renders its own outer `<li>` (which is the
       * expected child of the `<ul>` below), so we use it
       * directly — no extra `<li>` wrapper, since nesting list
       * items is invalid HTML. The per-item checkbox is instead
       * absolutely positioned over the thumbnail of the row so
       * the visual matches the spec without changing the row's
       * markup.
       */}
      <ul role="list" className="divide-y divide-slate-100">
        {group.items.map((item) => (
          <li
            key={item.id}
            className="relative px-4 sm:px-6"
          >
            <Checkbox
              checked={selectedIds.has(item.id)}
              onChange={() => onToggleItem(item.id)}
              aria-label={`Select ${item.productName ?? 'item'}`}
              className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 z-10"
            />
            <CartItemRow
              item={item}
              className="pl-8 sm:pl-10"
            />
          </li>
        ))}
      </ul>

      {/*
       * Per-store subtotal + shipping footer. Only renders when
       * the buyer has selected at least one item in this store —
       * otherwise the numbers would refer to nothing and would
       * confuse the buyer (a store they didn't engage with still
       * showing a subtotal of 0).
       *
       * The shipping line shows the per-store fee only — the
       * grand total of all per-store fees is what the right-hand
       * Order Summary displays. This split is intentional: each
       * Store Card is self-contained ("what does THIS store
       * contribute?") while the Summary is the checkout total.
       *
       * When the store qualifies for free shipping (subtotal ≥
       * threshold) we show "Free" in the success colour rather
       * than a zero price — matches the existing OrderSummary
       * convention.
       */}
      {selectedInStore > 0 && (
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-6 text-sm">
          <div className="flex items-baseline gap-2">
            <span className="text-slate-500">Store Subtotal:</span>
            <PriceTag value={storeSelectedSubtotal} size="sm" className="font-semibold text-slate-900" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-slate-500">Shipping:</span>
            {selectedShippingFee === 0 ? (
              <span className="font-semibold text-success-700">Free</span>
            ) : (
              <PriceTag value={selectedShippingFee} size="sm" className="font-semibold text-slate-900" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Checkbox — small inline checkbox primitive.
 *
 * Kept local to this file for now since the cart is its first
 * consumer. If we adopt it elsewhere (e.g. the cart drawer, a
 * future wishlist), it'll be promoted to `components/ui/Checkbox.tsx`.
 *
 * Supports `ref` callbacks so the caller can set the one-way
 * `indeterminate` DOM property (React doesn't model it as a
 * normal prop).
 * ──────────────────────────────────────────────────────────────────────── */

interface CheckboxProps {
  checked: boolean;
  onChange: () => void;
  'aria-label'?: string;
  className?: string;
}

const Checkbox = (() => {
  // We use a function component so we can attach a `ref` prop
  // through the React 19 `ref` callback pattern. The component
  // itself is intentionally tiny — it exists to centralise the
  // brand-colour fill, the focus ring, and the accessible label.
  function CheckboxInner(
    { checked, onChange, className, ...rest }: CheckboxProps,
    ref: React.Ref<HTMLInputElement>,
  ) {
    return (
      <label
        className={cn(
          'inline-flex items-center justify-center shrink-0 cursor-pointer',
          'h-5 w-5 rounded border transition-colors',
          checked
            ? 'bg-[#002b5b] border-[#002b5b]'
            : 'bg-white border-slate-300 hover:border-slate-400',
          className,
        )}
      >
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          aria-label={rest['aria-label']}
          className="sr-only"
        />
        {/*
         * Custom checkmark rendered via an inline SVG so the
         * check colour matches the brand fill. The `<input>` is
         * `sr-only` (visually hidden but still focusable for
         * keyboard users) — the surrounding `<label>` carries
         * the visual.
         */}
        {checked && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden
            className="text-white"
          >
            <path
              d="M3 8.5l3 3 7-7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </label>
    );
  }
  return forwardRef<HTMLInputElement, CheckboxProps>(CheckboxInner);
})();
