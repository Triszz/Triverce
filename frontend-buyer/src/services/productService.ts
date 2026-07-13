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
   * Hero image. Backend sets it to `images[0]`, then the cheapest active
   * variant's `imageUrl`, then `null`. Older endpoints (or callers that
   * haven't refreshed their contracts) can still read this field; new
   * components prefer `pickHeroImage(product)` for a single source of
   * truth.
   */
  imageUrl: string | null;
  /**
   * Ordered list of gallery images, as served by the backend's
   * `getEffectiveImages()` helper. Element [0] is the primary image.
   * May be missing on older payloads — callers should fall back to
   * `imageUrl`.
   */
  images?: string[];
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
  /** Available quantity: total inventory minus reserved stock. */
  available?: number;
}

/** `ProductEntity.toPublicDetail()` — full product with variants. */
export interface ProductDetail extends Omit<ProductSummary, 'imageUrl'> {
  description: string | null;
  createdAt: string;
  updatedAt: string;
  /**
   * The product gallery. May contain variant imageUrls as a legacy
   * fallback when the product was created before the multi-image
   * rollout (see backend `ProductEntity.getEffectiveImages`).
   */
  images: string[];
  /** Convenience field — same as `images[0]`. Kept for back-compat. */
  imageUrl: string | null;
  variants: ProductVariant[];
}

/**
 * Pick the best hero image for a product. Resolution order:
 *
 *   1. `images[0]` (the persisted gallery array — preferred).
 *   2. `imageUrl` (legacy field — populated by the backend fallback).
 *   3. First active variant's `imageUrl`.
 *   4. `null` (renderers should fall back to a placeholder).
 *
 * Centralising this here means every catalog surface uses the same
 * precedence — important after the single-image → multi-image
 * migration so we don't end up with one card showing the variant image
 * and another showing the gallery hero.
 */
export function pickHeroImage(product: ProductSummary | ProductDetail): string | null {
  const images = (product as { images?: string[] }).images;
  if (images && images.length > 0) return images[0];
  if (product.imageUrl) return product.imageUrl;
  return null;
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