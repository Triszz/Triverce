import apiClient, { API_ORIGIN } from './apiClient';
import type { ApiResponse } from '@/types/api';

/* ──────────────────────────────────────────────────────────────────────────
 * Domain types
 * ────────────────────────────────────────────────────────────────────────── */

/** `GET /api/seller/:sellerId` — public store profile. */
export interface StoreProfile {
  id: string;
  storeName: string | null;
  logoUrl: string | null;
  description: string | null;
  supportEmail: string | null;
  phone: string | null;
  address: string | null;
  joinedAt: string;   // ISO date string — derived from the seller's createdAt
  productCount: number; // count of active products for this seller
}

/* ──────────────────────────────────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Convert a possibly-relative upload URL to an absolute URL against the
 * backend origin. Relative paths (e.g. `/uploads/logos/abc.webp`) become
 * `http://localhost:3000/uploads/logos/abc.webp`. Already-absolute URLs are
 * returned unchanged.
 */
function qualifyUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_ORIGIN}${url}`;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Service
 * ────────────────────────────────────────────────────────────────────────── */

export const storeService = {
  /**
   * GET /seller/:sellerId — public store profile with active product count.
   * The apiClient base URL already includes /api, so pass /seller/:sellerId.
   * Returns 404 if the seller doesn't exist.
   */
  getStoreById: async (sellerId: string): Promise<StoreProfile> => {
    const { data } = await apiClient.get<ApiResponse<StoreProfile>>(
      `/seller/${sellerId}`,
    );
    if (!data.success) throw new Error('Store not found');
    return {
      ...data.data,
      logoUrl: qualifyUrl(data.data.logoUrl),
    };
  },
};
