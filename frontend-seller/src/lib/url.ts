/**
 * URL helpers.
 *
 * `toAbsoluteUrl` turns a relative path like `/uploads/products/abc.webp`
 * into an absolute one using `VITE_UPLOADS_URL`. Falls back to the
 * current window origin so it works in both dev (where Vite proxies
 * `/uploads` to the backend) and production (where the same origin
 * serves both).
 *
 * Usage:
 *   <img src={toAbsoluteUrl(url)} />
 *
 * In dev:     VITE_UPLOADS_URL=http://localhost:3000 → absolute URL
 *             (also handled by the Vite proxy, but the explicit URL
 *              avoids any proxy edge-cases in hot-reload scenarios).
 * In prod:    Set VITE_UPLOADS_URL=https://api.yourdomain.com so image
 *             src attributes resolve correctly regardless of CDN config.
 */

const UPLOADS_ORIGIN =
  (import.meta.env.VITE_UPLOADS_URL as string | undefined) ?? '';

/**
 * Convert a relative uploads path to an absolute URL.
 *
 * Accepts:
 *   - `/uploads/products/abc.webp`  →  `https://api.example.com/uploads/products/abc.webp`
 *   - `https://cdn.example.com/uploads/...`  →  returned as-is (already absolute)
 *   - falsy / empty → returned as-is
 */
export function toAbsoluteUrl(path: string | null | undefined): string {
  if (!path) return '';

  // Already absolute
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  const base = UPLOADS_ORIGIN || window.location.origin;
  // Ensure single slash between origin and path
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}
