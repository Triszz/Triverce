import { useEffect, useMemo, useState } from 'react';
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
import { productService, type ProductVariant } from '@/services/productService';
import {
  VariantPicker,
  StockBadge,
} from '@/features/catalog/components/VariantPicker';

/**
 * ProductDetailPage — slug-routed (`/product/:slug`).
 *
 * Uses TanStack Query to fetch the full product (with variants) by slug.
 * The active variant is local component state — selecting a variant updates
 * the displayed image, price, and stock badge instantly.
 *
 * Add-to-Cart is a mocked log+toast for now. Wiring to the real cart store
 * lands in Step 8.
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

  // Default to the first active variant once data lands.
  const firstVariantId = useMemo<string | null>(() => {
    const variants = productQuery.data?.variants ?? [];
    const first = variants.find((v) => v.isActive) ?? variants[0];
    return first?.id ?? null;
  }, [productQuery.data]);

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  // Reset selection whenever the underlying product changes.
  useEffect(() => {
    setSelectedVariantId(firstVariantId);
  }, [firstVariantId]);

  const product = productQuery.data ?? null;
  const selectedVariant: ProductVariant | null =
    product?.variants.find((v) => v.id === selectedVariantId) ??
    product?.variants.find((v) => v.isActive) ??
    product?.variants[0] ??
    null;

  /* ── UI ──────────────────────────────────────────────────────────────── */

  if (productQuery.isLoading) {
    return <DetailSkeleton />;
  }

  if (productQuery.isError || !product) {
    return (
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
    );
  }

  /* ── Derived data ─────────────────────────────────────────────────────── */

  const isOutOfStock =
    selectedVariant?.stockStatus === 'out_of_stock' ||
    !selectedVariant?.isActive;

  const canAddToCart = !!selectedVariant && !isOutOfStock;

  const handleAddToCart = () => {
    if (!selectedVariant) return;
    // TODO (Step 8): wire to real Cart store.
    console.info('[mock] add to cart', {
      productId: product.id,
      productSlug: product.slug,
      variantId: selectedVariant.id,
      sku: selectedVariant.sku,
      quantity: 1,
    });
    toast.success(`Added "${product.name}" (${selectedVariant.sku}) to cart`);
  };

  const heroImage = selectedVariant?.imageUrl ?? null;

  return (
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
        {/* Image column */}
        <div className="space-y-3">
          <div className="aspect-square overflow-hidden rounded-2xl bg-slate-50 border border-slate-100 shadow-sm">
            {heroImage ? (
              <img
                key={heroImage /* force re-mount on image swap */}
                src={heroImage}
                alt={product.name}
                className="h-full w-full object-cover transition-opacity duration-300"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-slate-300 text-7xl font-semibold">
                {product.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {product.variants.length > 1 && (
            <div className="flex flex-wrap gap-2" aria-label="Other variants">
              {product.variants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedVariantId(v.id)}
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
                onSelect={setSelectedVariantId}
              />
            </div>
          )}

          <div className="border-t border-slate-100 pt-6 space-y-4">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              disabled={!canAddToCart}
              onClick={handleAddToCart}
              leftIcon={<ShoppingBag size={18} aria-hidden />}
            >
              {isOutOfStock ? 'Out of stock' : 'Add to cart'}
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