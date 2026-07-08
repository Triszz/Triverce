import type { ProductSort } from '@/services/productService';

export interface ProductFiltersValue {
  search: string;
  categoryId: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  sortBy: ProductSort;
}

export const EMPTY_FILTERS: ProductFiltersValue = {
  search: '',
  categoryId: null,
  minPrice: null,
  maxPrice: null,
  sortBy: 'created_desc',
};
