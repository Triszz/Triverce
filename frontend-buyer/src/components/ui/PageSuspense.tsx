import { Skeleton, SkeletonText } from './Skeleton';

/* ──────────────────────────────────────────────────────────────────────────
 * PageSuspense — fallback shown while a lazily-loaded page is in flight.
 *
 * Picked over a generic spinner because the page-level skeleton mirrors
 * the actual page layouts we've already built (e.g. heading + content
 * rows), which makes the first paint feel like a near-instant content
 * load rather than a loading state.
 *
 * Each named variant maps to a different layout profile. If you add a
 * new "big" page, add a corresponding skeleton here.
 * ───────────────────────────────────────── */

export interface PageSuspenseProps {
  /**
   * Which page-shaped skeleton to render. The default is a generic
   * heading + content skeleton that works for most routes.
   */
  variant?: 'default' | 'list' | 'detail' | 'account' | 'auth';
  className?: string;
}

export function PageSuspense({ variant = 'default', className }: PageSuspenseProps) {
  switch (variant) {
    case 'list':
      return (
        <div className={'max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 ' + (className ?? '')}>
          <Skeleton className="h-7 w-48 mb-2" />
          <Skeleton className="h-3 w-32 mb-6" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        </div>
      );

    case 'detail':
      return (
        <div className={'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 ' + (className ?? '')}>
          <Skeleton className="h-4 w-24 mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-64 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-64 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
            </div>
          </div>
        </div>
      );

    case 'account':
      return (
        <div className={'max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 ' + (className ?? '')}>
          <Skeleton className="h-7 w-40 mb-2" />
          <Skeleton className="h-3 w-64 mb-6" />
          <Skeleton className="h-16 w-full rounded-xl mb-6" />
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        </div>
      );

    case 'auth':
      return (
        <div className={'space-y-6 ' + (className ?? '')}>
          <div>
            <Skeleton className="h-7 w-56 mb-2" />
            <Skeleton className="h-3 w-72" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-11 w-full rounded-lg" />
            <Skeleton className="h-11 w-full rounded-lg" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
        </div>
      );

    default:
      return (
        <div className={'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 ' + (className ?? '')}>
          <Skeleton className="h-7 w-56 mb-3" />
          <SkeletonText lines={2} className="mb-8" />
          <Skeleton className="h-40 w-full rounded-xl mb-6" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      );
  }
}
