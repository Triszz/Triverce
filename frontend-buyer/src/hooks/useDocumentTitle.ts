import { useEffect } from 'react';

/* ──────────────────────────────────────────────────────────────────────────
 * useDocumentTitle — set `document.title` for the lifetime of the page.
 *
 * Restores the previous title on unmount so the next page can set its own
 * without stacking suffixes. The optional `suffix` argument appends
 * " · Triverce" automatically so every page is consistently branded in
 * the browser tab — pass `null` to suppress the suffix for a custom
 * one-off (e.g. checkout / payment-return pages that don't need the
 * marketplace brand).
 * ──────────────────────────────────────────────────────────────────────── */

const DEFAULT_SUFFIX = ' · Triverce';
const DEFAULT_TITLE = 'Triverce';

export function useDocumentTitle(
  title: string,
  options: { suffix?: string | null } = {},
): void {
  const { suffix = DEFAULT_SUFFIX } = options;

  useEffect(() => {
    const previous = document.title;
    const next = suffix === null
      ? title
      : title
        ? `${title}${suffix}`
        : DEFAULT_TITLE;
    document.title = next;
    return () => {
      document.title = previous;
    };
  }, [title, suffix]);
}
