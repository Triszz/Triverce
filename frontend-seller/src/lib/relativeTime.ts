/**
 * formatRelativeTime — render a `Date | string` as a short human
 * "n minutes ago" / "n hours ago" string.
 *
 * Mirrors common dashboard conventions (e.g. GitHub, Linear):
 *   - < 60 s   → "just now"
 *   - < 60 m   → "n minutes ago"
 *   - < 24 h   → "n hours ago"
 *   - < 7 d    → "n days ago"
 *   - else     → absolute date "12 Jun 2026"
 *
 * Pure function — no side effects, no React deps — so it can be
 * reused outside the notifications surface (e.g. activity feeds).
 */
export function formatRelativeTime(input: Date | string): string {
  const date = input instanceof Date ? input : new Date(input);
  const now = Date.now();
  const diffMs = now - date.getTime();

  // Defensive: clock skew or future-dated row from a buggy client
  // clock — fall back to "just now" rather than showing a negative
  // duration.
  if (Number.isNaN(diffMs) || diffMs < 0) return 'just now';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
