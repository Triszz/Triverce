import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Store } from 'lucide-react';
import type { ProductSummary } from '@/services/productService';
import { pickHeroImage } from '@/services/productService';
import { PriceTag } from '@/components/ui/PriceTag';
import { cn } from '@/lib/cn';

/**
 * Neutral 1:1 placeholder used when a product has no image yet.
 * Inlined SVG so it never triggers a network request and respects the
 * card's `rounded-xl` shape.
 */
function PlaceholderImage({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <div
      role="img"
      aria-label={`${name} (image coming soon)`}
      className="w-full h-full bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 flex items-center justify-center"
    >
      <span className="text-5xl font-semibold text-slate-300 select-none">
        {initial}
      </span>
    </div>
  );
}

export interface ProductCardProps {
  product: ProductSummary;
  /**
   * Optional className to extend layout-specific spacing (e.g. in a grid).
   * Visual styling stays consistent across home, search, and catalog grids.
   */
  className?: string;
}

/**
 * ProductCard — premium marketplace card.
 *
 * Layout choices:
 *   • Square hero image with overflow-hidden + slight zoom on hover.
 *   • Card lifts on hover (`-translate-y-0.5`) for that "premium" feel.
 *   • Shows price-range when minPrice !== maxPrice (variant products).
 *   • Wraps the entire card in a Link so the whole surface is clickable.
 */
export function ProductCard({ product, className }: ProductCardProps) {
  const [imgError, setImgError] = useState(false);
  const hasPriceRange = product.minPrice !== product.maxPrice;
  const heroSrc = pickHeroImage(product);
  const showPlaceholder = !heroSrc || imgError;

  return (
    <Link
      to={`/product/${product.slug}`}
      aria-label={`View ${product.name}`}
      className={cn(
        'group block bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden',
        'transition-all duration-200 ease-out',
        'hover:shadow-md hover:-translate-y-0.5 hover:border-slate-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#002b5b] focus-visible:ring-offset-2',
        className,
      )}
    >
      <div className="relative aspect-square bg-slate-50 overflow-hidden">
        {showPlaceholder ? (
          <PlaceholderImage name={product.name} />
        ) : (
          <img
            src={heroSrc}
            alt={product.name}
            loading="lazy"
            onError={() => setImgError(true)}
            className={cn(
              'h-full w-full object-cover',
              'transition-transform duration-300 ease-out',
              'group-hover:scale-105',
            )}
          />
        )}
        {!product.isActive && (
          <span className="absolute top-2 left-2 bg-slate-900/80 text-white text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md">
            Unavailable
          </span>
        )}
      </div>

      <div className="p-4 space-y-2">
        {product.storeName && (
          <p
            className="text-xs font-medium text-slate-500 truncate flex items-center gap-1"
            title={product.storeName}
          >
            <Store size={11} className="shrink-0 text-slate-400" aria-hidden />
            {/*
              Link to the store profile page.
              stopPropagation prevents the card's outer <Link> from navigating
              to the product page when the user clicks the store name.
            */}
            <Link
              to={`/store/${product.sellerId}`}
              onClick={(e) => e.stopPropagation()}
              className="hover:text-[#002b5b] hover:underline transition-colors"
            >
              {product.storeName}
            </Link>
          </p>
        )}

        <h3
          className={cn(
            'text-sm font-semibold text-slate-900 leading-snug line-clamp-2',
            'transition-colors group-hover:text-[#002b5b]',
          )}
          title={product.name}
        >
          {product.name}
        </h3>

        <div className="flex items-baseline gap-1.5">
          {hasPriceRange ? (
            <>
              <PriceTag value={product.minPrice} size="md" />
              <span className="text-xs text-slate-400">–</span>
              <PriceTag value={product.maxPrice} size="sm" className="text-slate-500" />
            </>
          ) : (
            <PriceTag value={product.minPrice} size="md" />
          )}
        </div>
      </div>
    </Link>
  );
}