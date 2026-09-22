import type { ProductSort } from '@/services/productService';

export interface ProductFiltersValue {
  search: string;
  /**
   * Active category slug (e.g. "electronics"). Null when no category is
   * selected (the "All" pill). URL stores this as `?category=<slug>` so
   * `/shop?category=electronics` and `/category/electronics` stay in sync.
   */
  categorySlug: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  sortBy: ProductSort;
}

export const EMPTY_FILTERS: ProductFiltersValue = {
  search: '',
  categorySlug: null,
  minPrice: null,
  maxPrice: null,
  sortBy: 'created_desc',
};
