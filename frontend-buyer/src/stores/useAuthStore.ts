import type { UserPublic } from '../services/authService';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  user: UserPublic | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: UserPublic, token: string) => void;
  /**
   * In-place user update. Used by mutations like
   * `useUpdateProfile` so the Header, AccountPage, and any other
   * component reading from the auth store reflect the new fields
   * without a full re-login or page reload.
   */
  setUser: (user: UserPublic) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      setAuth: (user, token) =>
        set({ user, token, isAuthenticated: true }),

      setUser: (user) =>
        set((state) => ({
          user,
          // isAuthenticated can't flip false from a profile update —
          // we only ever patch the user object in-place.
          isAuthenticated: state.isAuthenticated && true,
        })),

      clearAuth: () =>
        set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
      // Persist BOTH the token AND the user object so that page refreshes
      // (and full reloads) restore the full session instantly. Without
      // this the Header renders as logged-out until the user revisits
      // a guarded page, and the AccountPage / CartPage prompt to sign in.
      //
      // Stale-token handling: if a token ever goes bad, the apiClient's
      // 401 interceptor will call `clearAuth()` (and redirect) before any
      // protected request resolves, so a stale persisted state self-heals
      // on the next protected API call.
      partialize: (state) => ({
        token: state.token,
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // A persisted token without a user (or vice-versa) is a half-state
        // we don't want to trust — treat it as logged-out.
        const hasPair = Boolean(state.token) && Boolean(state.user);
        state.isAuthenticated = hasPair;
        if (!hasPair) {
          state.token = null;
          state.user = null;
        }
      },
    },
  ),
);