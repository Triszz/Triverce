import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Minimal public-user shape returned by the backend's auth endpoints.
 * Mirrors the buyer's `services/authService.ts` UserPublic so the two
 * frontends stay aligned on the identity model.
 */
export interface UserPublic {
  id: string;
  email: string;
  fullName: string;
  role: 'customer' | 'admin' | 'seller';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AuthState {
  user: UserPublic | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: UserPublic, token: string) => void;
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

      clearAuth: () =>
        set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
      // Persist BOTH token and user so refreshes restore the session
      // instantly. Stale tokens self-heal: the apiClient's 401
      // interceptor calls `clearAuth()` on the next protected request.
      partialize: (state) => ({
        token: state.token,
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // A persisted token without a user (or vice-versa) is a half-
        // state we can't trust — treat it as logged-out.
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
