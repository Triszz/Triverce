import { useEffect } from 'react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

/* ──────────────────────────────────────────────────────────────────────────
 * PageMeta — single-import SEO meta for a route.
 *
 *   <PageMeta
 *     title="My Orders"
 *     description="Track, view, and manage your Triverce purchases."
 *   />
 *
 * Sets:
 *   • document.title  (via useDocumentTitle)
 *   • <meta name="description">  (created or updated in-place)
 *
 * Both updates are reverted on unmount so the next route can take over
 * cleanly. We don't reach for react-helmet-async because the project
 * doesn't have a server-rendering or dynamic-routing story yet — direct
 * DOM mutation is the smallest dependency-free option that still gives
 * us unique titles and descriptions per page.
 * ───────────────────────────────────────── */

export interface PageMetaProps {
  /** Page title (the suffix " · Triverce" is added automatically). */
  title: string;
  /** 1–2 sentence description for search engines and link previews. */
  description?: string;
  /** Set to true to omit the " · Triverce" suffix (rare). */
  noSuffix?: boolean;
}

function ensureMeta(name: string): HTMLMetaElement {
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[name="${name}"]`,
  );
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  return el;
}

export function PageMeta({ title, description, noSuffix = false }: PageMetaProps) {
  useDocumentTitle(title, { suffix: noSuffix ? null : undefined });

  useEffect(() => {
    if (!description) return;
    const el = ensureMeta('description');
    const previous = el.getAttribute('content');
    el.setAttribute('content', description);
    return () => {
      // Restore the previous description (often the site default) when
      // navigating away so we don't leak this page's copy into the next.
      if (previous === null) {
        el.remove();
      } else {
        el.setAttribute('content', previous);
      }
    };
  }, [description]);

  return null;
}
