import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft,
  Package,
  ShoppingBag,
  Store,
  Truck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';
import { PriceTag } from '@/components/ui/PriceTag';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { PageMeta } from '@/components/common/PageMeta';
import { cn } from '@/lib/cn';
import {
  productService,
  pickHeroImage,
  type ProductVariant,
} from '@/services/productService';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  VariantPicker,
  StockBadge,
} from '@/features/catalog/components/VariantPicker';
import { useCart } from '@/hooks/useCart';
import { useUiStore } from '@/stores/useUiStore';

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

  // Tracks the variant the user has explicitly selected.
  const [userSelectedVariantId, setUserSelectedVariantId] = useState<string | null>(null);

  // Tracks which thumbnail the user has explicitly clicked.
  // Uses a string key so it works for both gallery URLs and variant chip IDs.
  // `null` = no explicit pick — hero follows the selected variant's image.
  const [activeThumbnailKey, setActiveThumbnailKey] = useState<string | null>(null);

  // Reset the add-to-cart quantity when the selected variant changes.
  const lastVariantId = useRef<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  // Derived display value: respect the user's explicit selection if it's
  // still valid for the current product; otherwise default to the first
  // active variant (or the first variant if none are marked active).
  const selectedVariantId = useMemo<string | null>(() => {
    const variants = productQuery.data?.variants ?? [];
    if (
      userSelectedVariantId != null &&
      variants.some((v) => v.id === userSelectedVariantId)
    ) {
      return userSelectedVariantId;
    }
    const first = variants.find((v) => v.isActive) ?? variants[0];
    return first?.id ?? null;
  }, [productQuery.data, userSelectedVariantId]);

  // Synchronously update state without causing a cascading render.
  // Only resets when the actual selected variant ID changes.
  if (selectedVariantId !== lastVariantId.current) {
    lastVariantId.current = selectedVariantId;
    setQuantity(1);
  }

  const product = productQuery.data ?? null;
  const selectedVariant: ProductVariant | null =
    product?.variants.find((v) => v.id === selectedVariantId) ??
    product?.variants.find((v) => v.isActive) ??
    product?.variants[0] ??
    null;

  // Reset the thumbnail + variant selection when the slug changes so
  // the previous product's picks don't leak into the new one. We do
  // this synchronously during render (vs. inside a useEffect) to avoid
  // the `set-state-in-effect` cascading-render warning. The ref
  // comparison guards against resetting on the very first render.
  const lastSlugRef = useRef<string | undefined>(undefined);
  // eslint-disable-next-line react-hooks/refs
  if (slug !== lastSlugRef.current) {
    // eslint-disable-next-line react-hooks/refs
    lastSlugRef.current = slug;
    if (activeThumbnailKey !== null) setActiveThumbnailKey(null);
    if (userSelectedVariantId !== null) setUserSelectedVariantId(null);
  }

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
  //   2. Selected variant has its own image → that image.
  //   3. First thumbnail image.
  //   4. `null` (placeholder).
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

  const isOutOfStock =
    selectedVariant?.stockStatus === 'out_of_stock' ||
    !selectedVariant?.isActive;

  const canAddToCart =
    !!selectedVariant && !isOutOfStock && !isAdding;

  const handleAddToCart = async () => {
    if (!selectedVariant) return;

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
      {/* Back link */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-[#002b5b] transition-colors mb-6"
      >
        <ChevronLeft size={16} aria-hidden />
        Back
      </button>

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
                      // If this is a variant chip, also update the selected variant.
                      if (thumb.variantId) {
                        setUserSelectedVariantId(thumb.variantId);
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
            <PriceTag
              value={selectedVariant?.price ?? product.minPrice}
              size="xl"
            />
            {selectedVariant && (
              <StockBadge
                status={selectedVariant.stockStatus}
                className="ml-1"
              />
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
                selectedId={selectedVariantId}
                // Variant → image sync: clear the thumbnail selection so the
                // hero falls through to the newly selected variant's image.
                onSelect={(id) => {
                  setActiveThumbnailKey(null);
                  setUserSelectedVariantId(id);
                }}
              />
            </div>
          )}

          <div className="border-t border-slate-100 pt-6 space-y-4">
            <div className={cn('flex items-center gap-3', isOutOfStock && 'opacity-50')}>
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
              {isOutOfStock ? 'Out of stock' : isAdding ? 'Adding…' : 'Add to cart'}
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