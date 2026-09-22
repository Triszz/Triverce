import { useMemo } from 'react';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { SearchX, RotateCcw, Search } from 'lucide-react';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { categoryService } from '@/services/categoryService';
import { productService } from '@/services/productService';
import { storeService, type StoreProfile } from '@/services/storeService';
import { ProductFilters } from '@/features/catalog/components/ProductFilters';
import {
  EMPTY_FILTERS,
  type ProductFiltersValue,
} from '@/features/catalog/components/ProductFilters.constants';
import { ProductGrid } from '@/features/catalog/components/ProductGrid';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageMeta } from '@/components/common/PageMeta';
import { useCatalogFilters } from '@/features/catalog/hooks/useCatalogFilters';

/**
 * ShopPage / CategoryPage — single component mounted on two routes:
 *
 *   • `/shop` — global catalog, no category pre-selected.
 *   • `/category/:categorySlug` — pre-filtered to a single category.
 *
 * URL shape (canonical):
 *   • Category is in the **path** so it appears as `/category/electronics`
 *     — SEO-friendly, shareable, stable when copy-pasted.
 *   • Other filters (`q`, `min`, `max`, `sort`) live in the **query string**.
 *
 * Source-of-truth hierarchy (important — read carefully):
 *   1. **Path param `categorySlug`** wins when present (i.e. on `/category/...`).
 *      The `?category=` query string is treated as a legacy / fallback form
 *      used only when the path doesn't have one (i.e. on plain `/shop?category=...`).
 *   2. **Query params for everything else** are owned by `useCatalogFilters`.
 *
 * Why this hierarchy: every piece of state that's user-controllable lives
 * in the URL. The path and the query param are mutually exclusive (when
 * the path is present, the query param is ignored). This means a single
 * React Query key that includes the *resolved* slug reacts correctly to
 * path navigation without us juggling two filter state machines.
 *
 * Pill-click reactivity:
 *   • Path changes → `activeCategorySlug` changes → `queryKey` changes
 *     → React Query refetches automatically. No manual invalidation.
 *   • Other filter changes go through `useCatalogFilters` which mutates
 *     the query string → `filters` changes → `queryKey` changes → refetch.
 *
 * Backward compatibility:
 *   The legacy URL `/shop?category=<slug>` still works. When the user is
 *   on that URL the active slug comes from the query param; when they
 *   click any pill we promote them to the canonical path form so the
 *   URL stays consistent going forward.
 */
export function ShopPage() {
  const navigate = useNavigate();
  const { categorySlug: slugFromPath } = useParams<{ categorySlug: string }>();
  const [searchParams] = useSearchParams();
  const { filters, setFilters, reset } = useCatalogFilters();

  /**
   * The active category slug. Path param wins so that hard navigation to
   * `/category/:slug` never silently switches back to `/shop` on a refresh.
   *
   * `filters.categorySlug` is the *query-param view* — set by `useCatalogFilters`
   * when the URL is `/shop?category=electronics`. We don't trust it alone
   * because `useCatalogFilters` has no knowledge of path params.
   *
   * Normalised to `string | null` (never `undefined`) so the dependency arrays
   * and query keys below behave predictably — `undefined` and `null` are
   * different identities to React Query and would cause spurious refetches.
   */
  const activeCategorySlug: string | null =
    slugFromPath ?? filters.categorySlug ?? null;

  /* Active search term — drives the summary text + the parallel
   * store-search query. Read from `filters.search` (kept in sync with
   * `?q=` by useCatalogFilters) so this single value reflects what the
   * product list is currently filtered by. */
  const searchQuery = filters.search;
  const trimmedQuery = searchQuery.trim();

  /* Resolve the active category (if any) so the breadcrumb + page title
   * can show the human name. Falls back gracefully — the list still
   * works while the category fetch is in flight (it just shows the slug
   * in the breadcrumb until the real name arrives). */
  const categoryQuery = useQuery({
    queryKey: ['category', 'by-slug', activeCategorySlug],
    queryFn: () => categoryService.getBySlug(activeCategorySlug as string),
    enabled: !!activeCategorySlug,
    staleTime: 5 * 60_000,
  });

  /* Categories are loaded once and shared with the filter pills. */
  const categoriesQuery = useQuery({
    queryKey: ['categories', 'root'],
    queryFn: () => categoryService.list({ limit: 50, isActive: true }),
    staleTime: 5 * 60_000,
  });

  /**
   * Products list — keyed on EVERYTHING that affects the result set:
   *   • `activeCategorySlug` (path- or query-derived) — must be a top-level
   *     key so a path change from `/shop` → `/category/electronics`
   *     dereferences the cache and triggers a fresh fetch. Earlier we put
   *     this inside `filters` only, which read from `useSearchParams` — that
   *     meant navigating by path kept the same queryKey and the list never
   *     refetched (the "URL changed but data didn't" bug).
   *   • `filters` (q, min, max, sort) — owned by `useCatalogFilters`.
   *
   * Spreading `filters` directly into the key keeps the key stable when
   * filters don't change (object reference changes per render but the
   * *contents* only change when a filter does, and React Query compares
   * structural content via `hashQueryKey`).
   */
  const productsQuery = useQuery({
    queryKey: ['products', 'list', activeCategorySlug, filters],
    queryFn: () =>
      productService.list({
        categorySlug: activeCategorySlug ?? undefined,
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

  /**
   * Build a query-string for the next navigation that *preserves* every
   * non-category filter the user already had (`q`, `min`, `max`, `sort`).
   *
   * We deliberately drop `?category=` from the search string because the
   * category now lives in the path. Carrying it as a stale query param
   * would mean a hard refresh of `/category/electronics?category=foo` could
   * leave the active slug ambiguous (path vs query — the path wins, but the
   * dangling `?category=foo` is just noise in the URL bar).
   */
  const buildPreservedSearch = (
    nextCategorySlug: string | null,
  ): string => {
    const sp = new URLSearchParams(searchParams);
    sp.delete('category'); // Category lives in the path now.
    if (nextCategorySlug) {
      // We don't write `?category=` when path is used — see comment above.
      // Only re-add when path is absent (legacy form, e.g. `/shop?category=`).
      // We can't actually put it in the path here, so we skip; the legacy
      // path is handled by `useCatalogFilters` on `/shop`.
    }
    return sp.toString();
  };

  /**
   * Pill-click handler.
   *
   * The previous version compared `next.categorySlug` against
   * `filters.categorySlug` (the query-string view). That was wrong:
   *   • When the user is on `/category/electronics`, `filters.categorySlug`
   *     is `null` (no `?category=` in the URL). Clicking the *active*
   *     pill ("All" or the same category) looked like "no change" and the
   *     navigation branch never fired — that's the "All button is dead"
   *     bug.
   *
   * Comparing against `activeCategorySlug` (the resolved value, path-first)
   * makes every pill click a real comparison: even clicking "All" while on
   * `/category/electronics` is `null !== 'electronics'` and triggers the
   * navigate-to-`/shop` branch.
   *
   * Search params (q, min, max, sort) are preserved across the navigation
   * so the user doesn't lose their price filter when switching category.
   */
  const handleFiltersChange = (next: ProductFiltersValue) => {
    if (next.categorySlug !== activeCategorySlug) {
      const pathname = next.categorySlug
        ? `/category/${next.categorySlug}`
        : '/shop';
      const search = buildPreservedSearch(next.categorySlug);
      navigate({ pathname, search: search || undefined });
      // We intentionally do NOT also call `setFilters(next)` for the
      // category branch — the navigation IS the state write. Calling both
      // would race the two URL sources against each other on the next
      // render.
      return;
    }
    // Same category, but a price / sort / search change → URL search-param
    // path. The pill itself didn't change so we don't navigate.
    setFilters(next);
  };

  // When we're on a `/category/:slug` URL but the resolved category
  // query 404s, render a friendly empty state instead of the generic
  // "no products" — the slug in the URL is the user's only signal that
  // something went wrong, so we surface it explicitly.
  const categoryNotFound =
    !!activeCategorySlug && categoryQuery.isError;
  const categoryName = categoryQuery.data?.name ?? activeCategorySlug;

  // Hard-stop on a bad category slug before any product grid renders —
  // otherwise we'd show "0 products" under a heading that still looks
  // legitimate. This branch keeps the same shell (header/footer via
  // MainLayout) so the user has the Shop nav to recover.
  if (categoryNotFound) {
    return (
      <>
        <PageMeta title="Category not found" />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center space-y-4">
          <h1 className="text-2xl font-bold text-slate-900">
            Category not found
          </h1>
          <p className="text-slate-500">
            We couldn't find a category with the slug "{activeCategorySlug}".
            It may have been removed or the link is incorrect.
          </p>
          <button
            type="button"
            onClick={() => navigate('/shop')}
            className="inline-flex items-center justify-center bg-[#002b5b] hover:bg-[#001f3f] text-white px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer"
          >
            Browse all products
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageMeta
        title={
          categoryName
            ? `${categoryName} — Shop`
            : 'Shop all products'
        }
        description={
          categoryName
            ? `Browse ${categoryName} from independent sellers on Triverce.`
            : 'Browse products from independent sellers. Filter by category, price, and more.'
        }
      />
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <Breadcrumbs
        crumbs={
          categoryName
            ? [
                { label: 'Home', path: '/' },
                { label: 'Shop', path: '/shop' },
                { label: categoryName },
              ]
            : [{ label: 'Home', path: '/' }, { label: 'Shop' }]
        }
        className="mb-6"
      />

      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
          {categoryName ? categoryName : 'Shop all products'}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {productsQuery.isLoading
            ? 'Loading…'
            : `${totalCount} ${totalCount === 1 ? 'product' : 'products'}`}
        </p>
      </header>

      <ProductFilters
        categories={categories}
        value={{ ...filters, categorySlug: activeCategorySlug }}
        onChange={handleFiltersChange}
        onReset={() => {
          // "Clear all" always ends up at `/shop` with no query params —
          // that's the canonical "no filters" landing. From
          // `/category/:slug` we navigate (path change), from `/shop?min=...`
          // we just `reset()` the query string. Either way the user gets
          // the unfiltered grid.
          if (activeCategorySlug) {
            navigate('/shop');
          } else {
            reset();
          }
        }}
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