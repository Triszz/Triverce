import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft,
  Package,
  ShoppingBag,
  Truck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';
import { PriceTag } from '@/components/ui/PriceTag';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { PageMeta } from '@/components/common/PageMeta';
import {
  productService,
  pickHeroImage,
  type ProductVariant,
} from '@/services/productService';
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
  // Drawer control — open the slide-over on a successful add.
  const openCartDrawer = useUiStore((s) => s.openCartDrawer);

  // Tracks the variant the user has explicitly selected.
  const [userSelectedVariantId, setUserSelectedVariantId] = useState<string | null>(null);

  // Tracks which gallery thumbnail the user has clicked. `null` means
  // "no explicit pick — use the variant image if available, otherwise
  // the first gallery image." We store an index (not a URL) so the
  // selection survives product cache invalidations where the URL list
  // is structurally the same (memoization stays valid).
  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);

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

  // The gallery list we render thumbs for. We resolve once per render
  // and prefer `product.images`, falling back to a single-element list
  // built from `product.imageUrl` so products that pre-date the
  // multi-image rollout still render a populated gallery tile.
  const galleryImages = useMemo<string[]>(() => {
    if (!product) return [];
    if (product.images && product.images.length > 0) return product.images;
    const fallback = pickHeroImage(product);
    return fallback ? [fallback] : [];
    // pickHeroImage reads `imageUrl` which is part of product — when
    // product changes, the memo invalidates. We intentionally omit
    // pickHeroImage from deps (stable across renders).
  }, [product]);

  // Hero resolution order (kept in render, not an effect):
  //   1. Explicit thumbnail click (`activeImageIndex`).
  //   2. The selected variant's own image (variant-specific photography).
  //   3. The first gallery image.
  //   4. `null` (renderers fall back to a placeholder).
  const heroImage: string | null =
    (activeImageIndex !== null && galleryImages[activeImageIndex]) ||
    selectedVariant?.imageUrl ||
    galleryImages[0] ||
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
    if (activeImageIndex !== null) setActiveImageIndex(null);
    if (userSelectedVariantId !== null) setUserSelectedVariantId(null);
  }

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

          {/*
           * Gallery thumbnail row. We render `galleryImages` (which may
           * contain a single legacy `imageUrl` entry for pre-migration
           * products) instead of `product.variants` so the row reflects
           * the product-level gallery rather than per-variant chips.
           * The hero has its own precedence (variant image > gallery[0]),
           * so picking a thumbnail is mostly about *flipping the hero*
           * without disturbing the active variant.
           */}
          {galleryImages.length > 1 && (
            <div className="flex flex-wrap gap-2" aria-label="Product gallery">
              {galleryImages.map((url, index) => {
                // "Active" means: the hero is currently showing this
                // thumbnail. The active state can be either an explicit
                // click (activeImageIndex === index) or the implicit
                // "first image" when no thumbnail has been clicked and
                // no variant image is overriding.
                const isActive =
                  activeImageIndex === index ||
                  (activeImageIndex === null &&
                    selectedVariant?.imageUrl === undefined &&
                    index === 0);
                return (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setActiveImageIndex(index)}
                    aria-label={`Show image ${index + 1} of ${galleryImages.length}`}
                    aria-pressed={isActive}
                    className={`h-16 w-16 rounded-lg overflow-hidden border-2 transition-all duration-150 ${
                      isActive
                        ? 'border-[#002b5b] ring-2 ring-[#002b5b]/30'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <img
                      src={url}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </button>
                );
              })}
            </div>
          )}

          {/* Variant chips — these switch the *active variant* (which
           * also affects price + stock), independent of the gallery
           * thumbnail row above. We only show them when there's more
           * than one variant AND the variant has its own image, so the
           * row doesn't add noise for single-variant products. */}
          {product.variants.length > 1 && (
            <div className="flex flex-wrap gap-2" aria-label="Variant previews">
              {product.variants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    setUserSelectedVariantId(v.id);
                    // Reset the gallery selection so the variant's own
                    // image takes over the hero naturally.
                    setActiveImageIndex(null);
                  }}
                  aria-label={`Switch to ${v.sku}`}
                  className={`h-16 w-16 rounded-lg overflow-hidden border-2 transition-all duration-150 ${
                    selectedVariant?.id === v.id
                      ? 'border-[#002b5b] ring-2 ring-[#002b5b]/30'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {v.imageUrl ? (
                    <img
                      src={v.imageUrl}
                      alt={v.sku}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="h-full w-full flex items-center justify-center text-slate-400 text-xs">
                      {v.sku.slice(-3)}
                    </span>
                  )}
                </button>
              ))}
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
                onSelect={setUserSelectedVariantId}
              />
            </div>
          )}

          <div className="border-t border-slate-100 pt-6 space-y-4">
            <div className="flex items-center gap-3">
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