import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PriceTag } from '@/components/ui/PriceTag';
import { pickHeroImage, type ProductSummary } from '@/services/productService';
import { cn } from '@/lib/cn';

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
          <ProductCard key={product.id} product={product} />
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

/* ──────────────────────────────────────────────────────────────────────────
 * Individual product card — rendered inside the carousel.
 * Keeps the same visual language as the ProductGrid card used elsewhere.
 * ──────────────────────────────────────────────────────────────────────── */

function ProductCard({ product }: { product: ProductSummary }) {
  const href = `/product/${product.slug ?? product.id}`;

  return (
    <Link
      to={href}
      className={cn(
        'group flex-shrink-0 snap-start',
        CARD_WIDTH,
        'rounded-xl overflow-hidden bg-white border border-slate-100',
        'shadow-sm hover:shadow-md hover:-translate-y-0.5',
        'transition-all duration-200 ease-out',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#002b5b] focus-visible:ring-offset-2',
      )}
    >
      {/* Image */}
      <div className="aspect-square overflow-hidden bg-slate-50">
        {(() => {
          const heroSrc = pickHeroImage(product);
          return heroSrc ? (
            <img
              src={heroSrc}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-slate-300 text-2xl font-semibold">
              {product.name.charAt(0).toUpperCase()}
            </div>
          );
        })()}
      </div>

      {/* Info */}
      <div className="p-3 space-y-1.5">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide truncate">
          {product.categoryId ? 'Product' : 'Featured'}
        </p>
        <h3 className="text-sm font-medium text-slate-900 leading-snug line-clamp-2 group-hover:text-[#002b5b] transition-colors">
          {product.name}
        </h3>
        <PriceTag value={product.minPrice ?? product.basePrice} size="sm" />
      </div>
    </Link>
  );
}
