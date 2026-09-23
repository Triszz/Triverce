import { useState } from "react";
import { Link } from "react-router-dom";
import { Store } from "lucide-react";
import type { ProductSummary } from "@/services/productService";
import { pickHeroImage } from "@/services/productService";
import { cn } from "@/lib/cn";
import { formatSold } from "@/lib/format";

/**
 * Neutral 1:1 placeholder used when a product has no image yet.
 * Inlined SVG so it never triggers a network request and respects the
 * card's `rounded-xl` shape.
 */
function PlaceholderImage({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
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

/**
 * Localised VND formatter with the Vietnamese "đ" suffix (e.g. "100.000 đ")
 * instead of the Intl-currency default "₫" or "VND". Used inside the price
 * range to keep both ends of the dash readable on one line.
 *
 * `maximumFractionDigits: 0` because VND never has sub-units in practice —
 * the smallest denomination is 1.000 ₫ and amounts below are not real.
 */
const vndFormatter = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 0,
});

function formatVnd(value: number): string {
  return `${vndFormatter.format(value)} đ`;
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
 *   • Shows a "minPrice – maxPrice" range when variants have diverging prices.
 *     Both ends render at the same `text-base font-semibold` so the dash
 *     sits on a single visual baseline — using a smaller `text-sm` for the
 *     max end (as we used to) makes the range look unbalanced on cards
 *     where the second number is wider than the first.
 *   • Stretched-link pattern: the product-name `<Link>` carries an
 *     `after:absolute after:inset-0` pseudo-element so any pixel of the
 *     card navigates to the product detail, while the in-card store-name
 *     link keeps its own `/store/:id` destination via `relative z-20`.
 *   • Footer row (price left / sold-count right) always anchored to the
 *     card bottom via `mt-auto` inside a `flex flex-col h-full` wrapper,
 *     keeping the product grid perfectly aligned regardless of name length.
 */
export function ProductCard({ product, className }: ProductCardProps) {
  const [imgError, setImgError] = useState(false);
  const hasPriceRange =
    product.minPrice != null &&
    product.maxPrice != null &&
    product.minPrice < product.maxPrice;
  const heroSrc = pickHeroImage(product);
  const showPlaceholder = !heroSrc || imgError;
  const soldLabel = formatSold(product.soldCount);

  return (
    <div
      className={cn(
        // `relative` anchors the stretched-link `::after` pseudo-element so
        // the entire card surface becomes a click target. We intentionally
        // use a stretched link (rather than wrapping the whole `<div>` in
        // a single `<Link>`) so the in-card "store name" link keeps its
        // own destination without nested-link errors.
        "group relative flex flex-col h-full bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden cursor-pointer",
        "transition-all duration-200 ease-out",
        "hover:shadow-lg hover:-translate-y-0.5 hover:border-slate-200",
        "focus-within:ring-2 focus-within:ring-[#002b5b] focus-within:ring-offset-2",
        className,
      )}
    >
      <Link
        to={`/product/${product.slug}`}
        aria-label={`View ${product.name}`}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[#002b5b] focus-visible:ring-offset-2"
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
                "h-full w-full object-cover",
                "transition-transform duration-300 ease-out",
                "group-hover:scale-105",
              )}
            />
          )}
          {!product.isActive && (
            <span className="absolute top-2 left-2 bg-slate-900/80 text-white text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md">
              Unavailable
            </span>
          )}
        </div>
      </Link>

      {/* ── Content: store, name, footer row ─────────────────────────── */}
      <div className="flex flex-col flex-1 p-4">
        {product.storeName && (
          <p
            className="text-sm font-medium text-slate-500 truncate flex items-center gap-1"
            title={product.storeName}
          >
            <Store size={12} className="shrink-0 text-slate-400" aria-hidden />
            {/*
              `relative z-20` lifts this inner link above the stretched-link
              pseudo-element below. Without it, the stretched layer would
              swallow clicks meant for the store, sending users to the
              product page when they meant to visit the seller storefront.
            */}
            <Link
              to={`/store/${product.sellerId}`}
              className="relative z-20 hover:text-[#002b5b] hover:underline transition-colors"
            >
              {product.storeName}
            </Link>
          </p>
        )}

        {/*
          Product name — `line-clamp-2` enforces the Shopee-style 2-line cap.
          `min-h-[2.75rem]` reserves space for 2 lines so that a 1-line name
          doesn't shrink the card, keeping the grid visually consistent.
          Using `h-[2.75rem]` with `line-clamp-2` is equivalent to
          `line-clamp` with a fixed box that clips overflow — simpler for
          browsers that don't yet support `line-clamp` natively.

          `after:absolute after:inset-0 after:content-['']` is the
          stretched-link trick: the invisible `::after` covers the entire
          card (because the card has `relative`), turning any whitespace
          / padding / empty space below the title into a click target.
          Combined with `cursor-pointer` on the outer `<div>`, the whole
          card now behaves as one big link without nesting `<a>` inside
          another `<a>` (which would be invalid HTML).
        */}
        <h3 className="text-base font-semibold text-slate-900 leading-snug line-clamp-2 min-h-[2.75rem] mt-auto mb-2">
          <Link
            to={`/product/${product.slug}`}
            aria-label={`View ${product.name}`}
            title={product.name}
            className="after:absolute after:inset-0 after:content-[''] transition-colors group-hover:text-[#002b5b] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#002b5b] focus-visible:ring-offset-2"
          >
            {product.name}
          </Link>
        </h3>

        {/*
          Footer row — always pushed to card bottom via `mt-auto`.
          `flex justify-between items-center` keeps price on the left and
          sold-count on the right. `whitespace-nowrap` + `overflow-hidden`
          + `min-w-0` on the price box guarantees the row stays on a
          single line — even if the price is long enough to push the
          sold-count aside, the overflow is silently clipped rather than
          wrapping into a second line and re-shifting the card height.

          `relative z-20` here so future CTAs (Add to Cart, Quick View,
          …) can sit above the stretched-link overlay without being
          captured by it — just give them `relative z-30` and they win
          the click target race.
        */}
        <div className="relative z-20 mt-auto flex justify-between items-center gap-2 whitespace-nowrap overflow-hidden">
          {/*
            Price — single source of truth on every card: `minPrice`.
            When the product has a variant price range (min < max) we
            prefix a small "Từ" label so the storefront signals "this
            starts here, other variants cost more" without rendering both
            bounds and breaking the footer into multiple lines. Matches
            the Shopee / Lazada pattern.
          */}
          <div className="min-w-0 overflow-hidden flex items-baseline">
            {hasPriceRange ? (
              <>
                {/*
                  "Từ" — bumped from slate-500/normal to slate-700/medium so
                  it doesn't disappear next to the much louder blue-800
                  price. Still subordinate to the actual number, but
                  legible at thumbnail size.
                */}
                <span
                  className="text-sm font-medium text-slate-700 mr-1 shrink-0"
                  aria-hidden
                >
                  Từ
                </span>
                {/*
                  `title` mirrors the rendered (un-truncated) price, so a
                  user hovering over the visible ellipsis still sees the
                  full number in the browser's native tooltip — they
                  never lose the precise figure, only the layout loses it.
                */}
                <span
                  className="text-lg font-semibold text-blue-800 tabular-nums tracking-tight leading-tight truncate"
                  title={formatVnd(product.minPrice)}
                >
                  {formatVnd(product.minPrice)}
                </span>
              </>
            ) : (
              <span
                className="text-lg font-semibold text-blue-800 tabular-nums tracking-tight leading-tight truncate"
                title={formatVnd(product.minPrice ?? product.basePrice)}
              >
                {formatVnd(product.minPrice ?? product.basePrice)}
              </span>
            )}
          </div>

          {/*
            Sold count — `shrink-0` keeps the badge at its intrinsic
            width so the `truncate` ellipsis on the price catches first
            when space is tight. Combined with the parent's
            `whitespace-nowrap overflow-hidden`, the row never wraps.
          */}
          {soldLabel && (
            <span className="text-xs text-slate-500 font-medium whitespace-nowrap shrink-0">
              {soldLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
