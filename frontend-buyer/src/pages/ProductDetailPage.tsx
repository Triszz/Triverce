import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Package,
  ShoppingBag,
  Store,
  Truck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';
import { PriceTag } from '@/components/ui/PriceTag';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { PageMeta } from '@/components/common/PageMeta';
import { cn } from '@/lib/cn';
import {
  productService,
  type ProductVariant,
} from '@/services/productService';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  VariantPicker,
  StockBadge,
} from '@/features/catalog/components/VariantPicker';
import { buildAttributeAxes } from '@/features/catalog/components/variantUtils';
import { useCart } from '@/hooks/useCart';
import { useUiStore } from '@/stores/useUiStore';

/**
 * VND currency formatter — mirrors the one inside `<PriceTag>` so a
 * partially-selected product (where we render a min–max range instead
 * of `<PriceTag>`'s single value) uses identical locale/precision.
 */
const vndFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

/**
 * ProductDetailPage — slug-routed (`/product/:slug`).
 *
 * Uses TanStack Query to fetch the full product (with variants) by slug.
 * The active variant is local component state — selecting a variant updates
 * the displayed image, price, and stock badge instantly.
 *
 * Add-to-Cart is wired to `useCart.addItem`. On a successful mutation the
 * cart drawer slides open so the user can see their item and proceed
 * to checkout; 4xx errors (e.g. out-of-stock) surface as Sonner toasts.
 */
export function ProductDetailPage() {
  const navigate = useNavigate();
  // Param name kept as productId for backwards-compat with the existing
  // route declaration (`/product/:productId`); semantically it's a slug.
  const { productId: slug } = useParams<{ productId: string }>();

  const productQuery = useQuery({
    queryKey: ['product', 'by-slug', slug],
    queryFn: () => {
      if (!slug) throw new Error('Missing product slug');
      return productService.getBySlug(slug);
    },
    enabled: !!slug,
  });

  // Cart hook — gives us `addItem` + `isAdding` loading flag.
  const { addItem, isAdding } = useCart();
  // Auth state — used to guard the add-to-cart flow before attempting
  // any network call so unauthenticated users don't see a spurious
  // success toast when the server rejects the guest request.
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  // Drawer control — open the slide-over on a successful add.
  const openCartDrawer = useUiStore((s) => s.openCartDrawer);

  // Tracks which thumbnail the user has explicitly clicked.
  // Uses a string key so it works for both gallery URLs and variant chip IDs.
  // `null` = no explicit pick — hero follows the selected variant's image.
  const [activeThumbnailKey, setActiveThumbnailKey] = useState<string | null>(null);

  // ── Partial-selection model ────────────────────────────────────────────
  // The page now starts with NO variant selected. The user builds a
  // selection by clicking attribute chips one axis at a time:
  //   { Color: 'Red' }                       → partial — no variant
  //   { Color: 'Red', Size: 'L' }            → full   — resolves to a variant
  // The picker uses this dictionary to compute cross-axis availability
  // dynamically: clicking a Color immediately disables any Size that
  // doesn't pair with that Color. Add-to-cart stays disabled until
  // every axis has been picked.
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  // Add-to-cart quantity — driven entirely by user actions (the
  // quantity stepper's `onCommit`) and reset effects (see below).
  // No bare setState calls live in the render body.
  const [quantity, setQuantity] = useState(1);

  const product = productQuery.data ?? null;

  // ── Axis discovery (memoised) ──────────────────────────────────────────
  // Used by `selectedVariant` derivation AND by `VariantPicker` so the
  // page is the single source of truth for "what axes exist for this
  // product?". Mirrors what `VariantPicker` would otherwise compute
  // internally — but the picker will receive the same memoised result
  // as a prop so the two stay in sync without a second traversal.
  const axes = useMemo(
    () => buildAttributeAxes(product?.variants ?? []),
    [product?.variants],
  );

  // ── Variant resolution ─────────────────────────────────────────────────
  // "Full selection" = every axis in `axes` has a value in `selectedOptions`.
  // When that's true we look for a variant whose attribute map matches
  // ALL keys in `selectedOptions`. Partial / empty selections yield
  // `null` — the page then renders a price range, hides the SKU, and
  // disables the add-to-cart button.
  const selectedVariant = useMemo<ProductVariant | null>(() => {
    if (!product) return null;
    if (axes.length === 0) return null;

    // Defensive: ignore any stale keys in `selectedOptions` that aren't
    // axes for this product. They're harmless — they just don't count
    // toward the "all axes selected" check.
    const filledAxes = axes.filter((a) => selectedOptions[a.name] !== undefined);
    if (filledAxes.length !== axes.length) return null;

    for (const v of product.variants) {
      const attrMap = new Map(v.attributes.map((a) => [a.attributeName, a.value]));
      let matches = true;
      for (const [name, value] of Object.entries(selectedOptions)) {
        if (attrMap.get(name) !== value) {
          matches = false;
          break;
        }
      }
      if (matches) return v;
    }
    // All axes are picked but no exact variant exists (shouldn't happen
    // with well-formed catalogue data — every axis combination the
    // user can build should map to a variant). Returning null keeps
    // the page in the "please select options" state rather than
    // silently picking the wrong SKU.
    return null;
  }, [product, axes, selectedOptions]);

  // Reset the add-to-cart quantity whenever the resolved variant
  // changes — picking (White, S) → (White, M) shouldn't carry a qty
  // of 5 forward into a possibly-incompatible SKU. This used to live
  // in the render body as a synchronous `if (...) setQuantity(1)`
  // block guarded by a ref. That pattern is an anti-pattern: any
  // setState during render schedules a re-render, and if the same
  // condition fires again on the very next render (which React 18
  // strict-mode does via double-invoke), React throws
  // "Too many re-renders". Moved here into a proper effect so the
  // state write only happens after commit, only when the dependency
  // actually changes.
  useEffect(() => {
    if (selectedVariant?.id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuantity(1);
    }
  }, [selectedVariant?.id]);

  // Reset thumbnail + selection when the slug changes so the previous
  // product's picks don't leak into the new one. This used to live in
  // the render body with a `if (slug !== lastSlugRef.current)`
  // synchronous-setState pattern, but that triggered React's
  // "Too many re-renders" hard-cap: each render called setState, which
  // re-rendered, which called setState again…
  //
  // In a `useEffect` the setState runs *after* commit, so it only
  // fires when the dependency actually changes — no loop possible.
  // We depend on `product?.slug` (not the raw `slug` param) so the
  // reset is tied to the product data the page is actually rendering,
  // and we guard with `Object.keys(selectedOptions).length > 0` /
  // `activeThumbnailKey !== null` to avoid a redundant empty→empty
  // state write that would still trigger a second render.
  //
  // We deliberately do NOT also call `setQuantity(1)` here: the
  // `selectedVariant?.id` effect above handles every variant change,
  // including the one triggered by the slug reset (when a new product
  // loads and its first variant resolves, that effect fires once).
  // Calling setQuantity here too would either be a redundant write
  // (still a render) or, worse, fight the other effect over state
  // ownership.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (Object.keys(selectedOptions).length > 0) setSelectedOptions({});
    if (activeThumbnailKey !== null) setActiveThumbnailKey(null);
  }, [product?.slug]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Toggle / merge handler for an attribute chip click.
   *
   * The picker invokes this with the axis name (e.g. "Color") and the
   * clicked value (e.g. "Red"). Chips that would resolve to an
   * out-of-stock combination are rendered with the native `disabled`
   * attribute, so the browser blocks their click events entirely and
   * this callback is never invoked for them. We therefore only have
   * to handle two cases:
   *
   *   1. **Re-clicking the active chip** → that axis is removed from
   *      `selectedOptions`. This is the user's only way to free up
   *      axes when the current selection has "hostaged" the rest of
   *      the picker (e.g. Size: S has Color Red disabled because Red
   *      isn't stocked in S). Without a toggle, the user would be
   *      stuck on a single size with no way to back out — the
   *      conflicting colors can't be force-picked.
   *
   *   2. **Standard pick** → merge the new axis+value into the
   *      existing partial selection. The picker's availability map
   *      guarantees this branch only fires when at least one in-stock
   *      variant matches the resulting combination.
   *
   * We also clear the explicit thumbnail selection on every click so
   * the hero image re-runs through the resolution chain (variant
   * image → first gallery image) and tracks the new selection
   * accurately.
   *
   * Implemented as a `useCallback` so the `<VariantPicker>` (and the
   * chip-onClick closures inside it) don't see a fresh function
   * reference on every render. Must be defined BEFORE any early
   * `return` in the component body so React's hooks rules are
   * satisfied — this is why the handler lives up here with the other
   * hooks, not near the JSX.
   */
  const handleOptionSelect = useCallback(
    (axis: string, value: string) => {
      setActiveThumbnailKey(null);
      setSelectedOptions((prev) => {
        // 1. Toggle off if clicking the active one.
        if (prev[axis] === value) {
          const next = { ...prev };
          delete next[axis];
          return next;
        }

        // 2. Standard valid selection: merge it in. (Conflicting
        // options are blocked at the DOM level by `disabled`, so this
        // branch is only reached for valid picks.)
        return { ...prev, [axis]: value };
      });
    },
    [],
  );

  /* ── Image / thumbnail data ────────────────────────────────────────────── */

  // Build a single deduplicated list of all thumbnail entries for this product.
  // Each entry is either a gallery image (key = URL) or a variant chip (key = variant.id).
  // This eliminates the duplicate-row bug where the same image appeared in both rows.
  const thumbnails = useMemo<Array<{ key: string; url: string | null; variantId?: string }>>(() => {
    if (!product) return [];
    const gallery = product.images ?? [];

    // Variant chips that have their own images and are NOT already in the gallery.
    const gallerySet = new Set(gallery);
    const variantChips = product.variants
      .filter((v) => v.imageUrl && !gallerySet.has(v.imageUrl))
      .map((v) => ({ key: v.id, url: v.imageUrl, variantId: v.id }));

    // Deduplicate the full gallery by URL, then append variant-only chips.
    const seen = new Set<string>();
    const dedupedGallery: typeof thumbnails = [];
    for (const url of gallery) {
      if (!url || seen.has(url)) continue;
      seen.add(url);
      dedupedGallery.push({ key: url, url });
    }

    return [...dedupedGallery, ...variantChips];
  }, [product]);

  // Hero resolution order:
  //   1. Explicit thumbnail click → that thumbnail's image.
  //   2. Selected variant (when fully resolved) has its own image.
  //   3. First thumbnail image.
  //   4. `null` (placeholder).
  // With the partial-selection model, `selectedVariant` is null until
  // every axis is picked — step 2 then falls through to step 3, which
  // shows the product hero until the user makes a choice.
  const heroImage: string | null =
    (activeThumbnailKey !== null && thumbnails.find((t) => t.key === activeThumbnailKey)?.url) ||
    selectedVariant?.imageUrl ||
    thumbnails[0]?.url ||
    null;

  /* ── UI ──────────────────────────────────────────────────────────────── */

  if (productQuery.isLoading) {
    return (
      <>
        <PageMeta title="Loading product…" />
        <DetailSkeleton />
      </>
    );
  }

  if (productQuery.isError || !product) {
    return (
      <>
        <PageMeta title="Product not found" />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center space-y-4">
          <h1 className="text-2xl font-bold text-slate-900">
            Product not found
          </h1>
          <p className="text-slate-500">
            We couldn't find that product. It may have been removed or the link
            is incorrect.
          </p>
          <Button variant="primary" onClick={() => navigate('/shop')}>
            Back to shop
          </Button>
        </div>
      </>
    );
  }

  /* ── Derived data ─────────────────────────────────────────────────────── */

  // Price for the hero price tag:
  //   • Full selection → that variant's price.
  //   • Partial / empty selection → the catalogue's min–max price range
  //     so the buyer can see the spread without us having to commit to
  //     a specific variant.
  const productMinPrice = product?.minPrice ?? 0;
  const productMaxPrice = product?.maxPrice ?? productMinPrice;
  const hasPriceRange =
    !selectedVariant && productMaxPrice > productMinPrice;

  const isOutOfStock =
    !!selectedVariant &&
    (selectedVariant.stockStatus === 'out_of_stock' || !selectedVariant.isActive);

  // Add-to-cart is only enabled once a full variant resolves AND that
  // variant is purchasable. Partial selections are deliberately
  // disabled — the user must explicitly pick every attribute.
  const canAddToCart = !!selectedVariant && !isOutOfStock && !isAdding;

  const handleAddToCart = async () => {
    if (!selectedVariant) {
      // Defensive: the button is disabled in this state, but if a
      // keyboard user manages to activate it anyway we don't want to
      // ship a malformed request.
      toast.error('Please select all product options before adding to cart');
      return;
    }

    // Guard: unauthenticated users must log in before they can add to
    // cart. This check runs BEFORE the API call so the success toast
    // never fires for a failed add. The guard is duplicated here rather
    // than relying on `useCart.addItem`'s own guard because this
    // handler needs an immediate early return to prevent the
    // `openCartDrawer()` call below.
    if (!isAuthenticated) {
      toast.error('Please log in to use the cart');
      navigate('/auth/login', { replace: true });
      return;
    }

    try {
      await addItem({ variantId: selectedVariant.id, quantity });
      toast.success(
        `Added "${product.name}" (${selectedVariant.sku}) to cart`,
      );
      openCartDrawer();
    } catch {
      // useCart already toasted the error (auth or stock message).
    }
  };

  return (
    <>
      <PageMeta
        title={product.name}
        description={product.description ?? `View ${product.name} on Triverce.`}
      />
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <Breadcrumbs
        crumbs={
          product.category
            ? [
                { label: 'Home', path: '/' },
                { label: 'Shop', path: '/shop' },
                { label: product.category.name, path: `/shop?category=${product.category.id}` },
                { label: product.name },
              ]
            : [
                { label: 'Home', path: '/' },
                { label: 'Shop', path: '/shop' },
                { label: product.name },
              ]
        }
        className="mb-6"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Image column — main gallery hero + thumbnail strip */}
        <div className="space-y-3">
          <div className="aspect-square overflow-hidden rounded-2xl bg-slate-50 border border-slate-100 shadow-sm">
            {heroImage ? (
              <img
                key={heroImage /* force re-mount on image swap */}
                src={heroImage}
                alt={product.name}
                // The hero is the LCP element on this page — load it
                // eagerly with high priority. Lazy-loading the LCP
                // image hurts both LCP and Lighthouse.
                loading="eager"
                fetchPriority="high"
                decoding="async"
                className="h-full w-full object-cover transition-opacity duration-300"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-slate-300 text-7xl font-semibold">
                {product.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Single unified thumbnail row — gallery images + variant chips merged into
           * one deduplicated list. Each entry is either a gallery URL or a variant
           * chip. Duplicates (variant image already in gallery) are filtered out. */}
          {thumbnails.length > 1 && (
            <div className="flex flex-wrap gap-2" aria-label="Product gallery">
              {thumbnails.map((thumb) => {
                const isActive = activeThumbnailKey === thumb.key ||
                  (activeThumbnailKey === null && selectedVariant?.imageUrl === thumb.url);
                return (
                  <button
                    key={thumb.key}
                    type="button"
                    onClick={() => {
                      setActiveThumbnailKey(thumb.key);
                      // If this is a variant chip, project its full
                      // attribute set into `selectedOptions`. This is
                      // the "fast-path" UX — the user can pick every
                      // axis at once by clicking the variant image
                      // instead of clicking each chip individually.
                      if (thumb.variantId) {
                        const variant = product.variants.find(
                          (v) => v.id === thumb.variantId,
                        );
                        if (variant) {
                          const next: Record<string, string> = {};
                          for (const attr of variant.attributes) {
                            next[attr.attributeName] = attr.value;
                          }
                          setSelectedOptions(next);
                        }
                      }
                    }}
                    aria-label={
                      thumb.variantId
                        ? `View variant image for ${product.variants.find(v => v.id === thumb.variantId)?.sku}`
                        : `Show image ${thumbnails.indexOf(thumb) + 1} of ${thumbnails.length}`
                    }
                    aria-pressed={isActive}
                    className={`h-16 w-16 rounded-lg overflow-hidden border-2 transition-all duration-150 ${
                      isActive
                        ? 'border-[#002b5b] ring-2 ring-[#002b5b]/30'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {thumb.url ? (
                      <img
                        src={thumb.url}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="h-full w-full flex items-center justify-center text-slate-400 text-xs">
                        {thumb.variantId
                          ? product.variants.find(v => v.id === thumb.variantId)?.sku.slice(-3)
                          : '?'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Details column */}
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">
              {product.name}
            </h1>
            {selectedVariant && (
              <p className="mt-1 text-sm text-slate-500">
                SKU: <span className="font-mono">{selectedVariant.sku}</span>
              </p>
            )}
            {product.storeName && (
              <p className="mt-1.5 text-xs text-slate-500 flex items-center gap-1">
                <Store size={12} className="text-slate-400" aria-hidden />
                Sold by{' '}
                <Link
                  to={`/store/${product.sellerId}`}
                  className="font-medium text-slate-700 hover:text-[#002b5b] hover:underline transition-colors"
                >
                  {product.storeName}
                </Link>
              </p>
            )}
          </div>

          <div className="flex items-baseline gap-3 flex-wrap">
            {selectedVariant ? (
              <>
                <PriceTag value={selectedVariant.price} size="xl" />
                <StockBadge
                  status={selectedVariant.stockStatus}
                  className="ml-1"
                />
              </>
            ) : hasPriceRange ? (
              <p className="text-3xl font-semibold tabular-nums tracking-tight text-slate-900">
                {vndFormatter.format(productMinPrice)}
                <span className="mx-2 text-slate-400 font-normal">–</span>
                {vndFormatter.format(productMaxPrice)}
              </p>
            ) : (
              <PriceTag value={productMinPrice} size="xl" />
            )}
          </div>

          {product.description && (
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              {product.description}
            </p>
          )}

          {product.variants.length > 0 && (
            <div className="border-t border-slate-100 pt-6">
              <VariantPicker
                variants={product.variants}
                selectedOptions={selectedOptions}
                onOptionSelect={handleOptionSelect}
              />
            </div>
          )}

          <div className="border-t border-slate-100 pt-6 space-y-4">
            <div className={cn('flex items-center gap-3', (isOutOfStock || !selectedVariant) && 'opacity-50')}>
              <span className="text-sm font-medium text-slate-700">Qty</span>
              <QuantityStepper
                value={quantity}
                max={selectedVariant?.available}
                disabled={!selectedVariant || isOutOfStock}
                isPending={isAdding}
                onCommit={setQuantity}
                onCommitError={() => setQuantity(1)}
                className="[&_.h-8]:!h-9 [&_.w-8]:!w-9"
              />
            </div>

            <Button
              variant="primary"
              size="lg"
              fullWidth
              isLoading={isAdding}
              disabled={!canAddToCart}
              onClick={handleAddToCart}
              leftIcon={<ShoppingBag size={18} aria-hidden />}
            >
              {!selectedVariant
                ? 'Please select options'
                : isOutOfStock
                ? 'Out of stock'
                : isAdding
                ? 'Adding…'
                : 'Add to cart'}
            </Button>

            {/* Trust badges */}
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-xs text-slate-500">
              <li className="inline-flex items-center gap-2">
                <Truck size={14} className="text-slate-400" aria-hidden />
                Free shipping over ₫500,000
              </li>
              <li className="inline-flex items-center gap-2">
                <Package size={14} className="text-slate-400" aria-hidden />
                7-day easy returns
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Loading state — placeholder for the entire detail layout.
 * ──────────────────────────────────────────────────────────────────────── */

function DetailSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <Skeleton className="h-4 w-24 mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        <Skeleton className="aspect-square w-full rounded-2xl" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-1/2" />
          <SkeletonText lines={3} />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}