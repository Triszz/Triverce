import type { ReactNode } from 'react';
import { PageMeta } from '@/components/common/PageMeta';

export interface ContentLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
  /** Optional hero image URL shown at the top of the page. */
  heroImage?: string;
  /** Optional subtitle beneath the title. */
  subtitle?: string;
}

/**
 * ContentLayout — shared shell for all marketing / policy / support pages.
 *
 * Provides a consistent max-width container, standard padding, clean
 * typography hierarchy, and an optional hero image banner.
 */
export function ContentLayout({
  title,
  description,
  children,
  heroImage,
  subtitle,
}: ContentLayoutProps) {
  return (
    <>
      <PageMeta title={title} description={description} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        {/* Page header */}
        <header className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-base sm:text-lg text-slate-500 leading-relaxed max-w-2xl">
              {subtitle}
            </p>
          )}
        </header>

        {/* Hero image (full-width, rounded-xl) */}
        {heroImage && (
          <div className="overflow-hidden rounded-2xl aspect-[21/7]">
            <img
              src={heroImage}
              alt=""
              className="w-full h-full object-cover"
              loading="eager"
            />
          </div>
        )}

        {/* Main content */}
        <div className="prose prose-slate prose-headings:font-semibold prose-headings:text-slate-900 prose-p:text-slate-600 prose-li:text-slate-600 max-w-none">
          {children}
        </div>
      </div>
    </>
  );
}
