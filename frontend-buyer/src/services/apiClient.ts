import axios, { type AxiosInstance } from 'axios';

const BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://localhost:3000/api';

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
  async (error) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean };

    // Let auth routes handle their own errors (e.g. 401 on login → show toast).
    const url = originalRequest?.url ?? '';
    if (url.includes('/auth/login') || url.includes('/auth/register')) {
      return Promise.reject(error);
    }

    // Attempt a single token refresh on 401, then retry the original request.
    // Guard against infinite loops (e.g. /refresh itself returns 401).
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const { data } = await axios.post(
          `${BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true },
        );

        const newToken = data.data.accessToken;
        const raw = localStorage.getItem('auth-storage');
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            parsed.state = parsed.state ?? {};
            parsed.state.token = newToken;
            parsed.state.isAuthenticated = true;
            localStorage.setItem('auth-storage', JSON.stringify(parsed));
          } catch {
            // ignore malformed storage
          }
        }

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch {
        // Refresh failed — clear everything and redirect to login.
        localStorage.removeItem('auth-storage');
        if (!window.location.pathname.includes('/auth/login')) {
          window.location.href = '/auth/login';
        }
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
