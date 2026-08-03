import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { SearchX, RotateCcw, Search } from 'lucide-react';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { categoryService } from '@/services/categoryService';
import { productService } from '@/services/productService';
import { storeService, type StoreProfile } from '@/services/storeService';
import { ProductFilters } from '@/features/catalog/components/ProductFilters';
import { EMPTY_FILTERS } from '@/features/catalog/components/ProductFilters.constants';
import { ProductGrid } from '@/features/catalog/components/ProductGrid';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageMeta } from '@/components/common/PageMeta';
import { useCatalogFilters } from '@/features/catalog/hooks/useCatalogFilters';

/**
 * CatalogPage — full product listing with filterable query params.
 *
 * The URL is the source of truth for filter state, so the same view can be
 * bookmarked and shared. We forward `filters` straight into `productService.list`.
 *
 * Cross-entity search: when `?q=…` is present we also fan out to
 * `storeService.list` and surface matching storefronts above the product
 * grid in a dedicated section.
 */
export function ShopPage() {
  const navigate = useNavigate();
  const { filters, setFilters, reset } = useCatalogFilters();

  /* Active search term — drives the summary text + the parallel
   * store-search query. Read from `filters.search` (kept in sync with
   * `?q=` by useCatalogFilters) so this single value reflects what the
   * product list is currently filtered by. */
  const searchQuery = filters.search;
  const trimmedQuery = searchQuery.trim();

  /* Categories are loaded once and shared with the filter pills. */
  const categoriesQuery = useQuery({
    queryKey: ['categories', 'root'],
    queryFn: () => categoryService.list({ limit: 50, isActive: true }),
    staleTime: 5 * 60_000,
  });

  /* Products list — keyed on filters so each filter change triggers a fresh fetch. */
  const productsQuery = useQuery({
    queryKey: ['products', 'list', filters],
    queryFn: () =>
      productService.list({
        categoryId: filters.categoryId ?? undefined,
        search: filters.search || undefined,
        sortBy: filters.sortBy,
        minPrice: filters.minPrice ?? undefined,
        maxPrice: filters.maxPrice ?? undefined,
        limit: 24,
        page: 1,
        isActive: true,
      }),
    placeholderData: (previous) => previous,
  });

  /* Parallel store-search query — only fires when there's a non-empty
   * `?q=…`. When the search box is empty, React Query treats the query
   * as disabled (no network call) and we treat its data as `[]`. */
  const storesQuery = useQuery({
    queryKey: ['stores', 'search', trimmedQuery],
    queryFn: () => storeService.list({ search: trimmedQuery, limit: 12 }),
    enabled: trimmedQuery.length > 0,
    staleTime: 30_000,
  });

  const categories = useMemo(
    () => categoriesQuery.data?.data ?? [],
    [categoriesQuery.data],
  );

  const totalCount = productsQuery.data?.total ?? 0;
  const products = productsQuery.data?.data ?? [];
  const stores: StoreProfile[] = storesQuery.data ?? [];

  // The empty state should only trigger when BOTH the product grid AND
  // the matching-shops section are empty. If a search returned at least
  // one shop we let the user click into it instead of showing a dead-end.
  const hasResults = products.length > 0 || stores.length > 0;

  return (
    <>
      <PageMeta
        title="Shop all products"
        description="Browse products from independent sellers. Filter by category, price, and more."
      />
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <Breadcrumbs
        crumbs={[{ label: 'Home', path: '/' }, { label: 'Shop' }]}
        className="mb-6"
      />

      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
          Shop all products
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {productsQuery.isLoading
            ? 'Loading…'
            : `${totalCount} ${totalCount === 1 ? 'product' : 'products'}`}
        </p>
      </header>

      <ProductFilters
        categories={categories}
        value={filters}
        onChange={setFilters}
        onReset={reset}
        className="mb-6 sm:mb-8"
      />

      {/* Active-search summary — driven by the global Header search bar.
          The "Clear all" button in the filter card above is the single
          affordance for resetting the search (and all other filters). */}
      {searchQuery && (
        <div className="flex items-center gap-2 mb-6 text-sm text-slate-600">
          <Search size={15} className="shrink-0 text-slate-400" aria-hidden />
          <span className="truncate">
            Showing results for{" "}
            <span className="font-semibold text-slate-900">
              "{searchQuery}"
            </span>
          </span>
        </div>
      )}

      {/* ── Matching shops (only when ?q=… is set and the store query
              returned at least one storefront). Renders above the product
              grid so storefronts are visually distinct from SKUs. */}
      {stores.length > 0 && (
        <section
          aria-labelledby="matching-shops-heading"
          className="mb-8"
        >
          <h3
            id="matching-shops-heading"
            className="text-lg font-semibold text-slate-800 mb-4"
          >
            Shops matching "{searchQuery}"
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stores.map((store) => (
              <StoreResultCard key={store.id} store={store} />
            ))}
          </div>
          <hr className="my-8 border-slate-200" />
        </section>
      )}

      <ProductGrid
        products={products}
        isLoading={productsQuery.isLoading && products.length === 0}
        skeletonCount={8}
        emptyState={
          // Hide the empty state entirely if the matching-shops section
          // is showing something useful — better UX than a confusing
          // "no products" message alongside a list of found stores.
          hasResults ? null : filters === EMPTY_FILTERS ? (
            <EmptyState
              tone="brand"
              icon={<SearchX size={28} aria-hidden />}
              title="No products available yet"
              description="We're onboarding new sellers every day. Check back soon, or start shopping from our latest arrivals on the home page."
              actions={[
                {
                  label: 'Start shopping',
                  onClick: () => navigate('/'),
                  variant: 'primary',
                },
              ]}
            />
          ) : (
            <EmptyState
              tone="neutral"
              icon={<SearchX size={28} aria-hidden />}
              title="Nothing matches those filters"
              description={`We couldn't find any products or shops matching "${searchQuery}". Try a different search term or clear the filters.`}
              actions={[
                {
                  label: 'Clear all filters',
                  onClick: reset,
                  variant: 'primary',
                  leftIcon: <RotateCcw size={14} aria-hidden />,
                },
              ]}
            />
          )
        }
      />
    </div>
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * StoreResultCard — visual sibling of a ProductCard, deliberately styled
 * distinctly (slate background, no price block) so a buyer can tell at a
 * glance that this routes to a storefront, not a product detail page.
 * ──────────────────────────────────────────────────────────────────────── */

interface StoreResultCardProps {
  store: StoreProfile;
}

function StoreResultCard({ store }: StoreResultCardProps) {
  const displayName = store.storeName ?? 'Unnamed store';
  const productLabel =
    store.productCount === 1 ? '1 product' : `${store.productCount} products`;

  return (
    <Link
      to={`/store/${store.id}`}
      className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-4 hover:shadow-md transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-[#002b5b] focus-visible:ring-offset-2"
    >
      <StoreAvatar name={displayName} logoUrl={store.logoUrl} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-900 truncate">
          {displayName}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">{productLabel}</p>
      </div>
    </Link>
  );
}

/**
 * Storefront avatar — image-or-initial fallback. Mirrors the pattern
 * already used on StoreProfilePage so cards on the Shop page look like
 * miniature versions of the same identity element.
 */
function StoreAvatar({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  if (!logoUrl) {
    return (
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1a4a8a] to-[#002b5b] flex items-center justify-center shrink-0 border border-white/20">
        <span className="text-lg font-bold text-white select-none">
          {initial}
        </span>
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={`${name} logo`}
      className="w-12 h-12 rounded-xl object-cover shrink-0 border border-slate-200"
    />
  );
}