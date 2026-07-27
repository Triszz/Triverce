import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ProductCard } from '@/features/catalog/components/ProductCard';
import { cn } from '@/lib/cn';
import type { ProductSummary } from '@/services/productService';

interface ProductCarouselProps {
  products: ProductSummary[];
  /** Shown when the product list is empty. */
  empty?: React.ReactNode;
  className?: string;
}

const CARD_WIDTH = 'flex-none w-[200px] sm:w-[220px] lg:w-[240px]';

/**
 * ProductCarousel — horizontally scrolling product list with snap-scroll
 * and prev/next arrow navigation.
 *
 * Uses CSS snap for native feel; arrows use scrollBy() for precise
 * control over how many cards are scrolled per click.
 */
export function ProductCarousel({
  products,
  empty,
  className,
}: ProductCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollBy = (direction: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    // Scroll by 110% of the visible viewport width, capped by content.
    const amount = el.clientWidth * 1.1 * direction;
    el.scrollBy({ left: amount, behavior: 'smooth' });
  };

  if (!products.length) {
    return empty ? <>{empty}</> : null;
  }

  return (
    <div className={cn('relative group/carousel', className)}>
      {/* Left arrow */}
      <button
        type="button"
        onClick={() => scrollBy(-1)}
        aria-label="Previous"
        className={cn(
          'absolute left-0 top-1/2 -translate-y-1/2 z-10',
          'w-9 h-9 rounded-full bg-white border border-slate-200 shadow-sm',
          'flex items-center justify-center text-slate-600',
          'hover:bg-[#002b5b] hover:text-white hover:border-[#002b5b]',
          'transition-all duration-150',
          'opacity-0 group-hover/carousel:opacity-100',
          // Always show on touch devices (no hover), show on sm+
          'sm:opacity-0 sm:group-hover/carousel:opacity-100',
          '-ml-4 sm:-ml-5',
        )}
      >
        <ChevronLeft size={16} aria-hidden />
      </button>

      {/* Scroll container */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar pb-1 items-stretch"
      >
        {products.map((product) => (
          <div key={product.id} className={cn('flex-shrink-0 snap-start', CARD_WIDTH)}>
            <ProductCard product={product} />
          </div>
        ))}
      </div>

      {/* Right arrow */}
      <button
        type="button"
        onClick={() => scrollBy(1)}
        aria-label="Next"
        className={cn(
          'absolute right-0 top-1/2 -translate-y-1/2 z-10',
          'w-9 h-9 rounded-full bg-white border border-slate-200 shadow-sm',
          'flex items-center justify-center text-slate-600',
          'hover:bg-[#002b5b] hover:text-white hover:border-[#002b5b]',
          'transition-all duration-150',
          'opacity-0 group-hover/carousel:opacity-100',
          'sm:opacity-0 sm:group-hover/carousel:opacity-100',
          '-mr-4 sm:-mr-5',
        )}
      >
        <ChevronRight size={16} aria-hidden />
      </button>
    </div>
  );
}
