import type { CartItemPublic } from '@/services/cartService';
import {
  deriveShippingFee,
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_FEE,
} from '@/features/checkout/checkout.types';

/**
 * Shared cart-bucketing helpers used by every multi-vendor cart
 * surface (Cart Page, Cart Drawer, Checkout Page).
 *
 * Keeping the logic in one module prevents the three views from
 * drifting out of sync — the user sees the same store groupings
 * everywhere, with the same shipping math.
 *
 * ── Multi-vendor shipping policy ────────────────────────────────────────
 *
 * Shipping is calculated **per store**, NOT against the grand total.
 * If Store A's subtotal is ≥ FREE_SHIPPING_THRESHOLD, Store A's
 * shipping is 0; otherwise it's SHIPPING_FEE. The grand shipping is
 * the sum of the per-store shippings — so an order with three
 * small stores can pay up to 3 × SHIPPING_FEE in shipping even if
 * no single store qualifies for free shipping.
 *
 * This mirrors the real-world behaviour on Shopee / Amazon: each
 * seller ships their own package, and the threshold applies to the
 * seller's basket, not yours.
 */

/** Unknown-store bucket key for items whose product/seller couldn't be joined. */
export const UNKNOWN_STORE_KEY = '__unknown__';

/** Display name for items that don't have a seller attached. */
export const UNKNOWN_STORE_NAME = 'Unknown store';

/**
 * Bucketed cart items, one entry per storefront. Insertion order
 * is preserved across renders — the user sees the same store
 * order on every interaction.
 */
export interface StoreGroup {
  /** Stable grouping key — `sellerId` when known, else `UNKNOWN_STORE_KEY`. */
  storeKey: string;
  /**
   * The actual seller UUID, when the underlying items carry one.
   * `null` for the "Unknown store" bucket (items whose product
   * join failed server-side). Use this to build a deep link to
   * the store profile page — `storeKey` is for grouping math,
   * `sellerId` is for routing.
   */
  sellerId: string | null;
  /** Human display name — `storeName` when known, else `UNKNOWN_STORE_NAME`. */
  storeName: string;
  items: CartItemPublic[];
}

/**
 * True when a group is the "Unknown store" fallback bucket.
 * Items end up here when their product/seller join failed on
 * the backend, so the UI must NOT render a `/store/:id` link for
 * them — there's no profile to navigate to.
 */
export function isUnknownStoreGroup(group: StoreGroup): boolean {
  return group.sellerId === null;
}

/**
 * Group cart items by seller. Items missing a `sellerId` fall
 * into a single "Unknown store" bucket so the UI never drops
 * data.
 *
 * Pure function — same input produces the same output. Safe to
 * call inside `useMemo` with `items` as the only dependency.
 */
export function groupCartItemsByStore(items: CartItemPublic[]): StoreGroup[] {
  const order: string[] = [];
  const map = new Map<string, StoreGroup>();
  for (const item of items) {
    const key = item.sellerId ?? UNKNOWN_STORE_KEY;
    let group = map.get(key);
    if (!group) {
      const fallbackName = item.storeName ?? UNKNOWN_STORE_NAME;
      group = {
        storeKey: key,
        // `null` for the unknown bucket so the UI can choose not
        // to render a link. For real stores, the FIRST item's
        // `sellerId` is the seller UUID — every item in the group
        // shares it (that's the grouping criterion).
        sellerId: item.sellerId ?? null,
        storeName: fallbackName,
        items: [],
      };
      map.set(key, group);
      order.push(key);
    }
    group.items.push(item);
  }
  return order.map((k) => map.get(k)!);
}

/**
 * Sum the subtotals of a list of cart items. Treats `subtotal` as
 * 0 when undefined (older cart payloads / items whose price was
 * never populated server-side).
 */
export function sumSubtotals(items: CartItemPublic[]): number {
  return items.reduce((s, i) => s + (i.subtotal ?? 0), 0);
}

/**
 * Per-store shipping + the grand total of all per-store shippings.
 *
 * The grand total is the sum of individual store shippings — see
 * the policy note at the top of this file for why we DON'T compute
 * it against the grand subtotal.
 *
 * `byStoreKey` is keyed by the same `storeKey` returned from
 * `groupCartItemsByStore`, so consumers can correlate the two
 * without re-deriving the key.
 */
export interface PerStoreShipping {
  /** Shipping fee for each store, keyed by `storeKey`. */
  byStoreKey: Map<string, number>;
  /** Sum of every entry in `byStoreKey`. */
  totalShipping: number;
}

/**
 * Compute per-store shipping for a list of items. Items are
 * grouped internally by `sellerId`; the result exposes the
 * shipping fee for each group and the grand total.
 *
 * Use `groupCartItemsByStore` first if you also need the items
 * bucketed for rendering — this function does its own bucketing
 * to keep its contract simple.
 */
export function computePerStoreShipping(items: CartItemPublic[]): PerStoreShipping {
  const order: string[] = [];
  const subtotalsByKey = new Map<string, number>();
  for (const item of items) {
    const key = item.sellerId ?? UNKNOWN_STORE_KEY;
    if (!subtotalsByKey.has(key)) {
      subtotalsByKey.set(key, 0);
      order.push(key);
    }
    subtotalsByKey.set(key, (subtotalsByKey.get(key) ?? 0) + (item.subtotal ?? 0));
  }

  const byStoreKey = new Map<string, number>();
  let totalShipping = 0;
  for (const key of order) {
    const subtotal = subtotalsByKey.get(key) ?? 0;
    const fee = deriveShippingFee(subtotal);
    byStoreKey.set(key, fee);
    totalShipping += fee;
  }
  return { byStoreKey, totalShipping };
}

/* ── Re-exports for ergonomics ─────────────────────────────────────────────
 *
 * Surface the shipping policy constants from this file too so
 * consumers can `import { FREE_SHIPPING_THRESHOLD } from
 * '@/features/cart/cartGrouping'` without juggling two modules.
 */
export { SHIPPING_FEE, FREE_SHIPPING_THRESHOLD, deriveShippingFee };