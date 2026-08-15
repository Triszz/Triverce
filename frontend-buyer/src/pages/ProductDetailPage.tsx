import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  Mail,
  MapPin,
  Package,
  Phone,
  ShoppingBag,
  Truck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';
import { PriceTag } from '@/components/ui/PriceTag';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { ZoomableLightbox } from '@/components/ui/ZoomableLightbox';
import { PageMeta } from '@/components/common/PageMeta';
import { cn } from '@/lib/cn';
import {
  productService,
  type ProductVariant,
} from '@/services/productService';
import { useStoreProfile } from '@/hooks/useStoreProfile';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  VariantPicker,
  StockBadge,
} from '@/features/catalog/components/VariantPicker';
import { buildAttributeAxes } from '@/features/catalog/components/variantUtils';
import { useCart } from '@/hooks/useCart';
import { useUiStore } from '@/stores/useUiStore';
import { ProductRatings } from '@/features/reviews/components/ProductRatings';

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

  // The store info card surfaces the seller's public profile (logo,
  // joined date, product count, contact info). We piggy-back on the
  // product query's data so the card only fetches once the product
  // has resolved — no competing spinner on initial page load. The
  // hook itself uses a 60s staleTime so subsequent product pages
  // that share the same seller (common in catalogues) hit the cache.
  const storeQuery = useStoreProfile(productQuery.data?.sellerId ?? '');

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
  // Toggle for the full-screen <ZoomableLightbox> overlay. The lightbox
  // is mounted conditionally at the bottom of the component so it
  // portals over the entire page (including the existing layout).
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

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
              <button
                type="button"
                onClick={() => setIsLightboxOpen(true)}
                aria-label={`Zoom product image: ${product.name}`}
                className="block w-full h-full cursor-zoom-in hover:opacity-90 transition-opacity"
              >
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
                  className="h-full w-full object-cover"
                />
              </button>
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

      {/* Store info card — live below the main product layout. Drives
       * its own `useStoreProfile` query so the seller metadata loads
       * independently of the product detail. Hides entirely until the
       * product has resolved (no flash of empty seller header). */}
      <StoreInfoCard
        sellerId={product.sellerId}
        fallbackStoreName={product.storeName}
        storeQuery={storeQuery}
      />

      {/* Product description card — seller-authored plain-text blob
       * (validated at the API layer by `z.string().max(5000).trim()`).
       * Rendered only when the description is non-empty so a seller
       * who hasn't filled one in doesn't show an empty card. The `mt-8`
       * vertical rhythm matches the spacing between the Store Info
       * Card and the page wrapper below. */}
      {product.description && product.description.trim().length > 0 && (
        <ProductDescriptionCard description={product.description} />
      )}

      {/* Ratings & Reviews — public listing fed by GET
       * /api/reviews/product/:id. Mounted after the description so the
       * natural reading flow is: image + price + variants → store →
       * description → social proof. Hides entirely while the product
       * query is still loading (the parent page already gates on
       * `productQuery.isPending`, so we're safe to render here). */}
      <ProductRatings productId={product.id} />

      {/* Full-screen zoom overlay — reused from the cart modal. The `key`
       * remounts the component on every open, which gives us a fresh
       * 1x / centred view without needing an effect to reset state. */}
      {heroImage && (
        <ZoomableLightbox
          key={isLightboxOpen ? 'open' : 'closed'}
          src={heroImage}
          alt={product.name}
          open={isLightboxOpen}
          onClose={() => setIsLightboxOpen(false)}
        />
      )}
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
      {/* Store info card placeholder — mirrors the size of the real
       * card so the page doesn't jump when the data resolves. */}
      <Skeleton className="mt-12 h-32 w-full rounded-2xl" />
      {/* Description card placeholder — `h-64` (256px) roughly
       * matches the height of a 4–5 line description at `text-base`.
       * The card is conditionally rendered so this skeleton is only
       * visible while the product query is loading; the eventual
       * decision to show/hide the real card is driven by the
       * description's content (see ProductDescriptionCard). */}
      <Skeleton className="mt-8 h-64 w-full rounded-2xl" />
      {/* Reviews placeholder — `h-96` (384px) covers the summary
       * header + star breakdown bars + the first few review rows on
       * a populated product. The reviews card is always rendered (no
       * conditional guard), so this skeleton is always present while
       * loading. */}
      <Skeleton className="mt-8 h-96 w-full rounded-2xl" />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Store info card — surfaces the seller's public storefront profile
 * below the main product layout.
 * ──────────────────────────────────────────────────────────────────────── */

/** Type alias for the `useStoreProfile` query result. Centralised so
 * the `StoreInfoCard` prop type stays in sync with the hook. */
type StoreQueryResult = ReturnType<typeof useStoreProfile>;

interface StoreInfoCardProps {
  sellerId: string;
  /** Denormalised store name from the product payload. Used as a
   * fallback while the seller profile is still loading, so the
   * "View Shop" link is never blank. */
  fallbackStoreName?: string | null;
  storeQuery: StoreQueryResult;
}

/**
 * Render a polished "Store Info Card" with two distinct areas:
 *   • Left   — store identity (avatar + name + "View Shop" CTA).
 *   • Right  — store stats grid (joined date, product count, contact).
 *
 * The card degrades gracefully:
 *   • Loading state → left shows the denormalised `product.storeName`
 *     immediately + a small spinner; right shows skeletons.
 *   • Error state → "--" placeholders for the right-side stats so the
 *     layout is preserved (matches the user's "Products: -- / Joined:
 *     --" placeholder request).
 *   • Loaded state → full store profile rendered with the resolved
 *     fields. Fields the seller hasn't set (`phone`, `address`) are
 *     omitted from the grid so we don't show 4 "Unknown" rows.
 */
function StoreInfoCard({
  sellerId,
  fallbackStoreName,
  storeQuery,
}: StoreInfoCardProps) {
  // Treat the seller profile as still loading until the query has
  // resolved once — `isPending` (TanStack Query v5) is true only on
  // the very first fetch, so background refetches don't trigger a
  // flash of "—".
  const store = storeQuery.data;
  const isLoading = storeQuery.isPending;
  const isError = storeQuery.isError;

  // Display name: prefer the resolved store name, fall back to the
  // denormalised product payload, then a generic "This shop".
  const displayName =
    store?.storeName?.trim() ||
    fallbackStoreName?.trim() ||
    'This shop';

  // First letter, uppercased, used as the avatar fallback when the
  // seller hasn't uploaded a logo. Strip emoji / non-letter chars so
  // the fallback doesn't render a black box.
  const initial = displayName
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .charAt(0)
    .toUpperCase() || '?';

  // Stats grid entries. Each entry is conditionally rendered based on
  // whether the seller has populated the underlying field — we don't
  // show empty rows for missing data (cleaner, less "Unknown" noise).
  //
  // Icons are size {16} (one step up from the previous 14) so the
  // stroke weight keeps visual parity with the upcoming `text-sm`
  // labels and `text-base` values. Belt-and-braces colour the icon
  // container directly so a future caller can pass any icon without
  // also being responsible for tinting it.
  const statEntries: Array<{ icon: React.ReactNode; label: string; value: string }> = [];
  if (store) {
    if (store.joinedAt) {
      statEntries.push({
        icon: <CalendarDays size={16} aria-hidden />,
        label: 'Joined',
        value: formatJoinedDate(store.joinedAt),
      });
    }
    statEntries.push({
      icon: <Package size={16} aria-hidden />,
      label: 'Products',
      value: isLoading ? '--' : String(store.productCount ?? 0),
    });
    if (store.supportEmail) {
      statEntries.push({
        icon: <Mail size={16} aria-hidden />,
        label: 'Email',
        value: store.supportEmail,
      });
    }
    if (store.phone) {
      statEntries.push({
        icon: <Phone size={16} aria-hidden />,
        label: 'Phone',
        value: store.phone,
      });
    }
    if (store.address) {
      statEntries.push({
        icon: <MapPin size={16} aria-hidden />,
        label: 'Address',
        value: store.address,
      });
    }
  } else if (isError) {
    // No data + error → show "—" placeholders so the card layout
    // still communicates the existence of the seller (and the View
    // Shop button still works, since we already have the sellerId).
    statEntries.push(
      { icon: <CalendarDays size={16} aria-hidden />, label: 'Joined', value: '--' },
      { icon: <Package size={16} aria-hidden />, label: 'Products', value: '--' },
    );
  } else {
    // Loading state — show skeleton rows so the right side doesn't
    // pop in empty when the data resolves.
    statEntries.push(
      { icon: <CalendarDays size={16} aria-hidden />, label: 'Joined', value: '--' },
      { icon: <Package size={16} aria-hidden />, label: 'Products', value: '--' },
    );
  }

  return (
    <section
      aria-label="Store information"
      className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mt-12"
    >
      <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-center md:items-stretch">
        {/* Left side: identity + CTA. Vertical divider on desktop so the
         * two halves read as distinct units without a heavier border.
         *
         * `md:min-w-[280px]` keeps the identity block from collapsing
         * to its content width (which left a huge empty gutter on the
         * far right of the card). Combined with `md:flex-none` and
         * `md:border-r md:pr-8`, the left column now occupies a
         * predictable slice of the card while the right-side stats grid
         * `flex-1`-expands to fill the remainder. */}
        <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-6 md:min-w-[280px] md:border-r md:border-slate-200 md:pr-8 md:flex-none">
          <StoreAvatar
            logoUrl={store?.logoUrl ?? null}
            initial={initial}
            isLoading={isLoading}
          />
          {/* `justify-center` vertically centers the name + View Shop
           * button against the avatar now that the small "Sold &
           * shipped by" label has been removed. Without it the
           * column was top-aligned relative to the avatar's height. */}
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left gap-3 justify-center">
            <h2 className="text-lg font-bold text-slate-900 leading-tight">
              {displayName}
            </h2>
            <Link
              to={`/store/${sellerId}`}
              className="inline-flex items-center justify-center border border-[#002b5b] text-[#002b5b] px-4 py-2 rounded-lg font-medium hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#002b5b] focus-visible:ring-offset-2 transition-colors"
            >
              View Shop
            </Link>
          </div>
        </div>

        {/* Right side: stats grid. `flex-1` so it expands to fill the
         * remaining card width. `md:pl-8` pushes the grid away from
         * the divider so the items don't crowd the vertical rule.
         *
         * Columns: 2 on tablet, 3 on `lg+`. With up to 5 stats
         * (Joined / Products / Email / Phone / Address) this wraps
         * as 3 + 2 on wide screens — far better use of the horizontal
         * real estate than the previous 2 + 2 + 1. `gap-x-12 gap-y-6`
         * gives each stat a comfortable breathing room. */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-6 md:pl-8 flex-1 w-full">
          {statEntries.map((entry) => (
            <div
              key={entry.label}
              className="flex items-start gap-2 min-w-0"
            >
              <span className="mt-1 text-slate-400 shrink-0">
                {entry.icon}
              </span>
              <div className="min-w-0">
                <p className="text-sm text-slate-500">{entry.label}</p>
                <p className="text-base font-medium text-slate-800 truncate" title={entry.value}>
                  {isLoading ? (
                    <span className="inline-block h-5 w-16 rounded bg-slate-100 animate-pulse" />
                  ) : (
                    entry.value
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Store avatar — falls back to a gradient tile with the first letter
 * of the store name when the seller has no logo uploaded.
 * ──────────────────────────────────────────────────────────────────────── */

function StoreAvatar({
  logoUrl,
  initial,
  isLoading,
}: {
  logoUrl: string | null;
  initial: string;
  isLoading: boolean;
}) {
  // While the store profile is still loading we don't know whether
  // there's a logo — render a neutral skeleton the same size as the
  // avatar so the layout doesn't shift.
  if (isLoading && !logoUrl) {
    return (
      <div
        aria-hidden
        className="h-16 w-16 rounded-full bg-slate-100 animate-pulse shrink-0"
      />
    );
  }

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        // Lazy-load: the avatar is below the fold of the main product
        // grid for most viewport sizes, so eager loading would waste
        // bandwidth on the hero image above.
        loading="lazy"
        className="h-16 w-16 rounded-full object-cover shrink-0 ring-2 ring-slate-100"
      />
    );
  }

  // Fallback: gradient tile with the first letter of the store name.
  // The hero background (`from-[#002b5b] to-[#1a4480]`) mirrors the
  // brand navy used elsewhere on the page so the card feels part of
  // the same design system.
  return (
    <div
      aria-hidden
      className="h-16 w-16 rounded-full bg-gradient-to-br from-[#002b5b] to-[#1a4480] flex items-center justify-center text-white text-xl font-bold shrink-0"
    >
      {initial}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Format an ISO joined-date as a short month + year (e.g. "Mar 2024").
 * Defensive: an invalid date string falls back to "--" so a bad
 * payload can't crash the page.
 */
function formatJoinedDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--';
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/* ──────────────────────────────────────────────────────────────────────────
 * Product description card — renders the seller-authored product
 * description below the Store Info Card.
 * ──────────────────────────────────────────────────────────────────────── */

interface ProductDescriptionCardProps {
  description: string;
}

/**
 * Render the product description in a dedicated card.
 *
 * Text formatting: the backend stores descriptions as **plain text**
 * (validated by `z.string().max(5000).trim()` in `product.dto.ts` —
 * no HTML sanitization, no rich-text schema). Two implications:
 *
 *   1. We render the text as-is inside a `<div>` rather than piping
 *      it through `dangerouslySetInnerHTML`. The seller can include
 *      line breaks (paragraph spacing, lists of features) and we
 *      preserve them. If the schema ever evolves to support HTML we
 *      would swap this for a `prose` container here.
 *
 *   2. `whitespace-pre-wrap` preserves newlines from the source
 *      (each `\n` becomes a real line break) while still collapsing
 *      runs of whitespace the way HTML normally does, so the text
 *      is readable AND respects the seller's paragraph structure.
 *
 * The card is intentionally hidden by the caller when the
 * description is empty/whitespace-only — we don't render a
 * "Product Description" heading over an empty body.
 */
function ProductDescriptionCard({ description }: ProductDescriptionCardProps) {
  // `pre-wrap` keeps the user's intentional newlines, `break-words`
  // prevents a single extra-long URL/no-spaces string from blowing
  // out the card width on narrow viewports.
  return (
    <section
      aria-label="Product description"
      className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm mt-8"
    >
      <h2 className="text-xl font-bold text-slate-800 mb-6">
        Product Description
      </h2>
      <div className="text-slate-700 leading-relaxed whitespace-pre-wrap text-base break-words">
        {description}
      </div>
    </section>
  );
}