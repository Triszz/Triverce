/* ──────────────────────────────────────────────────────────────────────────
 * Lightweight formatting helpers used across the buyer storefront.
 *
 * These are intentionally tiny and side-effect-free so they're easy to
 * import anywhere (components, hooks, tests) without dragging in a
 * date library. For "Member since" / createdAt fields we lean on
 * `Intl.DateTimeFormat` and cache the formatter at module scope for
 * amortised free re-renders.
 * ──────────────────────────────────────────────────────────────────────── */

const LONG_DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

const MEDIUM_DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const SHORT_DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: '2-digit',
});

/**
 * Parses an ISO date string or `Date` into a `Date`, returning `null`
 * when the input is missing or invalid (rather than the JS default of
 * `Invalid Date`, which silently serialises to "Invalid DateTime").
 */
function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Long form: "07 July 2026". Use for milestone / biographical labels
 * like "Member since".
 */
export function formatDateLong(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  return d ? LONG_DATE_FMT.format(d) : '—';
}

/**
 * Medium form: "07 Jul 2026". General-purpose UI date.
 */
export function formatDate(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  return d ? MEDIUM_DATE_FMT.format(d) : '—';
}

/**
 * Short form: "07 Jul 26". Compact summary for table cells.
 */
export function formatDateShort(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  return d ? SHORT_DATE_FMT.format(d) : '—';
}

/**
 * "2 days ago" / "in 3 hours" — coarse-grained relative time. Returns
 * `null` if the date can't be parsed, so the caller can choose a
 * fallback (e.g. absolute date).
 */
export function formatRelativeTime(
  value: string | number | Date | null | undefined,
  now: Date = new Date(),
): string | null {
  const d = toDate(value);
  if (!d) return null;

  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const abs = Math.abs(diffSec);

  const minute = 60;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;

  const fmt = (n: number, unit: Intl.RelativeTimeFormatUnit): string => {
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    return rtf.format(-Math.sign(diffSec) * Math.round(n), unit);
  };

  if (abs < minute) return 'just now';
  if (abs < hour) return fmt(abs / minute, 'minute');
  if (abs < day) return fmt(abs / hour, 'hour');
  if (abs < week) return fmt(abs / day, 'day');
  if (abs < month) return fmt(abs / week, 'week');
  if (abs < year) return fmt(abs / month, 'month');
  return fmt(abs / year, 'year');
}
