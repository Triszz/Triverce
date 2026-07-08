import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { SearchX, RotateCcw } from 'lucide-react';
import { categoryService } from '@/services/categoryService';
import { productService } from '@/services/productService';
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
 */
export function ShopPage() {
  const navigate = useNavigate();
  const { filters, setFilters } = useCatalogFilters();

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

  const categories = useMemo(
    () => categoriesQuery.data?.data ?? [],
    [categoriesQuery.data],
  );

  const totalCount = productsQuery.data?.total ?? 0;
  const products = productsQuery.data?.data ?? [];

  return (
    <>
      <PageMeta
        title="Shop all products"
        description="Browse products from independent sellers. Filter by category, price, and more."
      />
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
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
        className="mb-6 sm:mb-8"
      />

      <ProductGrid
        products={products}
        isLoading={productsQuery.isLoading && products.length === 0}
        skeletonCount={8}
        emptyState={
          filters === EMPTY_FILTERS ? (
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
              description="Try removing a filter or broadening your price range to see more results."
              actions={[
                {
                  label: 'Clear filters',
                  onClick: () => setFilters(EMPTY_FILTERS),
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