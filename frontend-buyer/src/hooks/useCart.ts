import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  cartService,
  type AddCartItemPayload,
  type CartPublic,
  type UpdateCartItemPayload,
} from '@/services/cartService';

/* ──────────────────────────────────────────────────────────────────────────
 * Cart query keys
 *
 * Centralising query keys here means invalidation never goes stale —
 * every mutation invalidates the single `cartKeys.all()` key, so the UI
 * always re-fetches whenever the cart shape changes.
 * ──────────────────────────────────────────────────────────────────────── */

export const cartKeys = {
  all: () => ['cart'] as const,
  detail: () => [...cartKeys.all(), 'detail'] as const,
};

/** Empty cart placeholder returned for guests (so consumers can render
 *  an empty-state without first guarding for `undefined`). */
const EMPTY_CART: CartPublic = {
  id: '',
  status: 'active',
  items: [],
  totalItems: 0,
  totalPrice: 0,
  updatedAt: new Date(0).toISOString(),
};

/* ──────────────────────────────────────────────────────────────────────────
 * useCart — main consumer hook
 * ──────────────────────────────────────────────────────────────────────── */

export interface UseCartResult {
  /** Full cart payload. `null` while the query is loading for a guest. */
  cart: CartPublic | null;
  totalItems: number;
  totalPrice: number;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  isAuthenticated: boolean;
  addItem: (payload: AddCartItemPayload) => Promise<CartPublic>;
  updateItem: (
    itemId: string,
    payload: UpdateCartItemPayload,
  ) => Promise<CartPublic>;
  removeItem: (itemId: string) => Promise<CartPublic>;
  clear: () => Promise<CartPublic>;
  /** Individual mutation loading flags for fine-grained UI feedback. */
  isAdding: boolean;
  isUpdating: boolean;
  isRemoving: boolean;
  isClearing: boolean;
}

/**
 * The single source of truth for cart state across the buyer storefront.
 *
 * Design notes:
 *   • For unauthenticated users we short-circuit: the GET query is
 *     `enabled: false`, so the cart fetch never fires. The mutations
 *     refuse to call the API and instead surface a Sonner toast +
 *     redirect guests to /auth/login.
 *   • Every successful mutation invalidates `cartKeys.detail()` so the
 *     cart drawer, header badge, and full /cart page all stay in sync.
 *   • 400-level errors carry the backend's `message` (e.g. "Not enough
 *     stock…"). 401 is treated as "session expired" and is left to the
 *     shared apiClient's response interceptor to handle.
 */
export function useCart(): UseCartResult {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  /* ── Query: fetch the cart (only when authenticated) ──────────────── */

  const cartQuery = useQuery({
    queryKey: cartKeys.detail(),
    queryFn: () => cartService.get(),
    enabled: isAuthenticated,
    // Cart is a per-user resource — never share cache across users.
    staleTime: 30_000,
  });

  /* ── Auth guard helper ─────────────────────────────────────────────── */

  /**
   * If a mutation is called by an unauthenticated user, we don't even
   * attempt the request — we toast and bounce them to /auth/login instead,
   * so they don't see an instant 401 in the cart UI.
   */
  const guardAuth = useCallback((): boolean => {
    if (isAuthenticated) return true;
    toast.error('Please log in to use the cart');
    navigate('/auth/login', { replace: true });
    return false;
  }, [isAuthenticated, navigate]);

  /* ── Helpers: error normalisation + invalidation ──────────────────── */

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: cartKeys.detail() });
  }, [queryClient]);

  /**
   * Axios errors carry the backend envelope in `error.response.data`.
   * For everything else we fall back to the message; otherwise the user
   * sees a generic "Network error".
   *
   * The "Not enough stock" case is intercepted here so we return a
   * friendly, consistent message instead of the raw backend detail.
   */
  const formatError = (err: unknown): string => {
    const anyErr = err as {
      response?: { data?: { message?: string } };
      message?: string;
    };
    const raw =
      anyErr?.response?.data?.message ??
      anyErr?.message ??
      'Something went wrong. Please try again.';

    if (raw.toLowerCase().includes('not enough stock')) {
      return 'Not enough stock available.';
    }
    return raw;
  };

  /** A dedicated toast ID so Sonner deduplicates repeated stock-limit errors. */
  const STOCK_ERROR_TOAST_ID = 'cart-stock-error';

  const handleError = (err: unknown): never => {
    toast.error(formatError(err), { id: STOCK_ERROR_TOAST_ID });
    throw err;
  };

  /* ── Mutations ─────────────────────────────────────────────────────── */

  const addMutation = useMutation({
    mutationFn: (payload: AddCartItemPayload) => cartService.addItem(payload),
    onSuccess: () => invalidate(),
    onError: handleError,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      itemId,
      payload,
    }: {
      itemId: string;
      payload: UpdateCartItemPayload;
    }) => cartService.updateItem(itemId, payload),
    onSuccess: () => invalidate(),
    onError: handleError,
  });

  const removeMutation = useMutation({
    mutationFn: (itemId: string) => cartService.removeItem(itemId),
    // Optimistically remove from the cache so the row disappears instantly.
    onMutate: async (itemId) => {
      await queryClient.cancelQueries({ queryKey: cartKeys.detail() });
      const previous = queryClient.getQueryData<CartPublic>(cartKeys.detail());
      if (previous) {
        const item = previous.items.find((i) => i.id === itemId);
        if (item) {
          const remaining = previous.items.filter((i) => i.id !== itemId);
          const totalItems = remaining.reduce((s, i) => s + i.quantity, 0);
          const totalPrice = remaining.reduce((s, i) => s + i.subtotal, 0);
          queryClient.setQueryData<CartPublic>(cartKeys.detail(), {
            ...previous,
            items: remaining,
            totalItems,
            totalPrice,
          });
        }
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Roll back the optimistic update on failure.
      if (context?.previous) {
        queryClient.setQueryData(cartKeys.detail(), context.previous);
      }
    },
    onSettled: () => invalidate(),
  });

  const clearMutation = useMutation({
    mutationFn: () => cartService.clear(),
    onSuccess: () => invalidate(),
    onError: handleError,
  });

  /* ── Auth-gated wrappers ───────────────────────────────────────────── */

  const addItem = useCallback(
    async (payload: AddCartItemPayload): Promise<CartPublic> => {
      if (!guardAuth()) return EMPTY_CART;
      const result = await addMutation.mutateAsync(payload);
      return result;
    },
    [addMutation, guardAuth],
  );

  const updateItem = useCallback(
    async (
      itemId: string,
      payload: UpdateCartItemPayload,
    ): Promise<CartPublic> => {
      if (!guardAuth()) return EMPTY_CART;
      const result = await updateMutation.mutateAsync({ itemId, payload });
      return result;
    },
    [updateMutation, guardAuth],
  );

  const removeItem = useCallback(
    async (itemId: string): Promise<CartPublic> => {
      if (!guardAuth()) return EMPTY_CART;
      const result = await removeMutation.mutateAsync(itemId);
      return result;
    },
    [removeMutation, guardAuth],
  );

  const clear = useCallback(async (): Promise<CartPublic> => {
    if (!guardAuth()) return EMPTY_CART;
    const result = await clearMutation.mutateAsync();
    return result;
  }, [clearMutation, guardAuth]);

  /* ── Derived values ────────────────────────────────────────────────── */

  const cart: CartPublic | null = isAuthenticated
    ? (cartQuery.data ?? null)
    : EMPTY_CART;

  return {
    cart,
    totalItems: cart?.totalItems ?? 0,
    totalPrice: cart?.totalPrice ?? 0,
    isLoading: isAuthenticated && cartQuery.isLoading,
    isError: isAuthenticated && cartQuery.isError,
    error: cartQuery.error,
    isAuthenticated,
    addItem,
    updateItem,
    removeItem,
    clear,
    isAdding: addMutation.isPending,
    isUpdating: updateMutation.isPending,
    isRemoving: removeMutation.isPending,
    isClearing: clearMutation.isPending,
  };
}
