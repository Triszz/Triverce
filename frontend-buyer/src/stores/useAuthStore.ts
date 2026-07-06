import type { UserPublic } from '../services/authService';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
      // Only persist the token; user is re-fetched on session resume.
      partialize: (state) => ({ token: state.token }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isAuthenticated = Boolean(state.token);
        }
      },
    },
  ),
);
