import apiClient from './apiClient';

/* ──────────────────────────────────────────────────────────────────────────
 * Cart service — thin wrapper around the `/cart` endpoints.
 *
 * The backend routes are all behind `authenticate + requireRole('customer')`,
 * so every call here assumes an authenticated customer. The auth check
 * lives one layer up in `useCart` so the service itself stays dumb.
 * ──────────────────────────────────────────────────────────────────────── */

/** Shape returned by `cart/items` endpoints. */
export interface CartItemPublic {
  id: string;
  variantId: string;
  quantity: number;
  sku?: string;
  price?: number;
  productName?: string;
  productSlug?: string;
  imageUrl?: string | null;
  subtotal: number;
  /** Available quantity: total inventory minus reserved stock. Used to enforce stock limits on the UI. */
  availableStock?: number;
  updatedAt: string;
}

/** Shape returned by `GET /cart`. */
export interface CartPublic {
  id: string;
  status: 'active' | 'checked_out' | 'abandoned';
  items: CartItemPublic[];
  totalItems: number;
  totalPrice: number;
  updatedAt: string;
}

/** Payload accepted by `POST /cart/items` (mirrors `AddCartItemDto`). */
export interface AddCartItemPayload {
  variantId: string;
  quantity: number;
}

/** Payload accepted by `PATCH /cart/items/:itemId` (mirrors `UpdateCartItemDto`). */
export interface UpdateCartItemPayload {
  quantity: number;
}

interface ApiSuccess<T> {
  success: true;
  data: T;
}

function unwrap<T>(payload: ApiSuccess<T>): T {
  if (!payload.success) throw new Error('Cart request failed');
  return payload.data;
}

export const cartService = {
  /** GET /cart — fetch the full active cart for the current customer. */
  get: async (): Promise<CartPublic> => {
    const { data } = await apiClient.get<ApiSuccess<CartPublic>>('/cart');
    return unwrap(data);
  },

  /** POST /cart/items — add (or top up) a variant in the cart. */
  addItem: async (payload: AddCartItemPayload): Promise<CartPublic> => {
    const { data } = await apiClient.post<ApiSuccess<CartPublic>>(
      '/cart/items',
      payload,
    );
    return unwrap(data);
  },

  /** PATCH /cart/items/:itemId — set the absolute quantity for an item. */
  updateItem: async (
    itemId: string,
    payload: UpdateCartItemPayload,
  ): Promise<CartPublic> => {
    const { data } = await apiClient.patch<ApiSuccess<CartPublic>>(
      `/cart/items/${encodeURIComponent(itemId)}`,
      payload,
    );
    return unwrap(data);
  },

  /** DELETE /cart/items/:itemId — remove a single cart item. */
  removeItem: async (itemId: string): Promise<CartPublic> => {
    const { data } = await apiClient.delete<ApiSuccess<CartPublic>>(
      `/cart/items/${encodeURIComponent(itemId)}`,
    );
    return unwrap(data);
  },

  /** DELETE /cart — clear every item from the cart. */
  clear: async (): Promise<CartPublic> => {
    const { data } = await apiClient.delete<ApiSuccess<CartPublic>>('/cart');
    return unwrap(data);
  },
};
