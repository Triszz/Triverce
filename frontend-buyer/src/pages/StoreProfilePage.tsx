import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, MapPin, Package, Phone, Mail, Search, X } from "lucide-react";
import { PageMeta } from "@/components/common/PageMeta";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useStoreProfile } from "@/hooks/useStoreProfile";
import { productService } from "@/services/productService";
import { ProductGrid } from "@/features/catalog/components/ProductGrid";
import { cn } from "@/lib/cn";

/**
 * StoreProfilePage — public storefront profile at `/store/:sellerId`.
 *
 * Fetches the seller's public profile (storeName, logo, joined date,
 * product count) and a paginated list of their active products.
 */
export function StoreProfilePage() {
  const { sellerId } = useParams<{ sellerId: string }>();

  const storeQuery = useStoreProfile(sellerId ?? "");
  const productQuery = useQuery({
    queryKey: ["products", "by-seller", sellerId],
    queryFn: () => productService.list({ sellerId, limit: 20, isActive: true }),
    enabled: !!sellerId,
    staleTime: 30_000,
  });

  const store = storeQuery.data;
  const products = productQuery.data?.data ?? [];

  /* ── Contextual search + category filtering ─────────────────────────── */

  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get("q") ?? "";
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const clearSearch = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("q");
    setSearchParams(next, { replace: true });
  };

  // Distinct categories present in this store's products. Multiple products
  // with `categoryId === null` collapse into a single "Uncategorized" tab.
  // Ordering: real categories alphabetically, "Uncategorized" always last.
  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) {
      if (p.categoryId && p.category) {
        map.set(p.categoryId, p.category.name);
      } else {
        map.set("uncategorized", "Uncategorized");
      }
    }
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => {
      if (a.id === "uncategorized") return 1;
      if (b.id === "uncategorized") return -1;
      return a.name.localeCompare(b.name);
    });
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (activeCategory !== "all") {
        const id = p.categoryId ?? "uncategorized";
        if (id !== activeCategory) return false;
      }
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, activeCategory, searchQuery]);

  const displayName = store?.storeName || "This Store";

  /* ── Head ──────────────────────────────────────────────────────────────── */

  if (storeQuery.isLoading) return <StoreSkeleton />;

  if (storeQuery.isError || !store) {
    return (
      <>
        <PageMeta title="Store not found" />
        <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
          <h1 className="text-2xl font-bold text-slate-900">Store not found</h1>
          <p className="text-slate-500">
            This store may have been removed or the link is incorrect.
          </p>
          <Button variant="primary" onClick={() => window.history.back()}>
            Go back
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageMeta
        title={displayName}
        description={
          store.description
            ? `${displayName} — ${store.description}`
            : `Browse all products from ${displayName}.`
        }
      />

      {/* ── Hero / Cover Banner ──────────────────────────────────────── */}
      <div className="relative bg-[#031140] overflow-hidden">
        {/* Decorative gradient orbs */}
        <div
          aria-hidden
          className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-[#1a4a8a]/30 blur-3xl pointer-events-none"
        />
        <div
          aria-hidden
          className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-[#002b5b]/40 blur-2xl pointer-events-none"
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-8">
          {/* Breadcrumbs — inside the navy banner */}
          <Breadcrumbs
            crumbs={[{ label: "Home", path: "/" }, { label: displayName }]}
            theme="light"
          />

          {/* Side-by-side layout: Brand identity (left) + Stats card (right) */}
          <div className="mt-8 flex flex-col md:flex-row md:justify-between md:items-start gap-8">
            {/* ── Left: Brand Identity ───────────────────────────────── */}
            <div className="flex-1 min-w-0 max-w-xl lg:max-w-2xl">
              <div className="flex items-start gap-5">
                <StoreAvatar name={displayName} logoUrl={store.logoUrl} />

                <div className="min-w-0">
                  <h1 className="text-2xl sm:text-3xl font-bold text-white truncate">
                    {displayName}
                  </h1>

                  {store.description && (
                    <p className="mt-2 text-sm text-slate-300 leading-relaxed line-clamp-4 break-words">
                      {store.description}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ── Right: Store Information Card ────────────────────────── */}
            <div className="shrink-0 w-full md:w-[550px] lg:w-[650px] xl:w-[750px]">
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5 md:p-6 shadow-lg">
                <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5 text-sm">
                  {/* Products */}
                  <div className="flex items-start gap-3">
                    <Package
                      size={16}
                      className="mt-0.5 shrink-0 text-slate-400"
                      aria-hidden
                    />
                    <div>
                      <dt className="text-slate-400">Products</dt>
                      <dd className="mt-0.5 font-semibold text-white">
                        {store.productCount === 1
                          ? "1 item"
                          : `${store.productCount.toLocaleString()} items`}
                      </dd>
                    </div>
                  </div>

                  {/* Joined */}
                  {store.joinedAt && (
                    <div className="flex items-start gap-3">
                      <CalendarDays
                        size={16}
                        className="mt-0.5 shrink-0 text-slate-400"
                        aria-hidden
                      />
                      <div>
                        <dt className="text-slate-400">Joined</dt>
                        <dd className="mt-0.5 font-semibold text-white">
                          {new Intl.DateTimeFormat("en-US", {
                            month: "short",
                            year: "numeric",
                          }).format(new Date(store.joinedAt))}
                        </dd>
                      </div>
                    </div>
                  )}

                  {/* Address */}
                  {store.address && (
                    <div className="flex items-start gap-3">
                      <MapPin
                        size={16}
                        className="mt-0.5 shrink-0 text-slate-400"
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <dt className="text-slate-400">Address</dt>
                        <dd className="mt-0.5 font-semibold text-white break-words">
                          {store.address}
                        </dd>
                      </div>
                    </div>
                  )}

                  {/* Phone */}
                  {store.phone && (
                    <div className="flex items-start gap-3">
                      <Phone
                        size={16}
                        className="mt-0.5 shrink-0 text-slate-400"
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <dt className="text-slate-400">Phone</dt>
                        <dd className="mt-0.5 font-semibold text-white break-all">
                          {store.phone}
                        </dd>
                      </div>
                    </div>
                  )}

                  {/* Email */}
                  {store.supportEmail && (
                    <div className="flex items-start gap-3">
                      <Mail
                        size={16}
                        className="mt-0.5 shrink-0 text-slate-400"
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <dt className="text-slate-400">Email</dt>
                        <dd className="mt-0.5 font-semibold text-white break-all">
                          {store.supportEmail}
                        </dd>
                      </div>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Category Tabs + Product Grid ────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex gap-6 border-b border-slate-200 mb-8 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            className={cn(
              "shrink-0 pb-4 text-sm cursor-pointer transition-colors",
              activeCategory === "all"
                ? "text-blue-600 border-b-2 border-blue-600 font-medium"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            All Products
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "shrink-0 pb-4 text-sm cursor-pointer transition-colors",
                activeCategory === cat.id
                  ? "text-blue-600 border-b-2 border-blue-600 font-medium"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Active-filter summary */}
        {(searchQuery || activeCategory !== "all") && !productQuery.isLoading && (
          <div className="flex items-center justify-between gap-3 mb-6 text-sm">
            <div className="flex items-center gap-2 text-slate-600 min-w-0">
              <Search size={15} className="shrink-0 text-slate-400" aria-hidden />
              <span className="truncate">
                {searchQuery && (
                  <>
                    Showing results for{" "}
                    <span className="font-semibold text-slate-900">
                      "{searchQuery}"
                    </span>
                    {activeCategory !== "all" && " in "}
                  </>
                )}
                {activeCategory !== "all" && (
                  <span className="font-semibold text-slate-900">
                    {categories.find((c) => c.id === activeCategory)?.name}
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <span className="text-xs text-slate-500">
                {filteredProducts.length}{" "}
                {filteredProducts.length === 1 ? "result" : "results"}
              </span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="text-sm text-slate-500 hover:text-red-600 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <X size={16} aria-hidden />
                  Clear search
                </button>
              )}
            </div>
          </div>
        )}

        {/* Results */}
        {productQuery.isLoading ? (
          <ProductGrid products={[]} isLoading skeletonCount={8} />
        ) : productQuery.isError ? (
          <div className="text-sm text-danger-700 py-8 text-center">
            Failed to load products. Please refresh.
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            tone="neutral"
            icon={<Package size={24} aria-hidden />}
            title="No products yet"
            description={`${displayName} hasn't added any products yet. Check back soon!`}
          />
        ) : filteredProducts.length === 0 ? (
          <EmptyState
            tone="neutral"
            icon={<Search size={24} aria-hidden />}
            title="No products found"
            description={
              searchQuery
                ? `No products match "${searchQuery}"${
                    activeCategory !== "all"
                      ? ` in ${
                          categories.find((c) => c.id === activeCategory)?.name
                        }`
                      : ""
                  }. Try a different search or category.`
                : `No products in ${
                    categories.find((c) => c.id === activeCategory)?.name
                  } yet.`
            }
            actions={
              searchQuery
                ? [
                    {
                      label: "Clear search",
                      leftIcon: <X size={15} aria-hidden />,
                      variant: "secondary" as const,
                      onClick: clearSearch,
                    },
                  ]
                : []
            }
          />
        ) : (
          <ProductGrid products={filteredProducts} />
        )}
      </div>
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

interface StoreAvatarProps {
  name: string;
  logoUrl: string | null;
}

/**
 * Store logo — tries the real URL first; falls back to a branded initial
 * avatar if the URL is falsy or the image fails to load (broken link, CORS,
 * deleted file, etc.).
 */
function StoreAvatar({ name, logoUrl }: StoreAvatarProps) {
  const [imgError, setImgError] = useState(false);

  const showFallback = !logoUrl || imgError;
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  if (showFallback) {
    return (
      <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#1a4a8a] to-[#002b5b] flex items-center justify-center border-4 border-white/20 shadow-xl">
        <span className="text-3xl font-bold text-white select-none">
          {initial}
        </span>
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={`${name} logo`}
      onError={() => setImgError(true)}
      className="w-24 h-24 rounded-2xl object-cover border-4 border-white/20 shadow-xl"
    />
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function StoreSkeleton() {
  return (
    <>
      <PageMeta title="Loading store…" />
      <div className="bg-[#031140]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-8">
          <Skeleton className="h-4 w-32 mb-8" />
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-8">
            {/* Left: logo + name + description */}
            <div className="flex-1 min-w-0 max-w-xl lg:max-w-2xl">
              <div className="flex items-start gap-5">
                <Skeleton className="w-24 h-24 rounded-2xl shrink-0" />
                <div className="space-y-3">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-4 w-64" />
                  <Skeleton className="h-4 w-56" />
                </div>
              </div>
            </div>
            {/* Right: stats card */}
            <div className="shrink-0 w-full md:w-[550px] lg:w-[650px] xl:w-[750px]">
              <div className="bg-white/5 border border-white/10 rounded-xl p-5 md:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-start gap-3">
                      <Skeleton className="w-4 h-4 rounded mt-0.5" />
                      <div className="space-y-1">
                        <Skeleton className="h-3 w-12" />
                        <Skeleton className="h-4 w-28" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Skeleton className="h-6 w-56 mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl overflow-hidden bg-white border border-slate-100"
            >
              <Skeleton className="aspect-square w-full rounded-none" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-5 w-20 mt-1" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
