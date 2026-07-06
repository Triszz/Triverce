import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import { categoryService, type Category } from '@/services/categoryService';
import { productService } from '@/services/productService';
import { ProductGrid } from '@/features/catalog/components/ProductGrid';
import { Skeleton } from '@/components/ui/Skeleton';
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#002b5b] via-[#001f3f] to-[#001540] text-white px-6 sm:px-10 py-12 sm:py-16">
        <div className="relative max-w-2xl space-y-4">
          <p className="text-xs sm:text-sm font-medium uppercase tracking-[0.18em] text-brand-100">
            Premium multi-vendor marketplace
          </p>
          <h1 className="text-3xl sm:text-5xl font-bold leading-tight tracking-tight">
            Shop curated essentials from independent sellers worldwide.
          </h1>
          <p className="text-sm sm:text-base text-brand-100/90 leading-relaxed">
            Audio gear, apparel, and accessories — handpicked, fairly priced,
            delivered to your door.
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <Link
              to="/shop"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white text-[#002b5b] font-medium text-sm px-5 py-2.5 hover:bg-brand-50 transition-colors"
            >
              Browse all products
              <ArrowRight size={16} aria-hidden />
            </Link>
            <Link
              to="/auth/register"
              className="inline-flex items-center rounded-lg border border-white/30 text-white font-medium text-sm px-5 py-2.5 hover:bg-white/10 transition-colors"
            >
              Create an account
            </Link>
          </div>
        </div>

        {/* Decorative blobs */}
        <div
          aria-hidden
          className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-32 -right-10 h-72 w-72 rounded-full bg-info-500/20 blur-3xl"
        />
      </section>

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
              <p className="text-sm text-slate-500">
                No products available yet.
              </p>
            }
          />
        </div>
      </section>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Section header
 * ──────────────────────────────────────────────────────────────────────── */

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
      <p className="text-sm text-slate-500">No categories yet.</p>
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