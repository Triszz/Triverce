import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Loader2,
  PackageSearch,
  ShoppingBag,
  Search,
} from 'lucide-react';
import { categoryService, type Category } from '@/services/categoryService';
import { productService } from '@/services/productService';
import { ProductGrid } from '@/features/catalog/components/ProductGrid';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageMeta } from '@/components/common/PageMeta';
import { useAuthStore } from '@/stores/useAuthStore';
import { cn } from '@/lib/cn';

/**
 * HomePage — landing page for unauthenticated and authenticated buyers.
 *
 * Sections:
 *   1. Hero strip (brand + tagline)
 *   2. Category quick-pick row
 *   3. Latest products grid (created_desc)
 */
export function HomePage() {
  const categoriesQuery = useQuery({
    queryKey: ['categories', 'root'],
    queryFn: () => categoryService.list({ limit: 20, isActive: true }),
    staleTime: 5 * 60_000,
  });

  const latestQuery = useQuery({
    queryKey: ['products', 'latest', { limit: 10 }],
    queryFn: () =>
      productService.list({ limit: 10, sortBy: 'created_desc' }),
    staleTime: 60_000,
  });

  return (
    <>
      <PageMeta
        title="Premium multi-vendor marketplace"
        description="Shop curated essentials from independent sellers worldwide. Audio gear, apparel, and accessories — handpicked, fairly priced, delivered to your door."
      />
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      {/* Hero */}
      <Hero />

      {/* Categories */}
      <section aria-labelledby="categories-heading">
        <SectionHeader
          title="Shop by category"
          subtitle="Find what you need, faster."
          linkTo="/shop"
          linkLabel="See all products"
        />
        <div className="mt-6">
          {categoriesQuery.isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : categoriesQuery.isError ? (
            <ErrorMessage
              message="Couldn't load categories. Please refresh."
            />
          ) : (
            <CategoriesRow categories={categoriesQuery.data?.data ?? []} />
          )}
        </div>
      </section>

      {/* Latest products */}
      <section aria-labelledby="latest-heading">
        <SectionHeader
          title="Latest arrivals"
          subtitle="Fresh from our sellers."
          linkTo="/shop?sort=created_desc"
          linkLabel="Browse newest"
        />
        <div className="mt-6">
          <ProductGrid
            products={latestQuery.data?.data ?? []}
            isLoading={latestQuery.isLoading}
            skeletonCount={5}
            emptyState={
              <EmptyState
                tone="brand"
                size="sm"
                icon={<PackageSearch size={20} aria-hidden />}
                title="No products available yet"
                description="We're onboarding new sellers every day. Check back soon, or browse all categories."
                actions={[
                  {
                    label: 'Start shopping',
                    href: '/shop',
                    variant: 'primary',
                    leftIcon: <ArrowRight size={14} aria-hidden />,
                  },
                ]}
              />
            }
          />
        </div>
      </section>
    </div>
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Section header
 * ──────────────────────────────────────────────────────────────────────── */

function Hero() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#002b5b] via-[#001f3f] to-[#001540] px-6 sm:px-10 lg:px-12 py-12 sm:py-16">
      <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-center">
        {/* Left column: text + CTAs */}
        <div className="relative max-w-xl space-y-4">
          <p className="text-xs sm:text-sm font-medium uppercase tracking-[0.18em] text-blue-100">
            Premium multi-vendor marketplace
          </p>
          <h1 className="text-3xl sm:text-5xl font-bold leading-tight tracking-tight text-white">
            Shop curated essentials from independent sellers worldwide.
          </h1>
          <p className="text-sm sm:text-base text-blue-100 leading-relaxed">
            Audio gear, apparel, and accessories — handpicked, fairly priced,
            delivered to your door.
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <Link
              to="/shop"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white text-[#002b5b] font-medium text-sm px-5 py-2.5 hover:bg-brand-50 transition-colors shadow-sm hover:shadow-md"
            >
              Browse all products
              <ArrowRight size={16} aria-hidden />
            </Link>

            {isAuthenticated ? (
              <Link
                to="/orders"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 text-white font-medium text-sm px-5 py-2.5 hover:bg-white/10 transition-colors"
              >
                <ShoppingBag size={16} aria-hidden />
                View my orders
              </Link>
            ) : (
              <Link
                to="/auth/register"
                className="inline-flex items-center rounded-lg border border-white/30 text-white font-medium text-sm px-5 py-2.5 hover:bg-white/10 transition-colors"
              >
                Create an account
              </Link>
            )}
          </div>
        </div>

        {/* Right column: glassmorphism brand graphic */}
        <HeroGraphic />
      </div>

      <div
        aria-hidden
        className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl pointer-events-none"
      />
      <div
        aria-hidden
        className="absolute -bottom-32 -right-10 h-72 w-72 rounded-full bg-info-500/20 blur-3xl pointer-events-none"
      />
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * HeroGraphic — "Floating App Mockup" (Stripe / Vercel inspired).
 *
 * A stylized, miniaturized glass UI window built from pure Tailwind
 * DOM elements — no external images. The mockup is a faithful
 * silhouette of the actual marketplace: a search bar, category
 * pills, and a 2-up product grid. Every shape inside the window is
 * `aria-hidden`; a single `sr-only` span describes the whole frame
 * for screen readers.
 *
 * The entire window floats with the same 6 s `float` keyframe used
 * elsewhere on the page, so the banner keeps its gentle motion
 * without the visual clutter of multiple orbiting orbs.
 * ──────────────────────────────────────────────── */

function HeroGraphic() {
  return (
    <div className="relative hidden lg:flex justify-center items-center min-h-[420px] xl:min-h-[460px]">
      <span className="sr-only">
        A miniature preview of the Triverce marketplace: a search bar,
        category filters, and two product cards in a glass window.
      </span>

      {/* Soft blue halo behind the window */}
      <div
        aria-hidden
        className="absolute -z-0 h-80 w-80 xl:h-96 xl:w-96 rounded-full bg-blue-500/20 blur-3xl"
      />

      {/* Floating glass app window */}
      <div
        aria-hidden
        className={cn(
          'relative z-10',
          'w-full max-w-sm xl:max-w-md',
          'rounded-2xl',
          'border border-white/10',
          'bg-slate-900/60 backdrop-blur-2xl',
          'shadow-2xl shadow-blue-500/30',
          'overflow-hidden',
          'animate-[float_6s_ease-in-out_infinite]',
        )}
      >
        {/* Window header (macOS-style traffic-light controls) */}
        <div
          aria-hidden
          className="flex items-center gap-2 px-4 py-3 bg-white/5 border-b border-white/10"
        >
          <span className="block w-2.5 h-2.5 rounded-full bg-red-400/80" />
          <span className="block w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
          <span className="block w-2.5 h-2.5 rounded-full bg-green-400/80" />
        </div>

        {/* Window body */}
        <div aria-hidden className="p-5 space-y-5">
          {/* Fake search bar */}
          <div
            aria-hidden
            className="flex items-center gap-2 h-10 w-full rounded-lg bg-white/5 border border-white/10 px-3"
          >
            <Search aria-hidden className="w-4 h-4 text-white/40" />
            <span className="block h-2 w-24 bg-white/20 rounded-full" />
          </div>

          {/* Fake category pills */}
          <div aria-hidden className="flex gap-2">
            <span className="block h-6 w-16 bg-blue-500/20 rounded-full" />
            <span className="block h-6 w-20 bg-white/10 rounded-full" />
            <span className="block h-6 w-12 bg-white/10 rounded-full" />
          </div>

          {/* Fake product grid */}
          <div aria-hidden className="grid grid-cols-2 gap-4">
            {/* Product card 1 */}
            <div
              aria-hidden
              className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-3"
            >
              <div
                aria-hidden
                className="h-24 w-full rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/20"
              />
              <div aria-hidden className="space-y-1.5">
                <span className="block h-2 w-3/4 bg-white/20 rounded-full" />
                <span className="block h-2 w-1/2 bg-blue-400/50 rounded-full" />
              </div>
            </div>

            {/* Product card 2 */}
            <div
              aria-hidden
              className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-3"
            >
              <div
                aria-hidden
                className="h-24 w-full rounded-lg bg-gradient-to-br from-indigo-500/20 to-blue-500/20"
              />
              <div aria-hidden className="space-y-1.5">
                <span className="block h-2 w-2/3 bg-white/20 rounded-full" />
                <span className="block h-2 w-2/5 bg-blue-400/50 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Section header */

function SectionHeader({
  title,
  subtitle,
  linkTo,
  linkLabel,
}: {
  title: string;
  subtitle?: string;
  linkTo?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap">
      <div>
        <h2
          id={`${title.toLowerCase().replace(/\s+/g, '-')}-heading`}
          className="text-xl sm:text-2xl font-bold text-slate-900"
        >
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
        )}
      </div>
      {linkTo && linkLabel && (
        <Link
          to={linkTo}
          className="inline-flex items-center gap-1 text-sm font-medium text-[#002b5b] hover:text-[#001f3f] transition-colors"
        >
          {linkLabel}
          <ArrowRight size={14} aria-hidden />
        </Link>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Categories row
 * ──────────────────────────────────────────────────────────────────────── */

const CATEGORY_GRADIENTS = [
  'from-brand-50 to-brand-100',
  'from-success-50 to-success-100',
  'from-warning-50 to-warning-100',
  'from-info-50 to-info-100',
  'from-danger-50 to-danger-100',
  'from-slate-100 to-slate-200',
];

function CategoriesRow({ categories }: { categories: Category[] }) {
  if (categories.length === 0) {
    return (
      <EmptyState
        size="sm"
        tone="neutral"
        icon={<PackageSearch size={20} aria-hidden />}
        title="No categories yet"
        description="Our catalog is being curated. Check back soon!"
        actions={[
          {
            label: 'Start shopping',
            href: '/shop',
            variant: 'primary',
            leftIcon: <ArrowRight size={14} aria-hidden />,
          },
        ]}
      />
    );
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {categories.map((cat, i) => (
        <Link
          key={cat.id}
          to={`/shop?category=${cat.id}`}
          className={cn(
            'group flex flex-col items-start justify-between h-24 rounded-xl p-4',
            'bg-gradient-to-br',
            CATEGORY_GRADIENTS[i % CATEGORY_GRADIENTS.length],
            'transition-all duration-200 hover:shadow-md hover:-translate-y-0.5',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#002b5b] focus-visible:ring-offset-2',
          )}
        >
          <span className="text-base font-semibold text-slate-900 group-hover:text-[#002b5b] transition-colors line-clamp-1">
            {cat.name}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600">
            Shop now
            <ArrowRight
              size={12}
              aria-hidden
              className="transition-transform group-hover:translate-x-0.5"
            />
          </span>
        </Link>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Inline error
 * ──────────────────────────────────────────────────────────────────────── */

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-danger-700 bg-danger-50 border border-danger-500/20 rounded-lg px-4 py-3">
      <Loader2 size={14} className="animate-spin" aria-hidden />
      {message}
    </div>
  );
}