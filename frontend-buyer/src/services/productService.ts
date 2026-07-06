import apiClient from './apiClient';
import type {
  ApiPaginatedResponse,
  ApiResponse,
} from '@/types/api';

/* ──────────────────────────────────────────────────────────────────────────
 * Domain types — mirror backend ProductEntity / ProductVariantEntity.
 * ────────────────────────────────────────────────────────────────────────── */

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

/** Sort options accepted by the backend ProductQuery. */
export type ProductSort =
  | 'price_asc'
  | 'price_desc'
  | 'name_asc'
  | 'name_desc'
  | 'created_desc';

/** `ProductEntity.toPublicSummary()` — used by list endpoints & cards. */
export interface ProductSummary {
  id: string;
  sellerId: string;
  /** Optional — populated by the backend only when the row has a category. */
  categoryId: string | null;
  name: string;
  slug: string;
  basePrice: number;
  minPrice: number;
  maxPrice: number;
  isActive: boolean;
  /**
   * Hero image. Backend sets it to the cheapest active variant's imageUrl
   * (or null if the product has no variants).
   */
  imageUrl: string | null;
}

/** One attribute value attached to a variant. */
export interface VariantAttribute {
  attributeId: string;
  attributeName: string;
  value: string;
}

/** `ProductVariantEntity.toPublic()` — used in detail responses. */
export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  price: number;
  imageUrl: string | null;
  isActive: boolean;
  attributes: VariantAttribute[];
  createdAt: string;
  updatedAt: string;
  stockStatus: StockStatus;
}

/** `ProductEntity.toPublicDetail()` — full product with variants. */
export interface ProductDetail extends Omit<ProductSummary, 'imageUrl'> {
  description: string | null;
  createdAt: string;
  updatedAt: string;
  variants: ProductVariant[];
}

/* ──────────────────────────────────────────────────────────────────────────
 * Query / payload types
 * ────────────────────────────────────────────────────────────────────────── */

export interface ProductListParams {
  page?: number;
  limit?: number;
  categoryId?: string;
  search?: string;
  sortBy?: ProductSort;
  minPrice?: number;
  maxPrice?: number;
  isActive?: boolean;
}

export interface ProductListResult {
  data: ProductSummary[];
  total: number;
  page: number;
  limit: number;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Service
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Product service — wraps `/api/products` endpoints.
 *
 * Conventions:
 *   • Returns plain domain objects (already `.data`-unwrapped).
 *   • Throws on transport / non-success responses so TanStack Query can
 *     surface the error in `query.error`.
 */
export const productService = {
  /**
   * GET /products — paginated list with filters + sort.
   */
  list: async (
    params: ProductListParams = {},
  ): Promise<ProductListResult> => {
    const { data } = await apiClient.get<ApiPaginatedResponse<ProductSummary>>(
      '/products',
      { params },
    );
    if (!data.success) throw new Error('Failed to load products');
    return {
      data: data.data,
      total: data.meta.total,
      page: data.meta.page,
      limit: data.meta.limit,
    };
  },

  /**
   * GET /products/:id — single product by UUID (full detail with variants).
   */
  getById: async (id: string): Promise<ProductDetail> => {
    const { data } = await apiClient.get<ApiResponse<ProductDetail>>(
      `/products/${id}`,
    );
    if (!data.success) throw new Error('Product not found');
    return data.data;
  },

  /**
   * GET /products/slug/:slug — single product by slug (full detail with variants).
   * Used by the canonical `/product/:slug` route so SEO-friendly URLs work.
   */
  getBySlug: async (slug: string): Promise<ProductDetail> => {
    const { data } = await apiClient.get<ApiResponse<ProductDetail>>(
      `/products/slug/${slug}`,
    );
    if (!data.success) throw new Error('Product not found');
    return data.data;
  },
};