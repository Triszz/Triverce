import { create } from 'zustand';

/**
 * useUiStore — tiny global store for cross-cutting UI flags.
 *
 * Currently owns the cart drawer's open/close state so any component
 * (Header, ProductDetailPage, CartItemRow's "View cart" link, etc.)
 * can request that the drawer open itself.
 *
 * For data-bearing state we keep using TanStack Query, so this stays
 * stateless w.r.t. server data — it's purely a presentation switch.
 */
interface UiState {
  /** Whether the cart slide-over is visible. */
  cartDrawerOpen: boolean;
  openCartDrawer: () => void;
  closeCartDrawer: () => void;
  /**
   * Toggle helper. Not currently used in production UI but exposed for
   * the dev playground and for future keyboard shortcuts.
   */
  toggleCartDrawer: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  cartDrawerOpen: false,
  openCartDrawer: () => set({ cartDrawerOpen: true }),
  closeCartDrawer: () => set({ cartDrawerOpen: false }),
  toggleCartDrawer: () =>
    set((state) => ({ cartDrawerOpen: !state.cartDrawerOpen })),
}));
