import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  productService,
  type CreateProductDTO,
  type CreateVariantDTO,
  type Product,
  type ProductVariant,
  type UpdateProductDTO,
  type UpdateVariantDTO,
} from '../services/productService';

const PRODUCTS_KEY = ['seller-products'] as const;
const CATEGORIES_KEY = ['categories'] as const;
const productKey = (id: string) => ['product', id] as const;

/** Pull a friendly error message out of an axios-shaped error. */
function extractError(error: unknown, fallback: string): string {
  return (
    (error as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ??
    (error as Error)?.message ??
    fallback
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Product list + categories
 * ────────────────────────────────────────────────────────────────────────── */

export function useSellerProducts() {
  const sellerId = useAuthStore((s) => s.user?.id);

  return useQuery<Product[]>({
    queryKey: [...PRODUCTS_KEY, sellerId],
    enabled: Boolean(sellerId),
    queryFn: () => productService.getSellerProducts(sellerId as string),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: [...CATEGORIES_KEY],
    queryFn: () => productService.getCategories(),
    staleTime: 5 * 60_000, // categories rarely change
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * Product mutation hooks
 * ────────────────────────────────────────────────────────────────────────── */

interface CreateProductArgs {
  dto: CreateProductDTO;
  /** Up to 10 image files; backend persists them in array order (first = primary). */
  images: File[];
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ dto, images }: CreateProductArgs) =>
      productService.createProduct(dto, images),
    onSuccess: () => {
      toast.success('Product created successfully');
      queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
    },
    onError: (error: unknown) => {
      toast.error(extractError(error, 'Failed to create product'));
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => productService.deleteProduct(id),
    onSuccess: () => {
      toast.success('Product deleted');
      queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
    },
    onError: (error: unknown) => {
      toast.error(extractError(error, 'Failed to delete product'));
    },
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * Single-product detail (used by the edit page)
 * ────────────────────────────────────────────────────────────────────────── */

export function useProduct(productId: string | undefined) {
  return useQuery<Product>({
    queryKey: productKey(productId ?? ''),
    enabled: Boolean(productId),
    queryFn: () => productService.getProductById(productId as string),
    // Product detail is small and changes on every mutation — keep
    // default staleTime; explicitly invalidate from mutations.
  });
}

export function useUpdateProduct(productId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: UpdateProductDTO) =>
      productService.updateProduct(productId, dto),
    onSuccess: () => {
      toast.success('Product updated');
      queryClient.invalidateQueries({ queryKey: productKey(productId) });
      queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
    },
    onError: (error: unknown) => {
      toast.error(extractError(error, 'Failed to update product'));
    },
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * Variant mutations
 * ────────────────────────────────────────────────────────────────────────── */

export function useCreateVariant(productId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateVariantDTO) =>
      productService.createVariant(productId, dto),
    onSuccess: () => {
      toast.success('Variant added');
      queryClient.invalidateQueries({ queryKey: productKey(productId) });
    },
    onError: (error: unknown) => {
      toast.error(extractError(error, 'Failed to add variant'));
    },
  });
}

export function useUpdateVariant(productId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (args: { variantId: string; dto: UpdateVariantDTO }) =>
      productService.updateVariant(productId, args.variantId, args.dto),
    onSuccess: (variant: ProductVariant) => {
      toast.success('Variant updated');
      queryClient.invalidateQueries({ queryKey: productKey(productId) });
      // Touch variant-specific hooks too if any module adds them later.
      queryClient.invalidateQueries({ queryKey: ['variant', variant.id] });
    },
    onError: (error: unknown) => {
      toast.error(extractError(error, 'Failed to update variant'));
    },
  });
}

export function useDeleteVariant(productId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variantId: string) =>
      productService.deleteVariant(productId, variantId),
    onSuccess: () => {
      toast.success('Variant deleted');
      queryClient.invalidateQueries({ queryKey: productKey(productId) });
    },
    onError: (error: unknown) => {
      toast.error(extractError(error, 'Failed to delete variant'));
    },
  });
}

/** Set absolute stock level for a variant. Used by the inventory input. */
export function useSetVariantInventory(productId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (args: { variantId: string; quantity: number }) =>
      productService.setVariantInventory(args.variantId, args.quantity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKey(productId) });
    },
    onError: (error: unknown) => {
      toast.error(extractError(error, 'Failed to update inventory'));
    },
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * Image upload hooks
 *
 * Both endpoints (POST /api/upload/products/:id, POST /api/upload/variants/:id)
 * only WRITE the file to disk — they don't persist the URL on the row. So
 * the caller has to follow up with a PATCH for the URL to stick. We keep
 * the URL/result in the mutation return value so callers can chain.
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Multi-image upload hook.
 *
 * Returns the raw `UploadResult[]` from the server (one per uploaded
 * file). Does **not** toast on success — the Save-gallery flow owns the
 * user-facing toast because that's the point where the upload is
 * actually committed to the database. We still invalidate the product
 * cache here so the dashboard re-renders if a *different* surface
 * (e.g. a script) uploads files separately.
 *
 * No DB mutation happens in the upload endpoint — see backend
 * `upload.controller.ts`. The dashboard's Save button is responsible
 * for calling `setProductImages` with the final array.
 */
export function useUploadProductImages(productId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (files: File[]) => {
      if (files.length === 0) {
        throw new Error('No files to upload');
      }
      return productService.uploadProductImages(productId, files);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKey(productId) });
      queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
    },
    onError: (error: unknown) => {
      toast.error(extractError(error, 'Failed to upload product image'));
    },
  });
}

/**
 * Wholesale gallery replacement (drag-to-reorder, remove). The cached
 * `useProduct(id)` query is invalidated to surface the new ordering.
 */
export function useSetProductImages(productId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (imageUrls: string[]) =>
      productService.setProductImages(productId, imageUrls),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKey(productId) });
      queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
    },
    onError: (error: unknown) => {
      toast.error(extractError(error, 'Failed to update gallery'));
    },
  });
}

export function useUploadVariantImage(productId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: { variantId: string; file: File }) => {
      const result = await productService.uploadVariantImage(
        args.variantId,
        args.file,
      );
      const absoluteUrl = toAbsoluteUrl(result.url);
      await productService.updateVariant(productId, args.variantId, {
        imageUrl: absoluteUrl,
      });
      return { ...result, absoluteUrl };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKey(productId) });
    },
    onError: (error: unknown) => {
      toast.error(extractError(error, 'Failed to upload variant image'));
    },
  });
}

/**
 * Convert a relative upload URL (`/uploads/products/<id>-<ts>.webp`)
 * into an absolute one when the seller / buyer apps live on different
 * origins in production. Backends running on the same origin (dev)
 * already have a working `src` value as-is.
 */
function toAbsoluteUrl(relativeUrl: string): string {
  if (!relativeUrl) return relativeUrl;
  const origin = (
    import.meta.env.VITE_API_URL as string | undefined ??
    'http://localhost:3000/api'
  ).replace(/\/api\/?$/, '');
  return relativeUrl.startsWith('http') ? relativeUrl : `${origin}${relativeUrl}`;
}