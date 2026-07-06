import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { categoryService } from '@/services/categoryService';
import { productService } from '@/services/productService';
import {
  ProductFilters,
  EMPTY_FILTERS,
} from '@/features/catalog/components/ProductFilters';
import { ProductGrid } from '@/features/catalog/components/ProductGrid';
import { useCatalogFilters } from '@/features/catalog/hooks/useCatalogFilters';

/**
 * CatalogPage — full product listing with filterable query params.
 *
 * The URL is the source of truth for filter state, so the same view can be
 * bookmarked and shared. We forward `filters` straight into `productService.list`.
 */
export function ShopPage() {
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
            <p className="text-sm text-slate-500">
              No products available yet.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-base font-semibold text-slate-900">
                Nothing matches those filters
              </p>
              <p className="text-sm text-slate-500">
                Try removing a filter or broadening your price range.
              </p>
            </div>
          )
        }
      />
    </div>
  );
}