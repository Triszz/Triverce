import axios, { type AxiosInstance } from 'axios';

const BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://localhost:3000/api';

/**
 * Shared axios client for the seller dashboard.
 *
 * Mirrors the buyer's `apiClient.ts`:
 *  - Bearer token attached on every request from the persisted auth store
 *  - 401 responses clear the auth state and bounce to /login (handled by
 *    ProtectedRoute on the next render)
 *
 * Note: this client does not perform an automatic /auth/refresh round-trip
 * the way the buyer's does. The seller dashboard is internal/admin in
 * scope; a stale token simply logs the user out and lets them re-auth.
 */
const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Request interceptor: attach Bearer token ────────────────────────────────
apiClient.interceptors.request.use((config) => {
  const raw = localStorage.getItem('auth-storage');
  if (raw) {
    try {
      const { state } = JSON.parse(raw);
      if (state?.token) {
        config.headers.Authorization = `Bearer ${state.token}`;
      }
    } catch {
      // ignore malformed storage
    }
  }
  return config;
});

// ── Response interceptor: handle 401 (expired / invalid token) ───────────
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url: string = error.config?.url ?? '';

    // Don't redirect on auth endpoints — let the form surface the error
    // as a toast instead of bouncing the user.
    const isAuthEndpoint = url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/refresh');

    if (status === 401 && !isAuthEndpoint) {
      localStorage.removeItem('auth-storage');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
