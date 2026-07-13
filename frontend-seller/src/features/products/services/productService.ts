import apiClient from '@/lib/apiClient';

/* ──────────────────────────────────────────────────────────────────────────
 * Domain types — mirror backend ProductEntity / CategoryEntity.
 *
 * Only the fields this dashboard actually consumes are declared; the
 * backend may return additional keys that we silently ignore.
 * ────────────────────────────────────────────────────────────────────────── */

export interface ProductVariantAttribute {
  attributeId?: string;
  /** Display name (e.g. "color"). Always lowercased before sent to backend. */
  attributeName: string;
  value: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  price: number;
  imageUrl: string | null;
  isActive: boolean;
  attributes?: ProductVariantAttribute[];
  /** Computed by the backend in `loadVariantsWithAttributes`. */
  available?: number | null;
  stockStatus?: 'in_stock' | 'low_stock' | 'out_of_stock';
  createdAt?: string;
  updatedAt?: string;
}

/** Friendly display name for a variant, derived from its attributes. */
export function variantDisplayName(variant: ProductVariant): string {
  const attrs = variant.attributes ?? [];
  if (attrs.length === 0) return variant.sku;
  return attrs
    .map((a) => a.value)
    .filter(Boolean)
    .join(' • ');
}

export interface Product {
  id: string;
  sellerId: string;
  categoryId: string | null;
  name: string;
  slug: string;
  description: string | null;
  basePrice: number;
  minPrice?: number;
  maxPrice?: number;
  /** Main/thumbnail URL kept for backwards compatibility with any caller that only cares about the hero image. */
  imageUrl?: string | null;
  /**
   * Ordered list of all product images. Element [0] is the primary /
   * thumbnail image by convention. Empty array on a product that
   * hasn't been uploaded yet.
   */
  images?: string[];
  isActive: boolean;
  variants?: ProductVariant[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  parentId?: string | null;
  isActive: boolean;
  sortOrder?: number;
}

/**
 * Payload accepted by `POST /api/products`.
 *
 * The backend requires at least one variant; we always create a single
 * default variant so the simple Create form on this dashboard doesn't
 * have to expose SKU/variant fields.
 */
export interface CreateProductDTO {
  name: string;
  description?: string;
  basePrice: number;
  categoryId?: string;
  isActive?: boolean;
}

/**
 * Payload accepted by `PATCH /api/products/:id`. All fields are optional —
 * the backend accepts a partial update.
 */
export interface UpdateProductDTO {
  name?: string;
  description?: string;
  basePrice?: number;
  categoryId?: string | null;
  isActive?: boolean;
  /**
   * Wholesale gallery replacement. Used by the reorder / remove flow;
   * uploading adds to this array on the backend, so uploads don't need
   * to round-trip the existing list.
   */
  images?: string[];
}

/** Payload accepted by `POST /api/products/:id/variants`. */
export interface CreateVariantDTO {
  sku: string;
  price: number;
  imageUrl?: string;
  isActive?: boolean;
  attributes?: Record<string, string>;
}

/** Payload accepted by `PATCH /api/products/:id/variants/:vid`. */
export interface UpdateVariantDTO {
  sku?: string;
  price?: number;
  imageUrl?: string | null;
  isActive?: boolean;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Internal response shapes — match backend `success: true` envelope.
 * ────────────────────────────────────────────────────────────────────────── */

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface ApiPaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: { total: number; page: number; limit: number };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Upload helper — `POST /api/upload/products/:productId` returns the
 * public `/uploads/products/<id>-<ts>.webp` URL once sharp has
 * processed the file.
 * ────────────────────────────────────────────────────────────────────────── */

interface UploadResult {
  url: string;
  fileName: string;
  originalName: string;
  size: number;
  mimeType: string;
}

/**
 * Response shape of `POST /api/upload/products/:productId`.
 *
 * `images` is the freshly uploaded `UploadResult[]` (one per uploaded
 * file), and `storedImages` is the full `images[]` array as persisted on
 * the product row after the upload — it includes both previously
 * uploaded images and the new ones.
 */
interface UploadProductsResult {
  images: UploadResult[];
  storedImages: string[];
}

/** Public products under `sellerId` for the logged-in seller. */
async function getSellerProducts(sellerId: string): Promise<Product[]> {
  const { data } = await apiClient.get<ApiPaginatedResponse<Product>>(
    '/products',
    {
      params: { sellerId, limit: 100, sortBy: 'created_desc' },
    },
  );
  return data.data;
}

/** Single product with full `variants[]` payload (`toPublicDetail`). */
async function getProductById(id: string): Promise<Product> {
  const { data } = await apiClient.get<ApiResponse<Product>>(`/products/${id}`);
  if (!data.success) throw new Error('Product not found');
  return data.data;
}

async function updateProduct(
  id: string,
  dto: UpdateProductDTO,
): Promise<Product> {
  const { data } = await apiClient.patch<ApiResponse<Product>>(
    `/products/${id}`,
    dto,
  );
  return data.data;
}

async function createVariant(
  productId: string,
  dto: CreateVariantDTO,
): Promise<ProductVariant> {
  const { data } = await apiClient.post<ApiResponse<ProductVariant>>(
    `/products/${productId}/variants`,
    {
      ...dto,
      // Backend lowercases attribute names server-side; we pre-normalize
      // so the dashboard immediately reflects the canonical key.
      attributes: Object.fromEntries(
        Object.entries(dto.attributes ?? {}).map(([k, v]) => [
          k.toLowerCase().trim(),
          v,
        ]),
      ),
    },
  );
  return data.data;
}

async function updateVariant(
  productId: string,
  variantId: string,
  dto: UpdateVariantDTO,
): Promise<ProductVariant> {
  const { data } = await apiClient.patch<ApiResponse<ProductVariant>>(
    `/products/${productId}/variants/${variantId}`,
    dto,
  );
  return data.data;
}

async function deleteVariant(productId: string, variantId: string): Promise<void> {
  await apiClient.delete<ApiResponse<null>>(
    `/products/${productId}/variants/${variantId}`,
  );
}

async function setVariantInventory(
  variantId: string,
  quantity: number,
): Promise<void> {
  await apiClient.patch<ApiResponse<unknown>>(
    `/inventory/variant/${variantId}/set`,
    { quantity },
  );
}

/**
 * Upload an image for a product. The backend returns a relative URL
 * (e.g., `/uploads/products/<id>-<ts>.webp`) — we return the URL so
 * the caller can persist it onto the product row via PATCH.
 *
 * Why multipart via fetch wrapper: multer expects a `multipart/form-data`
 * body with a single `image` field; axios sets the right header for us.
 */
async function uploadVariantImage(
  variantId: string,
  file: File,
): Promise<UploadResult> {
  const fd = new FormData();
  fd.append('image', file);
  const { data } = await apiClient.post<ApiResponse<UploadResult>>(
    `/upload/variants/${variantId}`,
    fd,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data.data;
}

async function getCategories(): Promise<Category[]> {
  const { data } = await apiClient.get<ApiPaginatedResponse<Category>>(
    '/categories',
    { params: { limit: 100 } },
  );
  return data.data;
}

async function deleteProduct(id: string): Promise<void> {
  await apiClient.delete<ApiResponse<null>>(`/products/${id}`);
}

/**
 * Full create flow:
 *   1. `POST /api/products` — creates the product with a single default
 *      variant (price mirrors `basePrice`).
 *   2. `POST /api/upload/products/:productId` — uploads each selected
 *      image; the backend now persists `images[]` on the row for us.
 *   3. `PATCH /api/products/:id` — sets `description` (description lives
 *      on the product, not the variant) and is the only JSON writeback
 *      we still need once images are persisted via the upload endpoint.
 *
 * The backend's `/api/products` endpoint is JSON-validated by Zod and
 * `/api/upload/products/:productId` requires the product to exist — so
 * the two calls can't be merged into a single multipart POST. This
 * orchestration keeps the API contract intact.
 */
async function createProduct(
  dto: CreateProductDTO,
  images: File[],
): Promise<Product> {
  const slug = slugify(dto.name);

  const created = await apiClient.post<ApiResponse<Product>>('/products', {
    ...dto,
    slug,
    isActive: dto.isActive ?? true,
    variants: [
      {
        sku: `${slug}-default`,
        price: dto.basePrice,
        isActive: true,
        attributes: {},
      },
    ],
  });
  const product = created.data.data;

  // Always update description so empty strings ("") get normalized
  // back to null on the server; this write is cheap and keeps state
  // consistent regardless of which fields the seller touched.
  await apiClient.patch<ApiResponse<Product>>(`/products/${product.id}`, {
    description: dto.description ?? null,
  });

  if (images.length > 0) {
    const fd = new FormData();
    for (const file of images) fd.append('images', file);

    await apiClient.post<ApiResponse<UploadProductsResult>>(
      `/upload/products/${product.id}`,
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
  }

  return product;
}

/**
 * Upload one or more images for an existing product. The backend
 * appends them to `images[]` atomically and returns the full final
 * array under `storedImages`, so the dashboard needs no separate PATCH.
 */
async function uploadProductImages(
  productId: string,
  files: File[],
): Promise<UploadProductsResult> {
  if (files.length === 0) return { images: [], storedImages: [] };
  const fd = new FormData();
  for (const file of files) fd.append('images', file);
  const { data } = await apiClient.post<ApiResponse<UploadProductsResult>>(
    `/upload/products/${productId}`,
    fd,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data.data;
}

/**
 * Replace the product's entire gallery (drag-to-reorder, remove). Uses
 * the dedicated PUT endpoint — separate from PATCH so it's traceable
 * in audit logs and easy to gate behind a feature flag later.
 */
async function setProductImages(
  productId: string,
  imageUrls: string[],
): Promise<string[]> {
  const { data } = await apiClient.put<ApiResponse<{ images: string[] }>>(
    `/products/${productId}/images`,
    { images: imageUrls },
  );
  return data.data.images;
}

export const productService = {
  getSellerProducts,
  getProductById,
  updateProduct,
  getCategories,
  createProduct,
  deleteProduct,
  // Variant CRUD
  createVariant,
  updateVariant,
  deleteVariant,
  setVariantInventory,
  // Image uploads (multi-image for products, single for variants)
  uploadProductImages,
  uploadVariantImage,
  // Gallery management (reorder / remove)
  setProductImages,
};

/* ──────────────────────────────────────────────────────────────────────────
 * Small slug helper — mirrors backend's slugSchema regex. Kept here so
 * the seller form can pre-fill a valid slug without a separate round-trip.
 * ────────────────────────────────────────────────────────────────────────── */

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  // Append a short random suffix to avoid the rare slug collision
  // (the backend still validates uniqueness and will 409 if needed).
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || 'product'}-${suffix}`;
}