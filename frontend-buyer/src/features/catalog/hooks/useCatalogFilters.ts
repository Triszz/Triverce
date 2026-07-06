import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ProductSort } from '@/services/productService';
import type { ProductFiltersValue } from '@/features/catalog/components/ProductFilters';
import { EMPTY_FILTERS } from '@/features/catalog/components/ProductFilters';

const VALID_SORTS: readonly ProductSort[] = [
  'created_desc',
  'price_asc',
  'price_desc',
  'name_asc',
  'name_desc',
];

/**
 * Sync the `ProductFiltersValue` state with URL query params, so users can
 * bookmark / share a filtered catalog view. Filters are pushed onto
 * `?q=...&category=...&min=...&max=...&sort=...`.
 */
export function useCatalogFilters(): {
  filters: ProductFiltersValue;
  setFilters: (next: ProductFiltersValue) => void;
  /** Reset all filters and clear the URL. */
  reset: () => void;
} {
  const [params, setParams] = useSearchParams();

  const filters = useMemo<ProductFiltersValue>(() => {
    const sortRaw = params.get('sort');
    const sortBy: ProductSort =
      sortRaw && (VALID_SORTS as readonly string[]).includes(sortRaw)
        ? (sortRaw as ProductSort)
        : 'created_desc';

    const minRaw = params.get('min');
    const maxRaw = params.get('max');

    return {
      search: params.get('q') ?? '',
      categoryId: params.get('category') ?? null,
      minPrice: minRaw === null ? null : Number(minRaw) || null,
      maxPrice: maxRaw === null ? null : Number(maxRaw) || null,
      sortBy,
    };
  }, [params]);

  const setFilters = useCallback(
    (next: ProductFiltersValue) => {
      const sp = new URLSearchParams();

      if (next.search) sp.set('q', next.search);
      if (next.categoryId) sp.set('category', next.categoryId);
      if (next.minPrice !== null && Number.isFinite(next.minPrice)) {
        sp.set('min', String(next.minPrice));
      }
      if (next.maxPrice !== null && Number.isFinite(next.maxPrice)) {
        sp.set('max', String(next.maxPrice));
      }
      if (next.sortBy !== EMPTY_FILTERS.sortBy) sp.set('sort', next.sortBy);

      setParams(sp, { replace: true });
    },
    [setParams],
  );

  const reset = useCallback(() => {
    setParams(new URLSearchParams(), { replace: true });
  }, [setParams]);

  return { filters, setFilters, reset };
}