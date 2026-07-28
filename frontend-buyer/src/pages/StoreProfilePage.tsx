import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Package } from 'lucide-react';
import { PageMeta } from '@/components/common/PageMeta';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useStoreProfile } from '@/hooks/useStoreProfile';
import { productService } from '@/services/productService';
import { ProductGrid } from '@/features/catalog/components/ProductGrid';

/**
 * StoreProfilePage — public storefront profile at `/store/:sellerId`.
 *
 * Fetches the seller's public profile (storeName, logo, joined date,
 * product count) and a paginated list of their active products.
 */
export function StoreProfilePage() {
  const { sellerId } = useParams<{ sellerId: string }>();

  const storeQuery = useStoreProfile(sellerId ?? '');
  const productQuery = useQuery({
    queryKey: ['products', 'by-seller', sellerId],
    queryFn: () => productService.list({ sellerId, limit: 20, isActive: true }),
    enabled: !!sellerId,
    staleTime: 30_000,
  });

  const store = storeQuery.data;
  const products = productQuery.data?.data ?? [];

  const joinedLabel = useMemo(() => {
    if (!store?.joinedAt) return null;
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      year: 'numeric',
    }).format(new Date(store.joinedAt));
  }, [store?.joinedAt]);

  const displayName = store?.storeName || 'This Store';

  /* ── Head ──────────────────────────────────────────────────────────────── */

  if (storeQuery.isLoading) return <StoreSkeleton />;

  if (storeQuery.isError || !store) {
    return (
      <>
        <PageMeta title="Store not found" />
        <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
          <h1 className="text-2xl font-bold text-slate-900">Store not found</h1>
          <p className="text-slate-500">
            This store may have been removed or the link is incorrect.
          </p>
          <Button variant="primary" onClick={() => window.history.back()}>
            Go back
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageMeta
        title={displayName}
        description={
          store.description
            ? `${displayName} — ${store.description}`
            : `Browse all products from ${displayName}.`
        }
      />

      <Breadcrumbs
        crumbs={[
          { label: 'Home', path: '/' },
          { label: displayName },
        ]}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8"
      />

      {/* ── Hero / Cover Banner ──────────────────────────────────────── */}
      <div className="relative bg-[#031140]">
        {/* Decorative gradient orbs */}
        <div
          aria-hidden
          className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-[#1a4a8a]/30 blur-3xl pointer-events-none"
        />
        <div
          aria-hidden
          className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-[#002b5b]/40 blur-2xl pointer-events-none"
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Overlapping profile card — the white card floats over the navy banner */}
          <div className="relative flex items-end gap-5 py-10">
            {/* Avatar */}
            <div className="shrink-0">
              <StoreAvatar name={displayName} logoUrl={store.logoUrl} />
            </div>

            {/* Store info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-white truncate">
                {displayName}
              </h1>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                {joinedLabel && (
                  <span className="inline-flex items-center gap-1.5 text-sm text-blue-200">
                    <CalendarDays size={14} aria-hidden />
                    Joined {joinedLabel}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 text-sm text-blue-200">
                  <Package size={14} aria-hidden />
                  {store.productCount === 1
                    ? '1 product'
                    : `${store.productCount} products`}
                </span>
              </div>

              {store.description && (
                <p className="mt-3 text-sm text-blue-100 line-clamp-2 max-w-2xl">
                  {store.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Product Grid ───────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-900">
            {products.length === 0
              ? `No products yet from ${displayName}`
              : `All items from ${displayName}`}
          </h2>
          {productQuery.data && productQuery.data.total > productQuery.data.limit && (
            <span className="text-sm text-slate-500">
              Showing {products.length} of {productQuery.data.total}
            </span>
          )}
        </div>

        {productQuery.isLoading ? (
          <ProductGrid
            products={[]}
            isLoading
            skeletonCount={8}
          />
        ) : productQuery.isError ? (
          <div className="text-sm text-danger-700 py-8 text-center">
            Failed to load products. Please refresh.
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            tone="neutral"
            icon={<Package size={24} aria-hidden />}
            title="No products yet"
            description={`${displayName} hasn't added any products yet. Check back soon!`}
          />
        ) : (
          <ProductGrid products={products} />
        )}
      </div>
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

interface StoreAvatarProps {
  name: string;
  logoUrl: string | null;
}

/**
 * Store logo — tries the real URL first; falls back to a branded initial
 * avatar if the URL is falsy or the image fails to load (broken link, CORS,
 * deleted file, etc.).
 */
function StoreAvatar({ name, logoUrl }: StoreAvatarProps) {
  const [imgError, setImgError] = useState(false);

  const showFallback = !logoUrl || imgError;
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  if (showFallback) {
    return (
      <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#1a4a8a] to-[#002b5b] flex items-center justify-center border-4 border-white/20 shadow-xl">
        <span className="text-3xl font-bold text-white select-none">{initial}</span>
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={`${name} logo`}
      onError={() => setImgError(true)}
      className="w-24 h-24 rounded-2xl object-cover border-4 border-white/20 shadow-xl"
    />
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function StoreSkeleton() {
  return (
    <>
      <PageMeta title="Loading store…" />
      <div className="bg-[#031140]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-end gap-5">
            <Skeleton className="w-24 h-24 rounded-2xl" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Skeleton className="h-6 w-56 mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl overflow-hidden bg-white border border-slate-100">
              <Skeleton className="aspect-square w-full rounded-none" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-5 w-20 mt-1" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
