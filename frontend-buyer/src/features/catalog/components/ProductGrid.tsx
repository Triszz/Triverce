import type { ProductSummary } from '@/services/productService';
import { ProductCard } from './ProductCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';

/**
 * Skeleton placeholder that mimics ProductCard dimensions.
 * 1:1 image area + 2-line text block so the grid never jumps when data lands.
 */
export function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden',
        className,
      )}
      aria-hidden
    >
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="p-4 space-y-2">
        <Skeleton variant="text" className="h-3.5 w-5/6" />
        <Skeleton variant="text" className="h-3.5 w-2/3" />
        <Skeleton variant="text" className="h-4 w-1/3" />
      </div>
    </div>
  );
}

export interface ProductGridProps {
  products: ProductSummary[];
  /**
   * Number of skeletons to render when `isLoading` is true.
   * Should match the page size (or the count you expect to render).
   */
  skeletonCount?: number;
  isLoading?: boolean;
  /**
   * Shown only when both isLoading=false and products.length===0.
   */
  emptyState?: React.ReactNode;
  className?: string;
}

/**
 * ProductGrid — responsive grid (2 cols mobile → 5 cols desktop).
 *
 * Stays a pure presentational component: callers control data fetching and
 * pass the resolved array (or the loading flag).
 */
export function ProductGrid({
  products,
  isLoading = false,
  skeletonCount = 8,
  emptyState,
  className,
}: ProductGridProps) {
  if (isLoading) {
    return (
      <div
        className={cn(
          'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5',
          className,
        )}
        role="status"
        aria-label="Loading products"
      >
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="py-16 text-center">
        {emptyState ?? (
          <div className="space-y-2">
            <p className="text-base font-semibold text-slate-900">
              No products found
            </p>
            <p className="text-sm text-slate-500">
              Try adjusting your filters or check back soon.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5',
        className,
      )}
    >
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}