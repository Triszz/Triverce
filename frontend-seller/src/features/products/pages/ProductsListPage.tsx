import { Link, useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { Edit, ImageOff, Package, Plus, Trash2 } from 'lucide-react';
import {
  useCategories,
  useDeleteProduct,
  useSellerProducts,
} from '../hooks/useProducts';
import { cn } from '@/lib/cn';
import { formatVnd } from '@/lib/format';
import type { Category, Product } from '../services/productService';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

/**
 * ProductsListPage — seller's catalog surface.
 *
 * Renders a Tailwind data table sourced from `useSellerProducts`.
 * Categories are joined client-side via `useCategories` so the column
 * shows a friendly name without a per-row lookup.
 */
export function ProductsListPage() {
  const navigate = useNavigate();
  const { data: products, isLoading, isError, error } = useSellerProducts();
  const { data: categories } = useCategories();
  const deleteMutation = useDeleteProduct();

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    (categories ?? []).forEach((c: Category) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  // Confirm-dialog state. We hold the targeted product so the dialog
  // can name it; `null` means "closed".
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteMutation.mutateAsync(pendingDelete.id);
    } catch {
      // toast already surfaced from the mutation's onError
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Products</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your catalog, inventory, and pricing.
          </p>
        </div>
        <Link
          to="/products/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#002b5b] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#001f3f] transition-colors shadow-sm cursor-pointer"
        >
          <Plus size={16} aria-hidden />
          Create Product
        </Link>
      </div>

      {/* ── Data table ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="px-6 py-16 text-center text-sm text-slate-500">
            Loading your products…
          </div>
        ) : isError ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-semibold text-red-600">
              Failed to load products
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {(error as Error)?.message ?? 'Unknown error'}
            </p>
            <button
              type="button"
              onClick={() => navigate(0)}
              className="mt-4 inline-flex items-center rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : !products || products.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-6 py-3 w-20">Image</th>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Category</th>
                  <th className="px-6 py-3 text-right">Base Price</th>
                  <th className="px-6 py-3 text-right w-32">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((product) => {
                  const imageUrl = pickImage(product);
                  const categoryName = product.categoryId
                    ? categoryNameById.get(product.categoryId)
                    : null;

                  return (
                    <tr
                      key={product.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-6 py-3">
                        <ProductThumbnail imageUrl={imageUrl} name={product.name} />
                      </td>
                      <td className="px-6 py-3">
                        <div className="font-medium text-slate-900">
                          {product.name}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {product.slug}
                        </div>
                      </td>
                      <td className="px-6 py-3 text-slate-600">
                        {categoryName ?? (
                          <span className="text-slate-400">Uncategorized</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right font-medium text-slate-900 tabular-nums">
                        {formatVnd(product.basePrice)}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            to={`/products/${product.id}/edit`}
                            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                            aria-label={`Edit ${product.name}`}
                          >
                            <Edit size={16} aria-hidden />
                          </Link>
                          <button
                            type="button"
                            onClick={() => setPendingDelete(product)}
                            disabled={deleteMutation.isPending}
                            className={cn(
                              'p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer',
                              'disabled:opacity-50 disabled:cursor-not-allowed',
                            )}
                            aria-label={`Delete ${product.name}`}
                          >
                            <Trash2 size={16} aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        isDestructive
        title="Delete product?"
        description={
          pendingDelete
            ? `“${pendingDelete.name}” will be soft-deleted along with its variants. You can re-list it later by contacting support.`
            : ''
        }
        confirmText="Delete product"
        cancelText="Keep product"
        isConfirming={deleteMutation.isPending}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Small presentational helpers — colocated here so the page is the only
 * surface that needs to know about table chrome.
 * ────────────────────────────────────────────────────────────────────────── */

function EmptyState() {
  return (
    <div className="px-6 py-16 text-center">
      <span className="inline-flex w-14 h-14 rounded-full bg-slate-100 items-center justify-center mb-4">
        <Package size={22} className="text-slate-500" aria-hidden />
      </span>
      <h2 className="text-lg font-semibold text-slate-900">No products yet</h2>
      <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
        Start building your catalog by adding your first product. You can
        upload images, set pricing, and assign categories.
      </p>
      <Link
        to="/products/new"
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#002b5b] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#001f3f] transition-colors mt-6 cursor-pointer"
      >
        <Plus size={16} aria-hidden />
        Create your first product
      </Link>
    </div>
  );
}

function ProductThumbnail({
  imageUrl,
  name,
}: {
  imageUrl: string | null;
  name: string;
}) {
  if (!imageUrl) {
    return (
      <span className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center">
        <ImageOff size={18} className="text-slate-400" aria-hidden />
      </span>
    );
  }
  return (
    <img
      src={imageUrl}
      alt={name}
      className="w-12 h-12 rounded-lg object-cover bg-slate-100 border border-slate-200"
      loading="lazy"
    />
  );
}

/** Best-effort image: prefer the product-level image, fall back to its
 *  first variant image. Returns null when nothing is available. */
function pickImage(product: Product): string | null {
  if (product.imageUrl) return product.imageUrl;
  const variantImage = product.variants?.find((v) => v.imageUrl)?.imageUrl;
  return variantImage ?? null;
}